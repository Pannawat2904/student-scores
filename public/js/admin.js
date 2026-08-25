/* ============================================================
   ระบบตรวจสอบคะแนนนักเรียน — Admin page logic

   NOTE: ตอนนี้ยังไม่มี backend จริง จึงเก็บข้อมูลไว้ใน MOCK_DATA (in-memory)
   เมื่อเชื่อมต่อ API แล้ว ให้แทนที่ฟังก์ชัน loadStudents / saveStudent /
   deleteStudent ด้วยการเรียก GET/POST/DELETE /api/scores จริง
   ============================================================ */

let students = [];

async function loadStudents() {
  try {
    const res = await fetch('/api/scores');
    if (res.ok) {
      students = await res.json();
      populateSubjectFilter();
      try {
        renderTable();
      } catch (e) {
        alert("Error in renderTable: " + e.message);
      }
    }
  } catch (err) {
    console.error('Failed to load students:', err);
    alert('Failed to load students: ' + err.message);
  }
}

const MAX = { work: 30, mid: 20, jit: 20, final: 30 };

function round1(n) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function computeGrade(total) {
  if (total >= 80) return 4;
  if (total >= 75) return 3.5;
  if (total >= 70) return 3;
  if (total >= 65) return 2.5;
  if (total >= 60) return 2;
  if (total >= 55) return 1.5;
  if (total >= 50) return 1;
  return 0;
}

function gradeBadgeClass(grade) {
  if (grade >= 3) return "badge--pass";
  if (grade >= 1.5) return "badge--warn";
  return "badge--fail";
}

/* -------------------- rendering -------------------- */
const tbody = document.getElementById("table-body");
const searchInput = document.getElementById("search-input");
const subjectFilter = document.getElementById("subject-filter");
const statCount = document.getElementById("stat-count");
const statAvg = document.getElementById("stat-avg");

function populateSubjectFilter() {
  const currentVal = subjectFilter.value;
  const subjects = [...new Set(students.map(s => s.subject))].filter(Boolean);
  subjectFilter.innerHTML = '<option value="">-- ทุกวิชา --</option>';
  subjects.forEach(sub => {
    const opt = document.createElement("option");
    opt.value = sub;
    opt.textContent = sub;
    subjectFilter.appendChild(opt);
  });
  if (subjects.includes(currentVal)) {
    subjectFilter.value = currentVal;
  } else if (subjects.length > 0) {
    subjectFilter.value = subjects[0];
  }
}

