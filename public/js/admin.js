/* ============================================================
   ระบบตรวจสอบคะแนนนักเรียน — Admin page logic

   NOTE: ตอนนี้ยังไม่มี backend จริง จึงเก็บข้อมูลไว้ใน MOCK_DATA (in-memory)
   เมื่อเชื่อมต่อ API แล้ว ให้แทนที่ฟังก์ชัน loadStudents / saveStudent /
   deleteStudent ด้วยการเรียก GET/POST/DELETE /api/scores จริง
   ============================================================ */

let students = [];
let studentRollMap = new Map();

function updateStudentRollNumbers() {
  studentRollMap.clear();
  const bySubject = {};
  students.forEach(s => {
    const sub = s.subject || 'unknown';
    if (!bySubject[sub]) bySubject[sub] = [];
    bySubject[sub].push(s);
  });

  Object.values(bySubject).forEach(list => {
    list.sort((a, b) => (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }));
    list.forEach((s, idx) => {
      studentRollMap.set(`${s.subject || ''}__${s.id}`, idx + 1);
    });
  });
}

async function loadConfigs() {
  try {
    const res = await fetch('/api/config', { credentials: 'include' });
    if (res.ok) {
      currentConfigs = await res.json();
    }
  } catch (err) {
    console.error('Failed to load configs:', err);
  }
}

