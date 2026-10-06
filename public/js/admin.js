/* ============================================================
   ระบบจัดการห้องเรียน - Admin V3
   รองรับ: รายชื่อ + คะแนน, เช็คชื่อ, ตั้งค่าวิชา, อัปโหลด Excel
   ไม่พึ่งพา Google Sheets - เก็บข้อมูลใน Supabase โดยตรง
   ============================================================ */

let students = [];
let configs = [];
let currentSubject = "";
let currentCfg = null;

// =============================================
// INIT
// =============================================
document.addEventListener("DOMContentLoaded", async () => {
  await loadConfigs();
  await loadStudents();
  
  if (configs.length > 0) {
    currentSubject = configs[0].subject;
    document.getElementById("global-subject-filter").value = currentSubject;
    applyCurrentConfig();
  }
  
  document.getElementById("attendance-date").valueAsDate = new Date();
  bindEvents();
});

// =============================================
// TAB SWITCHING
// =============================================
function switchTab(btn) {
  const tabId = btn.dataset.tab;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  btn.classList.add('active');
}
window.switchTab = switchTab;

// =============================================
// CONFIG LOADING
// =============================================
async function loadConfigs() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      configs = await res.json();
      const select = document.getElementById("global-subject-filter");
      select.innerHTML = '<option value="">-- กรุณาเลือกวิชา --</option>';
      configs.forEach(c => {
        const label = c.course_code
          ? `${c.course_code} ${c.course_name || ''} ${c.study_group ? `(${c.study_group})` : ''}`.trim()
          : c.subject;
        select.innerHTML += `<option value="${c.subject}">${label}</option>`;
      });
      if (currentSubject) select.value = currentSubject;
    }
  } catch (err) { console.error('loadConfigs error:', err); }
}

function applyCurrentConfig() {
  currentCfg = configs.find(c => c.subject === currentSubject) || null;
  const cfg = currentCfg;
  
  // Update table headers
  document.getElementById("th-work").textContent = cfg?.total_work ?? 30;
  document.getElementById("th-mid").textContent = cfg?.total_mid ?? 20;
  document.getElementById("th-jit").textContent = cfg?.total_jit ?? 20;
  document.getElementById("th-final").textContent = cfg?.total_final ?? 30;
  
  // Update header subtitle
  if (cfg) {
    const subtitle = [cfg.course_code, cfg.course_name, cfg.study_group].filter(Boolean).join(' · ');
    document.getElementById("header-subtitle").textContent = subtitle || "เช็คชื่อ จัดการงาน และให้คะแนนนักเรียน";
  }
  
  loadConfigToForm();
  renderTable();
}

// =============================================
// STUDENT LOADING & TABLE
// =============================================
async function loadStudents() {
  try {
    const res = await fetch('/api/scores');
    if (res.ok) {
      students = await res.json();
      renderTable();
    }
  } catch (err) { console.error('loadStudents error:', err); }
}

function round1(n) { return parseFloat((Math.round(n * 100) / 100).toFixed(2)); }

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

function renderTable() {
  const tbody = document.getElementById("table-body");
  const query = (document.getElementById("search-input").value || "").trim().toLowerCase();
  
  let filtered = students.filter(s =>
    s.subject === currentSubject &&
    (s.name.toLowerCase().includes(query) || (s.id || '').includes(query))
  );
  
  filtered.sort((a, b) => (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }));
  
  tbody.innerHTML = "";
  
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8" style="text-align:center; padding:30px;">ไม่พบนักเรียน${currentSubject ? '' : ' — กรุณาเลือกวิชา'}</td></tr>`;
  } else {
    filtered.forEach((s, idx) => {
      const total = round1((s.work || 0) + (s.mid || 0) + (s.jit || 0) + (s.final || 0));
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="text-align:center; font-size:13px; color:var(--ink-dim);">${idx + 1}</td>
        <td class="name-cell">
          <div class="n">${s.name}</div>
          <div class="i">${s.id}</div>
        </td>
        <td class="num">${round1(s.work || 0)}</td>
        <td class="num">${round1(s.mid || 0)}</td>
        <td class="num">${round1(s.jit || 0)}</td>
        <td class="num">${round1(s.final || 0)}</td>
        <td class="num" style="color:var(--gold-soft); font-weight:600;">${total}</td>
        <td class="actions">
          <button class="icon-btn" title="แก้ไขคะแนน" onclick="openEditModal('${s.id}', '${(s.subject||'').replace(/'/g, "\\'")}')">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button class="icon-btn danger" title="ลบ" onclick="deleteStudent('${s.id}', '${(s.subject||'').replace(/'/g, "\\'")}')">🗑</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
  
  // Update stats
  const myStudents = students.filter(s => s.subject === currentSubject);
  document.getElementById("stat-count").textContent = myStudents.length;
  const avg = myStudents.length
    ? (myStudents.reduce((sum, s) => sum + (s.work||0) + (s.mid||0) + (s.jit||0) + (s.final||0), 0) / myStudents.length).toFixed(2)
    : "0.0";
  document.getElementById("stat-avg").textContent = avg;
}