function renderTable() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedSubject = subjectFilter.value;
  
  const filtered = students.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(query) || s.id.includes(query);
    const matchSubject = !selectedSubject || s.subject === selectedSubject;
    return matchSearch && matchSubject;
  });

  tbody.innerHTML = "";

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">ไม่พบนักเรียนที่ค้นหา</td></tr>`;
  }

  filtered.forEach((s) => {
    const total = round1(s.work + s.mid + s.jit + s.final);
    const grade = computeGrade(total);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="name-cell">
        <div class="n">${s.name}</div>
        <div class="i">${s.id}</div>
      </td>
      <td class="num">${round1(s.work)}</td>
      <td class="num">${round1(s.mid)}</td>
      <td class="num">${round1(s.jit)}</td>
      <td class="num">${round1(s.final)}</td>
      <td class="num" style="color:var(--gold-soft); font-weight:600;">${total}</td>
      <td class="num"><span class="badge ${gradeBadgeClass(grade)}">${grade}</span></td>
      <td class="actions">
        <button class="icon-btn" title="ดูรายละเอียด" onclick="showDetailsModal('${s.id}')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
        </button>
        <button class="icon-btn danger" title="ลบข้อมูล" onclick="deleteStudent('${s.id}')">🗑</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  statCount.textContent = students.length;
  const avg = students.length
    ? round1(
        students.reduce((sum, s) => sum + s.work + s.mid + s.jit + s.final, 0) /
          students.length
      )
    : 0;
  statAvg.textContent = avg;

  updateChart(filtered);
}

let gradeChartInstance = null;
function updateChart(filteredStudents) {
  const gradeCounts = { "4": 0, "3.5": 0, "3": 0, "2.5": 0, "2": 0, "1.5": 0, "1": 0, "0": 0 };
  filteredStudents.forEach(s => {
    const total = (s.work || 0) + (s.mid || 0) + (s.jit || 0) + (s.final || 0);
    const grade = computeGrade(total);
    gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
  });

  const labels = ["เกรด 4", "เกรด 3.5", "เกรด 3", "เกรด 2.5", "เกรด 2", "เกรด 1.5", "เกรด 1", "เกรด 0"];
  const data = [
    gradeCounts["4"], gradeCounts["3.5"], gradeCounts["3"], gradeCounts["2.5"],
    gradeCounts["2"], gradeCounts["1.5"], gradeCounts["1"], gradeCounts["0"]
  ];

  const ctx = document.getElementById('gradeChart');
  if (!ctx) return;

  if (gradeChartInstance) {
    gradeChartInstance.data.datasets[0].data = data;
    gradeChartInstance.update();
  } else {
    gradeChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'จำนวนนักเรียน',
          data: data,
          backgroundColor: 'rgba(245, 158, 11, 0.7)',
          borderColor: 'rgba(245, 158, 11, 1)',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }
}

function showDetailsModal(id) {
  const student = students.find(s => s.id === id);
  if (!student) return;

  document.getElementById("details-student-name").textContent = student.name;
  document.getElementById("details-student-id").textContent = `รหัสประจำตัว: ${student.id} | ${student.subject}`;

  const container = document.getElementById("details-assignments-container");
  if (!student.assignments || student.assignments.length === 0) {
    container.innerHTML = '<p style="text-align:center; opacity:0.5;">ไม่มีข้อมูลชิ้นงาน</p>';
  } else {
    const tests = [];
    const works = [];
    student.assignments.forEach(a => {
      if (a.name.includes("ทดสอบ") || a.name.includes("สอบ")) {
        tests.push(a);
      } else {
        works.push(a);
      }
    });

    const renderTable = (title, items, colorVar) => {
      if (items.length === 0) return '';
      let html = `<div class="assignments-category">
        <h4 style="color: var(--${colorVar});">${title} (${items.length} รายการ)</h4>
        <table class="assignments-table">
          <thead>
            <tr>
              <th style="width: 55%">ชื่องาน</th>
              <th style="width: 20%">คะแนน</th>
              <th style="width: 25%">สถานะ</th>
            </tr>
          </thead>
          <tbody>
      `;
      items.forEach(a => {
        const isSubmitted = a.status === 'submitted';
        const rowClass = isSubmitted ? '' : 'row-missing';
        const scoreColor = isSubmitted ? 'var(--mint)' : 'var(--rose)';
        const scoreText = isSubmitted ? `${a.score}` : '-';
        const badgeClass = isSubmitted ? 'submitted' : 'missing';
        const badgeText = isSubmitted ? 'ส่งแล้ว' : 'ยังไม่ส่ง';
        html += `
          <tr class="${rowClass}">
            <td style="color: var(--ink);">${a.name}</td>
            <td class="score" style="color: ${scoreColor};">${scoreText}</td>
            <td><span class="badge-status ${badgeClass}">${badgeText}</span></td>
          </tr>
        `;
      });
      html += `</tbody></table></div>`;
      return html;
    };

    container.innerHTML = renderTable("แบบทดสอบ", tests, "mint") + renderTable("ใบงานและภาระงาน", works, "gold");
  }

  document.getElementById("details-modal").classList.add("show");
  document.getElementById("details-modal-overlay").classList.add("show");
}

document.getElementById("details-modal-close-btn").addEventListener("click", hideDetailsModal);
document.getElementById("details-close-btn").addEventListener("click", hideDetailsModal);
document.getElementById("details-modal-overlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("details-modal-overlay")) hideDetailsModal();
});

function hideDetailsModal() {
  document.getElementById("details-modal").classList.remove("show");
  document.getElementById("details-modal-overlay").classList.remove("show");
}

/* -------------------- score modal -------------------- */
const scoreOverlay = document.getElementById("score-modal-overlay");
const scoreForm = document.getElementById("score-form");
const modalTitle = document.getElementById("modal-title");
const editingIdField = document.getElementById("f-editing-id");

function openAddModal() {
  scoreForm.reset();
  editingIdField.value = "";
  modalTitle.textContent = "เพิ่มนักเรียน";
  document.getElementById("f-id").disabled = false;
  scoreOverlay.classList.add("show");
  document.getElementById("f-name").focus();
}

function openEditModal(id) {
  const s = students.find((x) => x.id === id);
  if (!s) return;
  document.getElementById("f-name").value = s.name;
  document.getElementById("f-id").value = s.id;
  document.getElementById("f-id").disabled = true;
  document.getElementById("f-work").value = s.work;
  document.getElementById("f-mid").value = s.mid;
  document.getElementById("f-jit").value = s.jit;
  document.getElementById("f-final").value = s.final;
  editingIdField.value = id;
  modalTitle.textContent = "แก้ไขคะแนน";
  scoreOverlay.classList.add("show");
  document.getElementById("f-name").focus();
}

function closeScoreModal() {
  scoreOverlay.classList.remove("show");
}