async function loadStudents() {
  try {
    await loadConfigs();
    const res = await fetch('/api/scores');
    if (res.ok) {
      students = await res.json();
      updateStudentRollNumbers();
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

function updateSubjectActionButtons() {
  const selectedSub = subjectFilter.value;
  const btnDel = document.getElementById("btn-delete-subject");
  const btnJit = document.getElementById("btn-toggle-jit");
  const thJitBtn = document.getElementById("th-jit-quick-btn");

  if (btnDel) {
    if (selectedSub) {
      btnDel.style.display = "inline-flex";
      btnDel.title = `ลบวิชา "${selectedSub}" และข้อมูลคะแนนทั้งหมด`;
    } else {
      btnDel.style.display = "none";
    }
  }

  if (selectedSub) {
    const conf = currentConfigs.find(c => c.subject === selectedSub);
    const isShowing = conf?.jit_config?.show_to_students === true;

    if (btnJit) {
      btnJit.style.display = "inline-flex";
      const icon = document.getElementById("jit-toggle-icon");
      const text = document.getElementById("jit-toggle-text");
      if (isShowing) {
        if (icon) icon.textContent = "👁️";
        if (text) text.textContent = "จิตพิสัย: แสดงให้นักเรียน";
        btnJit.style.borderColor = "rgba(16, 185, 129, 0.4)";
        btnJit.style.color = "var(--mint)";
        btnJit.style.background = "rgba(16, 185, 129, 0.08)";
        btnJit.title = `คลิกเพื่อ ซ่อน คะแนนจิตพิสัยวิชา "${selectedSub}" ไม่ให้นักเรียนเห็น`;
      } else {
        if (icon) icon.textContent = "🔒";
        if (text) text.textContent = "จิตพิสัย: ซ่อนจากนักเรียน";
        btnJit.style.borderColor = "rgba(245, 158, 11, 0.4)";
        btnJit.style.color = "var(--gold-soft)";
        btnJit.style.background = "rgba(245, 158, 11, 0.08)";
        btnJit.title = `คลิกเพื่อ เปิดเผย คะแนนจิตพิสัยวิชา "${selectedSub}" ให้นักเรียนเห็น`;
      }
    }

    if (thJitBtn) {
      thJitBtn.style.display = "inline-block";
      if (isShowing) {
        thJitBtn.textContent = "👁️ แสดงให้นักเรียน";
        thJitBtn.style.color = "var(--mint)";
        thJitBtn.style.background = "rgba(16, 185, 129, 0.2)";
        thJitBtn.title = "สถานะ: เปิดให้นักเรียนเห็นแล้ว (คลิกเพื่อซ่อน)";
      } else {
        thJitBtn.textContent = "🔒 ซ่อนจากนักเรียน";
        thJitBtn.style.color = "var(--gold-soft)";
        thJitBtn.style.background = "rgba(245, 158, 11, 0.2)";
        thJitBtn.title = "สถานะ: กำลังซ่อนจากนักเรียน (คลิกเพื่อเปิด)";
      }
    }
  } else {
    if (btnJit) btnJit.style.display = "none";
    if (thJitBtn) thJitBtn.style.display = "none";
  }
}

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
  updateSubjectActionButtons();
}

function renderTable() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedSubject = subjectFilter.value;
  
  const filtered = students.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(query) || s.id.includes(query);
    const matchSubject = !selectedSubject || s.subject === selectedSubject;
    return matchSearch && matchSubject;
  });

  // Sort students by subject, then by roll number (เลขที่) / ID
  filtered.sort((a, b) => {
    if (a.subject !== b.subject) {
      return (a.subject || '').localeCompare(b.subject || '', 'th');
    }
    const rollA = studentRollMap.get(`${a.subject || ''}__${a.id}`) || 0;
    const rollB = studentRollMap.get(`${b.subject || ''}__${b.id}`) || 0;
    if (rollA !== rollB) return rollA - rollB;
    return (a.id || '').localeCompare(b.id || '', undefined, { numeric: true });
  });

  tbody.innerHTML = "";

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">ไม่พบนักเรียนที่ค้นหา</td></tr>`;
  }

  filtered.forEach((s) => {
    const total = round1(s.work + s.mid + s.jit + s.final);
    const rollNo = studentRollMap.get(`${s.subject || ''}__${s.id}`) || '-';
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="text-align:center; font-family:var(--f-mono); font-size:13px; font-weight:600; color:var(--ink-dim);">${rollNo}</td>
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
        <button class="icon-btn" title="ดูรายละเอียด" onclick="showDetailsModal('${s.id}', '${(s.subject || '').replace(/'/g, "\\'")}')">
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

function showDetailsModal(id, subject) {
  const student = students.find(s => s.id === id && (!subject || s.subject === subject)) || students.find(s => s.id === id);
  if (!student) return;

  const rollNo = studentRollMap.get(`${student.subject || ''}__${student.id}`);
  document.getElementById("details-student-name").textContent = student.name;
  document.getElementById("details-student-id").textContent = `${rollNo ? `เลขที่: ${rollNo} | ` : ''}รหัสประจำตัว: ${student.id} | ${student.subject}`;

  let attendanceHtml = '';
  if (student.attendance) {
    const att = student.attendance;
    attendanceHtml = `
      <div style="background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.25); border-radius: 12px; padding: 14px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <h4 style="margin: 0; font-size: 14px; color: var(--mint);">📅 สถิติเวลาเรียน</h4>
          <span style="font-weight: 700; font-size: 14px; color: ${att.percent >= 80 ? 'var(--mint)' : 'var(--rose)'};">${(att.percent || 100).toFixed(1)}%</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; text-align: center; font-size: 12px;">
          <div style="background: rgba(255,255,255,0.03); padding: 8px 4px; border-radius: 8px;">
            <div style="color: var(--mint);">มาเรียน</div>
            <div style="font-weight: 700; font-size: 18px; margin-top: 2px;">${att.present || 0}</div>
          </div>
          <div style="background: rgba(255,255,255,0.03); padding: 8px 4px; border-radius: 8px;">
            <div style="color: var(--gold-soft);">สาย</div>
            <div style="font-weight: 700; font-size: 18px; margin-top: 2px;">${att.late || 0}</div>
          </div>
          <div style="background: rgba(255,255,255,0.03); padding: 8px 4px; border-radius: 8px;">
            <div style="color: var(--rose);">ขาด</div>
            <div style="font-weight: 700; font-size: 18px; margin-top: 2px;">${att.absent || 0}</div>
          </div>
          <div style="background: rgba(255,255,255,0.03); padding: 8px 4px; border-radius: 8px;">
            <div style="color: #818cf8;">ลา</div>
            <div style="font-weight: 700; font-size: 18px; margin-top: 2px;">${att.leave || 0}</div>
          </div>
        </div>
      </div>
    `;
  }

  const container = document.getElementById("details-assignments-container");
  if (!student.assignments || student.assignments.length === 0) {
    container.innerHTML = attendanceHtml + '<p style="text-align:center; opacity:0.5;">ไม่มีข้อมูลชิ้นงาน</p>';
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

    const renderCategoryTable = (title, items, colorVar) => {
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

    container.innerHTML = attendanceHtml + renderCategoryTable("แบบทดสอบ", tests, "mint") + renderCategoryTable("ใบงานและภาระงาน", works, "gold");
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
subjectFilter.addEventListener("change", () => {
  updateSubjectActionButtons();
  renderTable();
});

async function toggleJitVisibility(subject) {
  if (!subject) return;
  const conf = currentConfigs.find(c => c.subject === subject);
  const currentlyShowing = conf?.jit_config?.show_to_students === true;
  const targetShowing = !currentlyShowing;

  const confirmMsg = targetShowing
    ? `ต้องการ "เปิดเผย" คะแนนจิตพิสัยของวิชา "${subject}" ให้นักเรียนเห็นใช่หรือไม่?\n\n(ควรเปิดเมื่อสรุปคะแนนปลายภาคเรียบร้อยแล้ว)`
    : `ต้องการ "ซ่อน" คะแนนจิตพิสัยของวิชา "${subject}" ไม่ให้นักเรียนเห็นใช่หรือไม่?\n\n(นักเรียนจะเห็นสถานะเป็น "รอสรุปปลายภาค" และคะแนนรวมจะไม่ถูกนำจิตพิสัยมารวม)`;

  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch("/api/config/toggle-jit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ subject, show_to_students: targetShowing })
    });

    if (res.ok) {
      let existing = currentConfigs.find(c => c.subject === subject);
      if (!existing) {
        existing = { subject, url: '', jit_config: {} };
        currentConfigs.push(existing);
      }
      existing.jit_config = { ...existing.jit_config, show_to_students: targetShowing };

      updateSubjectActionButtons();
      alert(targetShowing 
        ? `✅ เปิดแสดงคะแนนจิตพิสัยวิชา "${subject}" ให้นักเรียนเห็นแล้ว` 
        : `🔒 ซ่อนคะแนนจิตพิสัยวิชา "${subject}" จากนักเรียนเรียบร้อยแล้ว`);
    } else {
      alert("ไม่สามารถเปลี่ยนสถานะได้ กรุณาลองใหม่อีกครั้ง");
    }
  } catch (err) {
    console.error(err);
    alert("เกิดข้อผิดพลาด: " + err.message);
  }
}

const btnToggleJit = document.getElementById("btn-toggle-jit");
if (btnToggleJit) {
  btnToggleJit.addEventListener("click", () => {
    toggleJitVisibility(subjectFilter.value);
  });
}

const thJitQuickBtn = document.getElementById("th-jit-quick-btn");
if (thJitQuickBtn) {
  thJitQuickBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleJitVisibility(subjectFilter.value);
  });
}

