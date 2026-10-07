const MAX = { work: 30, mid: 20, jit: 20, final: 30 };

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

function gradeClass(g) {
  if (g >= 3) return { bg: "var(--mint-dim)", fg: "var(--mint)" };
  if (g >= 1.5) return { bg: "var(--amber-dim)", fg: "var(--amber)" };
  return { bg: "var(--rose-dim)", fg: "var(--rose)" };
}

async function fetchStudentScore(id, subject) {
  try {
    let url = `/api/scores/${id}`;
    if (subject) url += `?subject=${encodeURIComponent(subject)}`;
    const res = await fetch(url);
    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch (err) {
    console.error("Error fetching score:", err);
    return null;
  }
}

const form = document.getElementById("search-form");
const input = document.getElementById("student-id");
const subjectFilter = document.getElementById("subject-filter");
const errorMsg = document.getElementById("error-msg");
const submitBtn = document.getElementById("submit-btn");

const searchView = document.getElementById("search-view");
const resultView = document.getElementById("result-view");

document.getElementById("back-btn").addEventListener("click", (e) => {
  e.preventDefault();
  resultView.classList.remove("show");
  searchView.classList.remove("hide");
  document.querySelector('.admin-login-btn').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

async function loadSubjects() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const configs = await res.json();
      if (configs.length > 0) {
        subjectFilter.innerHTML = '<option value="" disabled selected>-- โปรดเลือกวิชา --</option>';
        configs.forEach(c => {
          const opt = document.createElement("option");
          opt.value = c.subject;
          opt.textContent = c.subject;
          subjectFilter.appendChild(opt);
        });
      }
    }
  } catch (err) {
    console.error("Error loading subjects:", err);
  }
}
loadSubjects();

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "กำลังค้นหา..." : "ตรวจสอบคะแนน";
}