document.getElementById("btn-open-add").addEventListener("click", openAddModal);
document.getElementById("modal-close-btn").addEventListener("click", closeScoreModal);
document.getElementById("modal-cancel-btn").addEventListener("click", closeScoreModal);
scoreOverlay.addEventListener("click", (e) => {
  if (e.target === scoreOverlay) closeScoreModal();
});

scoreForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("f-name").value.trim();
  const id = document.getElementById("f-id").value.trim();
  const work = Math.min(MAX.work, Math.max(0, parseFloat(document.getElementById("f-work").value) || 0));
  const mid = Math.min(MAX.mid, Math.max(0, parseFloat(document.getElementById("f-mid").value) || 0));
  const jit = Math.min(MAX.jit, Math.max(0, parseFloat(document.getElementById("f-jit").value) || 0));
  const final = Math.min(MAX.final, Math.max(0, parseFloat(document.getElementById("f-final").value) || 0));

  if (!name || !id) return;

  try {
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ id, name, work, mid, jit, final }),
    });
    if (res.ok) {
      await loadStudents();
    } else {
      alert('บันทึกข้อมูลไม่สำเร็จ');
    }
  } catch (err) {
    console.error(err);
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
  }

  closeScoreModal();
  renderTable();
});

tbody.addEventListener("click", async (e) => {
  const editId = e.target.closest("[data-edit]")?.dataset.edit;
  const delId = e.target.closest("[data-delete]")?.dataset.delete;

  if (editId) openEditModal(editId);

  if (delId) {
    const s = students.find((x) => x.id === delId);
    if (confirm(`ลบข้อมูลของ ${s?.name} ใช่หรือไม่?`)) {
      try {
        const res = await fetch(`/api/scores/${delId}`, { 
          method: 'DELETE',
          credentials: 'same-origin' 
        });
        if (res.ok) {
          await loadStudents();
        }
      } catch (err) {
        console.error(err);
        alert('ลบข้อมูลไม่สำเร็จ');
      }
    }
  }
});

searchInput.addEventListener("input", renderTable);
subjectFilter.addEventListener("change", renderTable);

/* -------------------- upload modal -------------------- */
const uploadOverlay = document.getElementById("upload-modal-overlay");
const uploadZone = document.getElementById("upload-zone");
const fileInput = document.getElementById("csv-file-input");
const uploadFilename = document.getElementById("upload-filename");
let selectedFile = null;

function openUploadModal() {
  selectedFile = null;
  uploadFilename.textContent = "";
  fileInput.value = "";
  uploadOverlay.classList.add("show");
}
function closeUploadModal() {
  uploadOverlay.classList.remove("show");
}

document.getElementById("btn-open-upload").addEventListener("click", openUploadModal);
document.getElementById("upload-modal-close-btn").addEventListener("click", closeUploadModal);
document.getElementById("upload-cancel-btn").addEventListener("click", closeUploadModal);
uploadOverlay.addEventListener("click", (e) => {
  if (e.target === uploadOverlay) closeUploadModal();
});

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) {
    selectedFile = fileInput.files[0];
    uploadFilename.textContent = selectedFile.name;
  }
});

["dragover", "dragenter"].forEach((evt) =>
  uploadZone.addEventListener(evt, (e) => {
    e.preventDefault();
    uploadZone.classList.add("dragover");
  })
);
["dragleave", "drop"].forEach((evt) =>
  uploadZone.addEventListener(evt, (e) => {
    e.preventDefault();
    uploadZone.classList.remove("dragover");
  })
);
uploadZone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith(".csv")) {
    selectedFile = file;
    uploadFilename.textContent = file.name;
  }
});

document.getElementById("upload-confirm-btn").addEventListener("click", () => {
  if (!selectedFile) {
    alert("กรุณาเลือกไฟล์ CSV ก่อนอัปโหลด");
    return;
  }

  const subject = document.getElementById("upload-subject").value;
  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('subject', subject);
  
  const confirmBtn = document.getElementById("upload-confirm-btn");
  confirmBtn.disabled = true;
  confirmBtn.textContent = "กำลังอัปโหลด...";

  fetch('/api/scores/upload', { 
    method: 'POST', 
    credentials: 'same-origin',
    body: formData 
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        alert(`อัปโหลดไฟล์สำเร็จ! นำเข้าข้อมูล ${data.count} รายการ`);
        loadStudents();
      } else {
        alert('เกิดข้อผิดพลาดในการอัปโหลด');
      }
    })
    .catch((err) => {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    })
    .finally(() => {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "อัปโหลด";
    });

  closeUploadModal();
});

/* -------------------- init -------------------- */
loadStudents();