// =============================================
// DELETE STUDENT
// =============================================
async function deleteStudent(id, subject) {
  const s = students.find(x => x.id === id && x.subject === subject);
  if (!confirm(`ลบข้อมูลของ "${s?.name || id}" ออกจากวิชานี้ใช่หรือไม่?`)) return;
  try {
    const res = await fetch(`/api/scores/${id}?subject=${encodeURIComponent(subject)}`, {
      method: 'DELETE', credentials: 'same-origin'
    });
    if (res.ok) {
      students = students.filter(x => !(x.id === id && x.subject === subject));
      renderTable();
    }
  } catch (err) { console.error(err); }
}
window.deleteStudent = deleteStudent;

// =============================================
// SCORE MODAL (Add / Edit)
// =============================================
function openAddModal() {
  if (!currentSubject) return alert("กรุณาเลือกวิชาก่อน");
  document.getElementById("score-form").reset();
  document.getElementById("f-editing-id").value = "";
  document.getElementById("modal-title").textContent = "เพิ่มนักเรียนใหม่";
  document.getElementById("f-id").disabled = false;
  updateScoreModalMaxValues();
  buildJitScoreInputs(null);
  document.getElementById("score-modal-overlay").classList.add("show");
  document.getElementById("f-name").focus();
}

function openEditModal(id, subject) {
  const s = students.find(x => x.id === id && x.subject === subject);
  if (!s) return;
  
  document.getElementById("f-name").value = s.name;
  document.getElementById("f-id").value = s.id;
  document.getElementById("f-id").disabled = true;
  document.getElementById("f-work").value = s.work || 0;
  document.getElementById("f-mid").value = s.mid || 0;
  document.getElementById("f-jit").value = s.jit || 0;
  document.getElementById("f-final").value = s.final || 0;
  document.getElementById("f-editing-id").value = id;
  document.getElementById("modal-title").textContent = `แก้ไขคะแนน — ${s.name}`;
  updateScoreModalMaxValues();
  buildJitScoreInputs(s.jit_scores);
  document.getElementById("score-modal-overlay").classList.add("show");
}
window.openEditModal = openEditModal;

function updateScoreModalMaxValues() {
  const cfg = currentCfg;
  document.getElementById("f-max-work").textContent = cfg?.total_work ?? 30;
  document.getElementById("f-max-mid").textContent = cfg?.total_mid ?? 20;
  document.getElementById("f-max-jit").textContent = cfg?.total_jit ?? 20;
  document.getElementById("f-max-final").textContent = cfg?.total_final ?? 30;
  
  document.getElementById("f-work").max = cfg?.total_work ?? 30;
  document.getElementById("f-mid").max = cfg?.total_mid ?? 20;
  document.getElementById("f-jit").max = cfg?.total_jit ?? 20;
  document.getElementById("f-final").max = cfg?.total_final ?? 30;
}