function round1(n) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function renderResult(id, data) {
  const isJitHidden = data.show_jit === false || data.jit === null || data.jit === undefined;
  const total = isJitHidden
    ? round1((data.work||0) + (data.mid||0) + (data.final||0))
    : round1((data.work||0) + (data.mid||0) + (data.jit||0) + (data.final||0));

  const grade = isJitHidden ? "-" : computeGrade(total);
  const gc = isJitHidden 
    ? { bg: "rgba(245, 158, 11, 0.15)", fg: "var(--gold-soft)" } 
    : gradeClass(grade);

  // Topbar
  document.getElementById("tb-name").textContent = data.name;
  document.getElementById("tb-code").textContent = id;
  document.getElementById("tb-total").textContent = isJitHidden 
    ? `รวม ${total} / 80 (รอจิตพิสัย)` 
    : `รวม ${total} / 100`;

  // Hero
  const heroSub = document.getElementById("hero-subject");
  if(heroSub) heroSub.textContent = data.subject || "ไม่ระบุวิชา";
  
  document.getElementById("hero-name").textContent = data.name;
  document.getElementById("hero-code").textContent = `รหัสประจำตัว ${id}`;

  const dialGrade = document.getElementById("dial-grade");
  if (dialGrade) {
    dialGrade.textContent = isJitHidden ? `รอสรุปจิตพิสัย` : `เกรด ${grade}`;
    dialGrade.style.background = gc.bg;
    dialGrade.style.color = gc.fg;
  }

  document.getElementById("dial-total").textContent = total;
  const dialSub = document.getElementById("dial-sub");
  if (dialSub) dialSub.textContent = isJitHidden ? "/ 80*" : "/ 100";

  const maxTotalForDial = isJitHidden ? 80 : 100;
  const circumference = 283;
  const offset = circumference - (Math.min(total, maxTotalForDial) / maxTotalForDial) * circumference;
  requestAnimationFrame(() => {
    const dial = document.getElementById("dial-fill");
    if (dial) {
      dial.style.strokeDashoffset = offset;
      dial.style.stroke = total >= (maxTotalForDial / 2) ? "var(--mint)" : "var(--rose)";
    }
  });

  // Metrics for work, mid, final
  ["work", "mid", "final"].forEach(key => {
    const val = data[key] || 0;
    const max = MAX[key];
    const mElem = document.getElementById(`m-${key}`);
    const svElem = document.getElementById(`sv-${key}`);
    if (mElem) mElem.textContent = round1(val);
    if (svElem) svElem.textContent = `${round1(val)} / ${max}`;
    const pct = Math.min(100, (val / max) * 100);
    requestAnimationFrame(() => {
      const mf = document.getElementById(`mf-${key}`);
      const sf = document.getElementById(`sf-${key}`);
      if(mf) mf.style.width = pct + "%";
      if(sf) sf.style.width = pct + "%";
    });
  });

  // JIT Metric Handling
  const mJit = document.getElementById("m-jit");
  const svJit = document.getElementById("sv-jit");
  const mfJit = document.getElementById("mf-jit");
  const sfJit = document.getElementById("sf-jit");

  if (isJitHidden) {
    if (mJit) {
      mJit.innerHTML = `<span style="font-size: 15px; font-weight: 500; color: var(--gold-soft);">🔒 รอสรุปปลายภาค</span>`;
    }
    if (svJit) {
      svJit.innerHTML = `<span style="color: var(--gold-soft); font-size: 12px;">🔒 รอสรุปปลายภาค (เต็ม 20)</span>`;
    }
    if (mfJit) mfJit.style.width = "0%";
    if (sfJit) sfJit.style.width = "0%";
  } else {
    const val = data.jit || 0;
    const max = MAX.jit;
    if (mJit) mJit.textContent = round1(val);
    if (svJit) svJit.textContent = `${round1(val)} / ${max}`;
    const pct = Math.min(100, (val / max) * 100);
    requestAnimationFrame(() => {
      if (mfJit) mfJit.style.width = pct + "%";
      if (sfJit) sfJit.style.width = pct + "%";
    });
  }

  // Summary Totals
  document.getElementById("sum-total").textContent = total;
  const sumTotalMax = document.getElementById("sum-total-max");
  if (sumTotalMax) sumTotalMax.textContent = isJitHidden ? " / 80" : " / 100";

  const sumJitNote = document.getElementById("sum-jit-note");
  if (sumJitNote) sumJitNote.style.display = isJitHidden ? "block" : "none";

  const sumGrade = document.getElementById("sum-grade");
  if (sumGrade) {
    sumGrade.textContent = isJitHidden ? `รอสรุปปลายภาค` : `เกรด ${grade}`;
    sumGrade.style.background = gc.bg;
    sumGrade.style.color = gc.fg;
  }



  // Attendance rendering
  const attSection = document.getElementById("section-attendance");
  if (attSection) {
    if (data.attendance) {
      attSection.style.display = "block";
      const att = data.attendance;
      const attPres = document.getElementById("att-present");
      const attLate = document.getElementById("att-late");
      const attAbs = document.getElementById("att-absent");
      const attLeave = document.getElementById("att-leave");
      if (attPres) attPres.textContent = att.present || 0;
      if (attLate) attLate.textContent = att.late || 0;
      if (attAbs) attAbs.textContent = att.absent || 0;
      if (attLeave) attLeave.textContent = att.leave || 0;
      
      const pct = typeof att.percent === 'number' ? att.percent : 100;
      const attPctText = document.getElementById("att-percent-text");
      if (attPctText) attPctText.textContent = pct.toFixed(1) + "%";
      
      const pctBar = document.getElementById("att-percent-bar");
      if (pctBar) {
        pctBar.style.width = Math.min(100, Math.max(0, pct)) + "%";
        pctBar.style.background = pct >= 80 
          ? "linear-gradient(90deg, var(--mint), #059669)" 
          : "linear-gradient(90deg, var(--rose), #dc2626)";
      }

      const statusBadge = document.getElementById("att-badge-status");
      if (statusBadge) {
        if (pct >= 80) {
          statusBadge.textContent = "✅ เวลาเรียนผ่านเกณฑ์";
          statusBadge.style.background = "rgba(16,185,129,0.15)";
          statusBadge.style.color = "var(--mint)";
        } else {
          statusBadge.textContent = "⚠️ เสี่ยง มส. (ต่ำกว่า 80%)";
          statusBadge.style.background = "rgba(239,68,68,0.15)";
          statusBadge.style.color = "var(--rose)";
        }
      }

      // Sessions grid
      const sessionsGrid = document.getElementById("att-sessions-grid");
      const toggleBtn = document.getElementById("att-toggle-sessions-btn");
      const sessionsContainer = document.getElementById("att-sessions-container");

      if (sessionsGrid && att.sessions && att.sessions.length > 0) {
        sessionsGrid.innerHTML = '';
        att.sessions.forEach(sess => {
          if (!sess.date && !sess.week) return;
          const div = document.createElement("div");
          div.style.cssText = "padding: 6px; border-radius: 8px; text-align: center; font-size: 11px; border: 1px solid var(--glass-border);";
          
          let stColor = "var(--ink-dim)";
          let stBg = "rgba(255,255,255,0.02)";
          let stText = "—";
          const v = (sess.val || '').trim();

          if (v === '1' || v.includes('มา')) {
            stColor = "var(--mint)";
            stBg = "rgba(16,185,129,0.1)";
            stText = "มา";
          } else if (v.includes('สาย')) {
            stColor = "var(--gold-soft)";
            stBg = "rgba(245,158,11,0.1)";
            stText = "สาย";
          } else if (v.includes('ขาด') || v === 'ข') {
            stColor = "var(--rose)";
            stBg = "rgba(239,68,68,0.1)";
            stText = "ขาด";
          } else if (v.includes('ลา') || v === 'ล') {
            stColor = "#818cf8";
            stBg = "rgba(99,102,241,0.1)";
            stText = "ลา";
          }

          div.style.background = stBg;
          div.innerHTML = `
            <div style="color: var(--ink-dim); font-size: 10px;">${sess.date || sess.week}</div>
            <div style="font-weight: 700; color: ${stColor}; margin-top: 2px;">${stText}</div>
          `;
          sessionsGrid.appendChild(div);
        });

        if (toggleBtn && sessionsContainer) {
          toggleBtn.onclick = () => {
            const isHidden = sessionsContainer.style.display === "none";
            sessionsContainer.style.display = isHidden ? "block" : "none";
            toggleBtn.textContent = isHidden ? "📅 ซ่อนรายละเอียดการเช็คชื่อ ▲" : "📅 ดูรายละเอียดการเช็คชื่อ ▼";
          };
        }
      }
    } else {
      attSection.style.display = "none";
    }
  }

  // Individual assignments & quizzes.  A blank cell in the source sheet is
  // intentionally shown as "ยังไม่มีคะแนน" so students can follow up on work
  // that may not have been submitted or has not yet been marked.
  const unitGrid = document.getElementById("unit-grid");
  const itemGrid = document.getElementById("item-grid");
  const assignments = Array.isArray(data.assignments) ? data.assignments : [];
  const isSummaryOrNote = (name) => {
    if (/ข้อกา|ข้อเขียน|ปรนัย|อัตนัย/.test(name)) return false;
    return /คะแนนเก็บ|คะแนนระหว่างเรียน|คะแนนรวม|รวมคะแนน|จิตพิสัย|ปลายภาค|เกรด|หมายเหตุ|^รวม(?:\s|$)/.test(name || '');
  };
  const isFinalPart = (item) => /ข้อกา|ข้อเขียน|ปรนัย|อัตนัย/i.test(item.name || '');
  const isTest = (item) => !isFinalPart(item) && (item.type === 'test' || /ทดสอบ|แบบสอบ|ข้อสอบ|สอบย่อย|quiz|(?:^|—\s*)(?:ก่อน|หลัง)\s*\d+\s*(?:ข้อ|คะแนน)?/i.test(item.name || ''));
  // Filter on the page too, so existing records immediately stop showing
  // summary columns even before the next data sync replaces them.
  const visibleItems = assignments.filter(item => !isSummaryOrNote(item.name));
  const finalParts = visibleItems.filter(isFinalPart).map(item => ({
    ...item,
    displayName: (item.name || '').replace(/^(?:สอบ)?ปลายภาค\s*—\s*/i, '')
  }));
  const tests = visibleItems.filter(isTest);
  const works = visibleItems.filter(item => !isFinalPart(item) && !isTest(item));
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  // Existing synced data can contain a short "หลัง 10 ข้อ" header because
  // Google Sheets exports merged cells only once.  Test columns are ordered
  // before/after within each unit, so use the preceding unit label to make the
  // result unambiguous without waiting for another sync.
  let currentUnitName = '';
  const testsWithUnitNames = tests.map(item => {
    const name = item.name || '';
    const unitMatch = name.match(/(?:แบบทดสอบ\s*)?หน่วย\s*(?:ที่\s*)?(\d+)/i);
    if (unitMatch) currentUnitName = `แบบทดสอบหน่วย ${unitMatch[1]}`;
    const isShortPreOrPost = /^(ก่อน|หลัง)\s*\d+\s*(?:ข้อ|คะแนน)?/i.test(name);
    return isShortPreOrPost && currentUnitName
      ? { ...item, displayName: `${currentUnitName} — ${name}` }
      : item;
  });
  const renderItems = (items) => items.map(item => {
    const name = item.displayName || item.name;
    const missing = item.score === null || item.score === undefined || item.status === 'missing';
    const score = missing ? '—' : round1(item.score);
    const max = item.max === null || item.max === undefined ? '' : ` / ${round1(item.max)}`;
    return `<div class="item-row glass ${missing ? 'item-row--missing' : ''}">
      <span class="t" title="${escapeHTML(name)}">${escapeHTML(name)}</span>
      <div class="r">
        <span class="sc ${missing ? 'missing' : ''}">${score}${max}</span>
        <span class="pill ${missing ? 'status-missing' : 'status-ok'}">${missing ? 'ยังไม่มีคะแนน' : 'มีคะแนนแล้ว'}</span>
      </div>
    </div>`;
  }).join('');

  const finalGrid = document.getElementById("final-grid");
  unitGrid.innerHTML = testsWithUnitNames.length ? renderItems(testsWithUnitNames) : '<p class="empty-items">ไม่มีข้อมูลแบบทดสอบรายข้อ</p>';
  itemGrid.innerHTML = works.length ? renderItems(works) : '<p class="empty-items">ไม่มีข้อมูลงานในชั้นเรียน</p>';
  if(finalGrid) finalGrid.innerHTML = finalParts.length ? renderItems(finalParts) : '<p class="empty-items">ไม่มีข้อมูลคะแนนสอบปลายภาค (ข้อกา/ข้อเขียน)</p>';

  // Hide assignment sections if no data
  const sectionQuiz = document.getElementById("section-quiz");
  const sectionWork = document.getElementById("section-work");
  const sectionFinal = document.getElementById("section-final-parts");
  if(sectionQuiz) sectionQuiz.style.display = '';
  if(sectionWork) sectionWork.style.display = '';
  if(sectionFinal) sectionFinal.style.display = finalParts.length > 0 ? '' : 'none';

  // Hide admin button when viewing result
  const adminBtn = document.querySelector('.admin-login-btn');
  if(adminBtn) adminBtn.style.display = 'none';

  searchView.classList.add("hide");
  resultView.classList.add("show");
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = input.value.trim();
  const subject = subjectFilter.value;
  errorMsg.classList.remove("show");

  if (!id || !subject) {
    errorMsg.textContent = "กรุณาเลือกวิชาและกรอกรหัสประจำตัวนักเรียน";
    errorMsg.classList.add("show");
    return;
  }

  setLoading(true);
  const data = await fetchStudentScore(id, subject);
  setLoading(false);

  if (!data) {
    errorMsg.textContent = "ไม่พบข้อมูลในวิชานี้ กรุณาตรวจสอบรหัสอีกครั้ง";
    errorMsg.classList.add("show");
    return;
  }

  renderResult(id, data);
});
