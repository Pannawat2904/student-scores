let students = [];
let configs = [];
let currentSubject = "";

document.addEventListener("DOMContentLoaded", async () => {
  await loadConfigs();
  await loadStudents();
  
  if (configs.length > 0) {
    currentSubject = configs[0].subject;
    document.getElementById("global-subject-filter").value = currentSubject;
    loadConfigToForm();
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
      if (currentSubject) select.value = currentSubject;
    }
  } catch (err) { console.error(err); }
}

document.getElementById("global-subject-filter").addEventListener("change", (e) => {
  currentSubject = e.target.value;
  renderTable();
  loadConfigToForm();
  loadAttendance();
});

document.getElementById("btn-add-subject").addEventListener("click", () => {
  const subName = prompt("ตั้งชื่อสำหรับระบบ (อ้างอิง) เช่น 'IT 2/1':");
  if (!subName) return;
  if (configs.find(c => c.subject === subName)) return alert("มีชื่อวิชานี้แล้ว");
  
  currentSubject = subName;
  configs.push({
    subject: subName, course_code: "", course_name: "", study_group: "",
    total_work: 30, total_mid: 20, total_jit: 20, total_final: 30,
    jit_config: { show_to_students: false, aspects: [] }
  });
  
  const select = document.getElementById("global-subject-filter");
  select.innerHTML += `<option value="${subName}">${subName}</option>`;
  select.value = subName;
  
  switchTab('tab-settings');
  loadConfigToForm();
});

async function loadStudents() {
  try {
    const res = await fetch('/api/scores');
    if (res.ok) { students = await res.json(); renderTable(); }
  } catch (err) { console.error(err); }
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
      <td class="name-cell"><div class="n">${s.name}</div><div class="i">${s.id}</div></td>
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

document.getElementById("search-input").addEventListener("input", renderTable);

// === SETTINGS ===
function loadConfigToForm() {
  const cfg = configs.find(c => c.subject === currentSubject);
  if (!cfg) return;
  
  document.getElementById("cfg-course-code").value = cfg.course_code || "";
  document.getElementById("cfg-course-name").value = cfg.course_name || "";
  document.getElementById("cfg-study-group").value = cfg.study_group || "";
  document.getElementById("cfg-work").value = cfg.total_work || 30;
  document.getElementById("cfg-mid").value = cfg.total_mid || 20;
  document.getElementById("cfg-jit").value = cfg.total_jit || 20;
  document.getElementById("cfg-final").value = cfg.total_final || 30;
  
  document.getElementById("th-work").textContent = cfg.total_work || 30;
  document.getElementById("th-mid").textContent = cfg.total_mid || 20;
  document.getElementById("th-jit").textContent = cfg.total_jit || 20;
  document.getElementById("th-final").textContent = cfg.total_final || 30;
  
  const jitCfg = cfg.jit_config || { show_to_students: false, aspects: [] };
  document.getElementById("cfg-jit-show").checked = jitCfg.show_to_students;
  
  const container = document.getElementById("jit-aspects-container");
  container.innerHTML = "";
  if (jitCfg.aspects) {
    jitCfg.aspects.forEach((asp, idx) => {
      addJitAspectRow(asp.name, asp.max);
    });
  }
}

function addJitAspect() { addJitAspectRow("", 5); }

function addJitAspectRow(name, max) {
  const container = document.getElementById("jit-aspects-container");
  const div = document.createElement("div");
  div.className = "sub-aspect-row";
  div.innerHTML = `
    <input type="text" class="field jit-name" placeholder="ชื่อด้าน (เช่น ความรับผิดชอบ)" value="${name}" style="flex:2;">
    <input type="number" class="field jit-max" placeholder="คะแนนเต็ม" value="${max}" style="flex:1;">
    <button class="btn btn--ghost" style="color:var(--rose);" onclick="this.parentElement.remove()">ลบ</button>
  `;
  container.appendChild(div);
}

async function saveConfig() {
  if (!currentSubject) return alert("กรุณาเลือกวิชา/สร้างวิชาก่อน");
  
  const aspects = [];
  document.querySelectorAll(".sub-aspect-row").forEach(row => {
    const name = row.querySelector(".jit-name").value;
    const max = parseFloat(row.querySelector(".jit-max").value) || 0;
    if (name) aspects.push({ name, max });
  });
  
  const payload = {
    course_code: document.getElementById("cfg-course-code").value,
    course_name: document.getElementById("cfg-course-name").value,
    study_group: document.getElementById("cfg-study-group").value,
    total_work: parseFloat(document.getElementById("cfg-work").value),
    total_mid: parseFloat(document.getElementById("cfg-mid").value),
    total_jit: parseFloat(document.getElementById("cfg-jit").value),
    total_final: parseFloat(document.getElementById("cfg-final").value),
    jit_config: {
      show_to_students: document.getElementById("cfg-jit-show").checked,
      aspects: aspects
    }
  };
  
  try {
    const res = await fetch(`/api/config/${encodeURIComponent(currentSubject)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      alert("บันทึกข้อมูลวิชาเรียบร้อยแล้ว");
      await loadConfigs();
    }
  } catch (err) { console.error(err); }
}

// === EXCEL UPLOAD ===
const uploadOverlay = document.getElementById("upload-modal-overlay");
document.getElementById("btn-open-upload").addEventListener("click", () => {
  if(!currentSubject) return alert("กรุณาเลือกวิชา หรือสร้างวิชาใหม่ก่อน");
  uploadOverlay.classList.add("show");
});
function closeUploadModal() { uploadOverlay.classList.remove("show"); }

document.getElementById("btn-confirm-upload").addEventListener("click", async () => {
  const fileInput = document.getElementById("excel-file-input");
  if (!fileInput.files[0]) return alert("กรุณาเลือกไฟล์ Excel");
  
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('subject', currentSubject);
  
  document.getElementById("btn-confirm-upload").textContent = "กำลังอัปโหลด...";
  try {
    const res = await fetch('/api/students/upload-excel', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.message);
      closeUploadModal();
      await loadStudents();
    } else { alert("Error: " + data.error); }
  } catch (e) { alert("Upload failed"); }
  document.getElementById("btn-confirm-upload").textContent = "อัปโหลด";
});

// === ATTENDANCE (Reused from v2) ===
async function loadAttendance() { /* same as before */ }
async function saveAttendance() { /* same as before */ }
document.getElementById("btn-logout").addEventListener("click", async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login.html';
});