function buildJitScoreInputs(existingJitScores = null) {
  const container = document.getElementById("jit-score-inputs");
  const jitCfg = currentCfg?.jit_config;
  const aspects = jitCfg?.aspects || [];
  
  if (aspects.length === 0) {
    // Simple single jit input
    container.innerHTML = `
      <div>
        <label class="field-label" for="f-jit">คะแนนจิตพิสัย (รวม)</label>
        <input class="field" id="f-jit" type="number" step="0.01" min="0" value="${existingJitScores?.total ?? 0}">
      </div>`;
    return;
  }
  
  // Build aspect inputs
  let html = '';
  aspects.forEach(asp => {
    const val = existingJitScores?.[asp.name] ?? 0;
    html += `
      <div class="jit-aspect-score-row">
        <label>${asp.name}</label>
        <span style="font-size:12px; color:var(--ink-dim);">/ ${asp.max}</span>
        <input type="number" class="field jit-aspect-input" data-aspect="${asp.name}" data-max="${asp.max}" 
               step="0.01" min="0" max="${asp.max}" value="${val}" style="width: 90px;">
      </div>`;
  });
  
  // Hidden f-jit field (auto-calculated)
  html += `<input type="hidden" id="f-jit" value="0">`;
  container.innerHTML = html;
  
  // Auto-sum on change
  container.querySelectorAll('.jit-aspect-input').forEach(input => {
    input.addEventListener('input', () => {
      const total = Array.from(container.querySelectorAll('.jit-aspect-input'))
        .reduce((sum, inp) => sum + (parseFloat(inp.value) || 0), 0);
      document.getElementById("f-jit").value = Math.min(total, currentCfg?.total_jit ?? 20);
    });
  });
}

function closeScoreModal() {
  document.getElementById("score-modal-overlay").classList.remove("show");
}

document.getElementById("score-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const name = document.getElementById("f-name").value.trim();
  const id = document.getElementById("f-id").value.trim();
  const cfg = currentCfg;
  const maxWork = cfg?.total_work ?? 30;
  const maxMid = cfg?.total_mid ?? 20;
  const maxJit = cfg?.total_jit ?? 20;
  const maxFinal = cfg?.total_final ?? 30;
  
  const work = Math.min(maxWork, Math.max(0, parseFloat(document.getElementById("f-work").value) || 0));
  const mid = Math.min(maxMid, Math.max(0, parseFloat(document.getElementById("f-mid").value) || 0));
  const jit = Math.min(maxJit, Math.max(0, parseFloat(document.getElementById("f-jit").value) || 0));
  const final_ = Math.min(maxFinal, Math.max(0, parseFloat(document.getElementById("f-final").value) || 0));
  
  // Collect jit sub-scores
  const jitScores = { total: jit };
  document.querySelectorAll('.jit-aspect-input').forEach(inp => {
    jitScores[inp.dataset.aspect] = parseFloat(inp.value) || 0;
  });
  
  if (!name || !id) return;
  
  try {
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ id, name, subject: currentSubject, work, mid, jit, final: final_, jit_scores: jitScores })
    });
    if (res.ok) {
      closeScoreModal();
      await loadStudents();
    } else {
      alert('บันทึกคะแนนไม่สำเร็จ');
    }
  } catch (err) {
    console.error(err);
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
  }
});

// =============================================
// ATTENDANCE
// =============================================
async function loadAttendance() {
  const date = document.getElementById("attendance-date").value;
  if (!date) return alert("กรุณาเลือกวันที่");
  if (!currentSubject) return alert("กรุณาเลือกวิชา");
  
  const tbody = document.getElementById("attendance-table-body");
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px;">กำลังโหลด...</td></tr>`;
  
  const myStudents = students.filter(s => s.subject === currentSubject);
  myStudents.sort((a, b) => (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }));
  
  if (myStudents.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--ink-dim);">ยังไม่มีรายชื่อนักเรียนในวิชานี้<br>กรุณาอัปโหลดไฟล์ Excel ก่อน</td></tr>`;
    return;
  }
  
  // Fetch existing attendance
  let attMap = {};
  try {
    const res = await fetch(`/api/attendance?subject=${encodeURIComponent(currentSubject)}&date=${date}`);
    if (res.ok) {
      const data = await res.json();
      data.forEach(r => attMap[r.student_id] = r.status);
    }
  } catch (e) { console.error(e); }
  
  tbody.innerHTML = "";
  myStudents.forEach((s, idx) => {
    const status = attMap[s.id] || "present";
    const tr = document.createElement("tr");
    tr.dataset.id = s.id;
    const opts = ['present','absent','leave','late'];
    tr.innerHTML = `
      <td style="text-align:center; font-size:13px; color:var(--ink-dim);">${idx + 1}</td>
      <td><div class="n">${s.name}</div><div class="i">${s.id}</div></td>
      ${opts.map(o => `
        <td style="text-align:center;">
          <input type="radio" name="att_${s.id}" value="${o}" ${status === o ? 'checked' : ''}
                 style="accent-color: var(--gold); width:18px; height:18px; cursor:pointer;" onchange="updateAttSummary()">
        </td>
      `).join('')}
    `;
    tbody.appendChild(tr);
  });
  
  updateAttSummary();
}

