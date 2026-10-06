let students = [];
let configs = [];
let currentSubject = "";

document.addEventListener("DOMContentLoaded", async () => {
  await loadConfigs();
  await loadStudents();
  
  // Set default subject if available
  if (configs.length > 0) {
    currentSubject = configs[0].subject;
    document.getElementById("global-subject-filter").value = currentSubject;
  }
  
  document.getElementById("attendance-date").valueAsDate = new Date();
});

async function loadConfigs() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      configs = await res.json();
      const select = document.getElementById("global-subject-filter");
      select.innerHTML = '<option value="">-- กรุณาเลือกวิชา --</option>';
      configs.forEach(c => {
        select.innerHTML += `<option value="${c.subject}">${c.subject}</option>`;
      });
    }
  } catch (err) {
    console.error(err);
  }
}

document.getElementById("global-subject-filter").addEventListener("change", (e) => {
  currentSubject = e.target.value;
  renderTable();
  loadConfigToForm();
  loadAttendance();
});

async function loadStudents() {
  try {
    const res = await fetch('/api/scores');
    if (res.ok) {
      students = await res.json();
      renderTable();
    }
  } catch (err) {
    console.error('Failed to load students:', err);
  }
}

function round1(n) { return (Math.round(n * 100) / 100).toFixed(2); }

function renderTable() {
  const tbody = document.getElementById("table-body");
  const query = (document.getElementById("search-input").value || "").trim().toLowerCase();
  
  const filtered = students.filter(s => 
    s.subject === currentSubject && 
    (s.name.toLowerCase().includes(query) || s.id.includes(query))
  );

  filtered.sort((a, b) => (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }));

  tbody.innerHTML = "";
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8" style="text-align:center;">ไม่พบนักเรียน</td></tr>`;
    return;
  }

  filtered.forEach((s, idx) => {
    const total = round1(s.work + s.mid + s.jit + s.final);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="text-align:center;">${idx + 1}</td>
      <td class="name-cell">
        <div class="n">${s.name}</div>
        <div class="i">${s.id}</div>
      </td>
      <td class="num">${round1(s.work)}</td>
      <td class="num">${round1(s.mid)}</td>
      <td class="num">${round1(s.jit)}</td>
      <td class="num">${round1(s.final)}</td>
      <td class="num" style="color:var(--gold-soft); font-weight:600;">${total}</td>
      <td class="actions">
         <button class="btn btn--ghost" style="padding: 4px 8px; font-size:12px;" onclick="alert('แก้ไขคะแนนเร็วๆนี้')">✏️ แก้ไข</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function loadConfigToForm() {
  const cfg = configs.find(c => c.subject === currentSubject);
  if (cfg) {
    document.getElementById("cfg-work").value = cfg.total_work || 30;
    document.getElementById("cfg-mid").value = cfg.total_mid || 20;
    document.getElementById("cfg-jit").value = cfg.total_jit || 20;
    document.getElementById("cfg-final").value = cfg.total_final || 30;
    
    document.getElementById("th-work").textContent = cfg.total_work || 30;
    document.getElementById("th-mid").textContent = cfg.total_mid || 20;
    document.getElementById("th-jit").textContent = cfg.total_jit || 20;
    document.getElementById("th-final").textContent = cfg.total_final || 30;
  }
}

async function saveConfig() {
  if (!currentSubject) return alert("กรุณาเลือกวิชาก่อน");
  const payload = {
    total_work: parseFloat(document.getElementById("cfg-work").value),
    total_mid: parseFloat(document.getElementById("cfg-mid").value),
    total_jit: parseFloat(document.getElementById("cfg-jit").value),
    total_final: parseFloat(document.getElementById("cfg-final").value)
  };
  
  try {
    const res = await fetch(`/api/config/${encodeURIComponent(currentSubject)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      alert("บันทึกโครงสร้างคะแนนเรียบร้อยแล้ว");
      await loadConfigs();
    }
  } catch (err) {
    console.error(err);
  }
}

// === ATTENDANCE ===
async function loadAttendance() {
  if (!currentSubject) return;
  const date = document.getElementById("attendance-date").value;
  if (!date) return;
  
  const tbody = document.getElementById("attendance-table-body");
  tbody.innerHTML = "<tr><td colspan='6' style='text-align:center;'>กำลังโหลด...</td></tr>";
  
  // Get all students for this subject
  const myStudents = students.filter(s => s.subject === currentSubject);
  myStudents.sort((a, b) => (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }));
  
  if (myStudents.length === 0) {
    tbody.innerHTML = "<tr><td colspan='6' style='text-align:center;'>ยังไม่มีรายชื่อนักเรียนในวิชานี้</td></tr>";
    return;
  }
  
  // Fetch existing attendance for this date
  let attMap = {};
  try {
    const res = await fetch(`/api/attendance?subject=${encodeURIComponent(currentSubject)}&date=${date}`);
    if (res.ok) {
      const data = await res.json();
      data.forEach(r => attMap[r.student_id] = r.status);
    }
  } catch(e) { console.error(e); }
  
  tbody.innerHTML = "";
  myStudents.forEach((s, idx) => {
    const status = attMap[s.id] || "present"; // Default to present
    
    const tr = document.createElement("tr");
    tr.dataset.id = s.id;
    tr.innerHTML = `
      <td style="text-align:center;">${idx + 1}</td>
      <td>${s.id} - ${s.name}</td>
      <td style="text-align:center;"><input type="radio" name="att_${s.id}" value="present" ${status==='present'?'checked':''}></td>
      <td style="text-align:center;"><input type="radio" name="att_${s.id}" value="absent" ${status==='absent'?'checked':''}></td>
      <td style="text-align:center;"><input type="radio" name="att_${s.id}" value="leave" ${status==='leave'?'checked':''}></td>
      <td style="text-align:center;"><input type="radio" name="att_${s.id}" value="late" ${status==='late'?'checked':''}></td>
    `;
    tbody.appendChild(tr);
  });
}

async function saveAttendance() {
  if (!currentSubject) return alert("กรุณาเลือกวิชา");
  const date = document.getElementById("attendance-date").value;
  if (!date) return alert("กรุณาเลือกวันที่");
  
  const rows = document.querySelectorAll("#attendance-table-body tr[data-id]");
  const attendances = [];
  rows.forEach(tr => {
    const id = tr.dataset.id;
    const status = tr.querySelector(`input[name="att_${id}"]:checked`)?.value || "present";
    attendances.push({ student_id: id, status: status });
  });
  
  try {
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: currentSubject, date, attendances })
    });
    if (res.ok) {
      alert("บันทึกการเช็คชื่อสำเร็จ!");
    } else {
      alert("เกิดข้อผิดพลาดในการบันทึก");
    }
  } catch (err) {
    console.error(err);
  }
}

document.getElementById("btn-logout").addEventListener("click", async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login.html';
});