/* -------------------- sync settings -------------------- */
document.getElementById("btn-sync-settings").addEventListener("click", openSyncSettings);
document.getElementById("btn-sync-now").addEventListener("click", triggerSync);
document.getElementById("sync-modal-close-btn").addEventListener("click", closeSyncSettings);
document.getElementById("sync-cancel-btn").addEventListener("click", closeSyncSettings);
document.getElementById("add-config-btn").addEventListener("click", () => addConfigRow());
document.getElementById("sync-save-btn").addEventListener("click", saveSyncSettings);

let currentConfigs = [];

async function openSyncSettings() {
  document.getElementById("sync-settings-modal").classList.add("show");
  document.getElementById("sync-settings-overlay").classList.add("show");
  
  try {
    const res = await fetch("/api/config", { credentials: "include" });
    currentConfigs = await res.json();
    renderConfigs();
  } catch (err) {
    console.error(err);
  }
}

function closeSyncSettings() {
  document.getElementById("sync-settings-modal").classList.remove("show");
  document.getElementById("sync-settings-overlay").classList.remove("show");
}

function renderConfigs() {
  const container = document.getElementById("sync-configs-container");
  container.innerHTML = '';
  
  if (currentConfigs.length === 0) {
    addConfigRow();
    return;
  }
  
  currentConfigs.forEach((c) => {
    addConfigRow(c.subject, c.url);
  });
}

function addConfigRow(subject = '', url = '') {
  const container = document.getElementById("sync-configs-container");
  const div = document.createElement("div");
  div.className = "field-group";
  div.style.marginBottom = "15px";
  div.style.paddingBottom = "15px";
  div.style.borderBottom = "1px solid var(--glass-border)";
  
  div.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <input type="text" class="field config-subject" placeholder="ชื่อวิชา (เช่น คณิตศาสตร์)" value="${subject}" style="font-weight: 500;">
      <div style="display: flex; gap: 8px;">
        <input type="text" class="field config-url" placeholder="วางลิงก์ Google Sheets..." value="${url}" style="flex: 1; font-size: 13px;">
        <button type="button" class="btn btn--ghost" style="color:var(--rose); padding: 0 12px; border: 1px solid rgba(239,68,68,0.2);" aria-label="ลบ" onclick="this.parentElement.parentElement.parentElement.remove()">🗑</button>
      </div>
    </div>
  `;
  container.appendChild(div);
}

async function saveSyncSettings() {
  const container = document.getElementById("sync-configs-container");
  const rows = container.querySelectorAll(".field-group");
  const newConfigs = [];
  
  rows.forEach(r => {
    const subject = r.querySelector(".config-subject").value.trim();
    const url = r.querySelector(".config-url").value.trim();
    if (subject && url) {
      newConfigs.push({ subject, url });
    }
  });

  const btn = document.getElementById("sync-save-btn");
  btn.disabled = true;
  btn.textContent = "กำลังบันทึก...";

  try {
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(newConfigs)
    });
    
    if (res.status === 401) {
      alert("หมดเวลาเซสชั่น กรุณาเข้าสู่ระบบใหม่");
      window.location.href = "/login.html";
      return;
    }
    
    if (res.ok) {
      alert("✅ บันทึกการตั้งค่าแล้ว");
      closeSyncSettings();
    } else {
      let msg = "บันทึกไม่สำเร็จ";
      try { const d = await res.json(); msg = d.error || msg; } catch(e) {}
      throw new Error(msg);
    }
  } catch (err) {
    alert("เกิดข้อผิดพลาด: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "บันทึกการตั้งค่า";
  }
}

async function triggerSync() {
  const btn = document.getElementById("btn-sync-now");
  const origText = btn.textContent;
  btn.textContent = "กำลังซิงค์...";
  btn.disabled = true;
  
  try {
    const res = await fetch("/api/scores/sync", { 
      method: "POST",
      credentials: "include" 
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Sync failed");
    
    if (data.errors && data.errors.length > 0) {
      alert(`ซิงค์สำเร็จบางส่วน อัปเดต ${data.count} รายการ\nข้อผิดพลาด:\n` + data.errors.join("\n"));
    } else {
      alert(`ซิงค์ข้อมูลสำเร็จ! อัปเดตคะแนน ${data.count} รายการ`);
    }
    loadStudents();
  } catch (err) {
    alert("การซิงค์ล้มเหลว: " + err.message);
  } finally {
    btn.textContent = origText;
    btn.disabled = false;
  }
}

// Setup Logout Button
const logoutBtn = document.getElementById("btn-logout");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    fetch('/api/logout', { method: 'POST', credentials: 'same-origin' })
    .then(() => {
      window.location.href = '/login.html';
    }).catch(() => {
      window.location.href = '/login.html';
    });
  });
}