function updateAttSummary() {
  const rows = document.querySelectorAll("#attendance-table-body tr[data-id]");
  let present = 0, absent = 0, late = 0, leave = 0;
  rows.forEach(tr => {
    const status = tr.querySelector('input[type="radio"]:checked')?.value || 'present';
    if (status === 'present') present++;
    else if (status === 'absent') absent++;
    else if (status === 'late') late++;
    else if (status === 'leave') leave++;
  });
  document.getElementById("att-summary-text").innerHTML = 
    `<span class="att-summary-badge present">✅ มา ${present}</span> &nbsp;
     <span class="att-summary-badge absent">❌ ขาด ${absent}</span> &nbsp;
     <span style="font-size:12px; color:var(--ink-dim);">📋 ลา ${leave} &nbsp;⏰ สาย ${late}</span>`;
}
window.updateAttSummary = updateAttSummary;

async function saveAttendance() {
  if (!currentSubject) return alert("กรุณาเลือกวิชา");
  const date = document.getElementById("attendance-date").value;
  if (!date) return alert("กรุณาเลือกวันที่");
  
  const rows = document.querySelectorAll("#attendance-table-body tr[data-id]");
  if (rows.length === 0) return alert("ยังไม่มีรายชื่อ กรุณาดึงรายชื่อก่อน");
  
  const attendances = [];
  rows.forEach(tr => {
    const id = tr.dataset.id;
    const status = tr.querySelector(`input[name="att_${id}"]:checked`)?.value || "present";
    attendances.push({ student_id: id, status });
  });
  
  try {
    const btn = document.getElementById("btn-save-attendance");
    btn.textContent = "กำลังบันทึก...";
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: currentSubject, date, attendances })
    });
    btn.textContent = "💾 บันทึกการเช็คชื่อ";
    if (res.ok) {
      // Show success
      btn.textContent = "✅ บันทึกสำเร็จ!";
      btn.style.background = "rgba(16,185,129,0.2)";
      setTimeout(() => { btn.textContent = "💾 บันทึกการเช็คชื่อ"; btn.style.background = ""; }, 2000);
    } else {
      alert("เกิดข้อผิดพลาดในการบันทึก");
    }
  } catch (err) { console.error(err); }
}

// =============================================
// SETTINGS / CONFIG
// =============================================
function loadConfigToForm() {
  const cfg = currentCfg;
  if (!cfg) return;
  
  document.getElementById("cfg-course-code").value = cfg.course_code || "";
  document.getElementById("cfg-course-name").value = cfg.course_name || "";
  document.getElementById("cfg-study-group").value = cfg.study_group || "";
  document.getElementById("cfg-work").value = cfg.total_work ?? 30;
  document.getElementById("cfg-mid").value = cfg.total_mid ?? 20;
  document.getElementById("cfg-jit").value = cfg.total_jit ?? 20;
  document.getElementById("cfg-final").value = cfg.total_final ?? 30;
  
  const jitCfg = cfg.jit_config || { show_to_students: false, aspects: [] };
  document.getElementById("cfg-jit-show").checked = !!jitCfg.show_to_students;
  
  const container = document.getElementById("jit-aspects-container");
  container.innerHTML = "";
  (jitCfg.aspects || []).forEach(asp => addJitAspectRow(asp.name, asp.max));
}