const btnDeleteSubject = document.getElementById("btn-delete-subject");
if (btnDeleteSubject) {
  btnDeleteSubject.addEventListener("click", async () => {
    const selectedSub = subjectFilter.value;
    if (!selectedSub) return;
    
    const count = students.filter(s => s.subject === selectedSub).length;
    const ok = confirm(
      `⚠️ ยืนยันการลบวิชา "${selectedSub}" หรือไม่?\n\nการดำเนินการนี้จะลบข้อมูลคะแนนและรายชื่อนักเรียนทั้งหมด (${count} คน) ของวิชานี้ออกจากระบบถาวร`
    );
    if (!ok) return;

    btnDeleteSubject.disabled = true;
    try {
      // 1. Delete scores for this subject
      const res = await fetch(`/api/scores/subject/${encodeURIComponent(selectedSub)}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      });

      // 2. Also remove from configs if exists
      const confRes = await fetch('/api/config', { credentials: 'include' });
      if (confRes.ok) {
        const confs = await confRes.json();
        const updatedConfs = confs.filter(c => c.subject !== selectedSub);
        if (updatedConfs.length !== confs.length) {
          await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(updatedConfs)
          });
        }
      }

      alert(`✅ ลบวิชา "${selectedSub}" และข้อมูลคะแนนเรียบร้อยแล้ว`);
      subjectFilter.value = "";
      await loadStudents();
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการลบวิชา: ' + err.message);
    } finally {
      btnDeleteSubject.disabled = false;
    }
  });
}

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
    const isShowing = c.jit_config?.show_to_students === true;
    const attUrl = c.attendance_url || c.jit_config?.attendance_url || '';
    addConfigRow(c.subject, c.url, isShowing, attUrl);
  });
}

function addConfigRow(subject = '', url = '', showToStudents = false, attendanceUrl = '') {
  const container = document.getElementById("sync-configs-container");
  const div = document.createElement("div");
  div.className = "field-group";
  div.style.marginBottom = "15px";
  div.style.paddingBottom = "15px";
  div.style.borderBottom = "1px solid var(--glass-border)";
  
  div.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <div style="display: flex; gap: 8px; align-items: center;">
        <input type="text" class="field config-subject" placeholder="ชื่อวิชา (เช่น การเขียนโปรแกรมเชิงวัตถุเบื้องต้น ธดท.2/2)" value="${subject}" style="flex: 1; font-weight: 500;">
        <button type="button" class="btn btn--ghost" style="color:var(--rose); padding: 0 12px; border: 1px solid rgba(239,68,68,0.2);" aria-label="ลบ" onclick="this.parentElement.parentElement.parentElement.remove()">🗑</button>
      </div>
      <div>
        <label style="font-size: 11px; color: var(--ink-dim); display: block; margin-bottom: 2px;">📊 ลิงก์ Google Sheets คะแนน:</label>
        <input type="text" class="field config-url" placeholder="วางลิงก์ Google Sheets คะแนน..." value="${url}" style="width: 100%; font-size: 13px;">
      </div>
      <div>
        <label style="font-size: 11px; color: var(--ink-dim); display: block; margin-bottom: 2px;">📅 ลิงก์ Google Sheets เช็คชื่อเข้าเรียน (ถ้ามี):</label>
        <input type="text" class="field config-att-url" placeholder="วางลิงก์ Google Sheets เช็คชื่อ (รวม ?gid=... ของแผ่นงานนั้น)..." value="${attendanceUrl}" style="width: 100%; font-size: 13px;">
      </div>
      <label style="display: inline-flex; align-items: center; gap: 8px; margin-top: 4px; font-size: 13px; cursor: pointer; color: var(--ink-dim); user-select: none;">
        <input type="checkbox" class="config-show-jit" ${showToStudents ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px; accent-color: var(--mint);">
        <span>👁️ เปิดให้นักเรียนเห็นคะแนนจิตพิสัย (ติ๊กเมื่อสรุปคะแนนปลายภาค)</span>
      </label>
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
    let url = r.querySelector(".config-url").value.trim();
    let attUrl = r.querySelector(".config-att-url")?.value.trim() || '';
    const showToStudents = r.querySelector(".config-show-jit")?.checked === true;
    if (subject && (url || attUrl)) {
      if (url && url.includes('/edit')) {
        const gidMatch = url.match(/gid=([a-zA-Z0-9]+)/);
        url = url.replace(/\/edit.*$/, '/export?format=csv');
        if (gidMatch) url += '&gid=' + gidMatch[1];
      }
      if (attUrl && attUrl.includes('/edit')) {
        const gidMatch = attUrl.match(/gid=([a-zA-Z0-9]+)/);
        attUrl = attUrl.replace(/\/edit.*$/, '/export?format=csv');
        if (gidMatch) attUrl += '&gid=' + gidMatch[1];
      }
      newConfigs.push({ 
        subject, 
        url,
        attendance_url: attUrl,
        jit_config: { 
          show_to_students: showToStudents,
          attendance_url: attUrl
        }
      });
    }
  });

  // ตรวจหาว่ามีวิชาใดที่เคยมีอยู่ (ใน configs เดิม หรือในตารางคะแนน) แต่ถูกนำออกไปบ้าง
  const prevSubjects = (currentConfigs || []).map(c => c.subject).filter(Boolean);
  const existingScoreSubjects = (students || []).map(s => s.subject).filter(Boolean);
  const allKnownSubjects = [...new Set([...prevSubjects, ...existingScoreSubjects])];
  const newSubjectNames = newConfigs.map(c => c.subject);
  const removedSubjects = allKnownSubjects.filter(sub => !newSubjectNames.includes(sub));

  let deleteSubjects = [];
  if (removedSubjects.length > 0) {
    const listText = removedSubjects.map(s => `• ${s}`).join('\n');
    const confirmed = confirm(
      `⚠️ ตรวจพบว่าวิชาต่อไปนี้ถูกนำออกจากการตั้งค่า:\n\n${listText}\n\nคุณต้องการ "ลบข้อมูลคะแนนและรายชื่อนักเรียน" ของวิชาดังกล่าวออกจากฐานข้อมูลด้วยหรือไม่?\n\n- กด "ตกลง" (OK): เพื่อลบข้อมูลคะแนนของวิชาที่เอาออกทันที\n- กด "ยกเลิก" (Cancel): หากต้องการเก็บข้อมูลคะแนนไว้`
    );
    if (confirmed) {
      deleteSubjects = removedSubjects;
    }
  }

  const btn = document.getElementById("sync-save-btn");
  btn.disabled = true;
  btn.textContent = "กำลังบันทึก...";

  try {
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        configs: newConfigs,
        deleteSubjects: deleteSubjects
      })
    });
    
    if (res.status === 401) {
      alert("หมดเวลาเซสชั่น กรุณาเข้าสู่ระบบใหม่");
      window.location.href = "/login.html";
      return;
    }
    
    if (res.ok) {
      if (deleteSubjects.length > 0) {
        alert(`✅ บันทึกการตั้งค่าแล้ว และลบข้อมูลคะแนนของ ${deleteSubjects.length} วิชาที่นำออกเรียบร้อยแล้ว`);
      } else {
        alert("✅ บันทึกการตั้งค่าแล้ว");
      }
      closeSyncSettings();
      await loadStudents();
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