function addJitAspect() { addJitAspectRow("", 5); }
window.addJitAspect = addJitAspect;

function addJitAspectRow(name, max) {
  const container = document.getElementById("jit-aspects-container");
  const div = document.createElement("div");
  div.className = "sub-aspect-row";
  div.innerHTML = `
    <input type="text" class="field jit-name" placeholder="ชื่อด้าน เช่น ความรับผิดชอบ" value="${name || ''}" style="flex: 1;">
    <input type="number" class="field jit-max" placeholder="คะแนน" value="${max || 5}" style="width: 90px;">
    <button class="btn btn--ghost" style="color:var(--rose); padding: 8px 12px;" onclick="this.parentElement.remove()">ลบ</button>
  `;
  container.appendChild(div);
}
window.addJitAspectRow = addJitAspectRow;

async function saveConfig() {
  if (!currentSubject) return alert("กรุณาเลือกวิชาก่อน");
  
  const aspects = [];
  document.querySelectorAll(".sub-aspect-row").forEach(row => {
    const name = row.querySelector(".jit-name").value.trim();
    const max = parseFloat(row.querySelector(".jit-max").value) || 0;
    if (name) aspects.push({ name, max });
  });
  
  const payload = {
    course_code: document.getElementById("cfg-course-code").value,
    course_name: document.getElementById("cfg-course-name").value,
    study_group: document.getElementById("cfg-study-group").value,
    total_work: parseFloat(document.getElementById("cfg-work").value) || 30,
    total_mid: parseFloat(document.getElementById("cfg-mid").value) || 20,
    total_jit: parseFloat(document.getElementById("cfg-jit").value) || 20,
    total_final: parseFloat(document.getElementById("cfg-final").value) || 30,
    jit_config: {
      show_to_students: document.getElementById("cfg-jit-show").checked,
      aspects
    }
  };
  
  try {
    const res = await fetch(`/api/config/${encodeURIComponent(currentSubject)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      await loadConfigs();
      currentCfg = configs.find(c => c.subject === currentSubject);
      applyCurrentConfig();
      
      const btn = document.querySelector('[onclick="saveConfig()"]');
      const orig = btn.textContent;
      btn.textContent = "✅ บันทึกสำเร็จ!";
      setTimeout(() => btn.textContent = orig, 2000);
    }
  } catch (err) { console.error(err); }
}
window.saveConfig = saveConfig;

// =============================================
// EXCEL UPLOAD MODAL
// =============================================
const uploadOverlay = document.getElementById("upload-modal-overlay");
let selectedExcelFile = null;

function openUploadModal() {
  if (!currentSubject) return alert("กรุณาเลือกวิชาก่อน");
  selectedExcelFile = null;
  document.getElementById("upload-filename").textContent = "";
  document.getElementById("excel-file-input").value = "";
  uploadOverlay.classList.add("show");
}

function closeUploadModal() { uploadOverlay.classList.remove("show"); }

document.getElementById("excel-file-input").addEventListener("change", e => {
  const f = e.target.files[0];
  if (f) {
    selectedExcelFile = f;
    document.getElementById("upload-filename").textContent = `✅ ${f.name}`;
  }
});

const uploadZone = document.getElementById("upload-zone");
["dragover","dragenter"].forEach(evt => uploadZone.addEventListener(evt, e => { e.preventDefault(); uploadZone.classList.add("dragover"); }));
["dragleave","drop"].forEach(evt => uploadZone.addEventListener(evt, e => { e.preventDefault(); uploadZone.classList.remove("dragover"); }));
uploadZone.addEventListener("drop", e => {
  const f = e.dataTransfer.files[0];
  if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) {
    selectedExcelFile = f;
    document.getElementById("upload-filename").textContent = `✅ ${f.name}`;
  }
});

document.getElementById("btn-confirm-upload").addEventListener("click", async () => {
  if (!selectedExcelFile) return alert("กรุณาเลือกไฟล์ Excel ก่อน");
  
  const formData = new FormData();
  formData.append('file', selectedExcelFile);
  formData.append('subject', currentSubject);
  
  const btn = document.getElementById("btn-confirm-upload");
  btn.textContent = "กำลังอัปโหลด...";
  btn.disabled = true;
  
  try {
    const res = await fetch('/api/students/upload-excel', { method: 'POST', body: formData });
    const data = await res.json();
    btn.textContent = "📥 อัปโหลด";
    btn.disabled = false;
    
    if (res.ok) {
      closeUploadModal();
      await loadStudents();
      alert(`✅ ${data.message}`);
    } else {
      alert("❌ Error: " + (data.error || "Upload failed"));
    }
  } catch (e) {
    btn.textContent = "📥 อัปโหลด";
    btn.disabled = false;
    alert("เกิดข้อผิดพลาดในการอัปโหลด");
  }
});

// =============================================
// ADD NEW SUBJECT MODAL
// =============================================
const subjectOverlay = document.getElementById("subject-modal-overlay");

function openSubjectModal() { subjectOverlay.classList.add("show"); }
function closeSubjectModal() { subjectOverlay.classList.remove("show"); }

document.getElementById("btn-confirm-subject").addEventListener("click", async () => {
  const code = document.getElementById("new-course-code").value.trim();
  const name = document.getElementById("new-course-name").value.trim();
  const group = document.getElementById("new-study-group").value.trim();
  const key = document.getElementById("new-subject-key").value.trim();
  
  if (!key) return alert("กรุณากรอกชื่ออ้างอิงในระบบ");
  if (configs.find(c => c.subject === key)) return alert("ชื่อ Key นี้มีอยู่แล้ว");
  
  try {
    const res = await fetch(`/api/config/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_code: code,
        course_name: name,
        study_group: group,
        total_work: 30, total_mid: 20, total_jit: 20, total_final: 30,
        jit_config: { show_to_students: false, aspects: [] },
        url: '' // no URL needed, we don't use Google Sheets
      })
    });
    if (res.ok) {
      closeSubjectModal();
      currentSubject = key;
      await loadConfigs();
      document.getElementById("global-subject-filter").value = key;
      currentCfg = configs.find(c => c.subject === key);
      applyCurrentConfig();
      // Switch to settings tab
      document.querySelector('[data-tab="tab-settings"]').click();
    }
  } catch (err) { console.error(err); }
});

// =============================================
// BIND EVENTS
// =============================================
function bindEvents() {
  document.getElementById("global-subject-filter").addEventListener("change", e => {
    currentSubject = e.target.value;
    currentCfg = configs.find(c => c.subject === currentSubject) || null;
    applyCurrentConfig();
    loadAttendance();
  });
  
  document.getElementById("btn-add-subject").addEventListener("click", openSubjectModal);
  document.getElementById("subject-close-btn").addEventListener("click", closeSubjectModal);
  document.getElementById("subject-cancel-btn").addEventListener("click", closeSubjectModal);
  subjectOverlay.addEventListener("click", e => { if (e.target === subjectOverlay) closeSubjectModal(); });
  
  document.getElementById("btn-open-add").addEventListener("click", openAddModal);
  document.getElementById("modal-close-btn").addEventListener("click", closeScoreModal);
  document.getElementById("modal-cancel-btn").addEventListener("click", closeScoreModal);
  document.getElementById("score-modal-overlay").addEventListener("click", e => {
    if (e.target === document.getElementById("score-modal-overlay")) closeScoreModal();
  });
  
  document.getElementById("btn-open-upload").addEventListener("click", openUploadModal);
  document.getElementById("upload-close-btn").addEventListener("click", closeUploadModal);
  document.getElementById("upload-cancel-btn").addEventListener("click", closeUploadModal);
  uploadOverlay.addEventListener("click", e => { if (e.target === uploadOverlay) closeUploadModal(); });
  
  document.getElementById("btn-load-attendance").addEventListener("click", loadAttendance);
  document.getElementById("btn-save-attendance").addEventListener("click", saveAttendance);
  
  document.getElementById("search-input").addEventListener("input", renderTable);
  
  document.getElementById("btn-logout").addEventListener("click", async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });
}
