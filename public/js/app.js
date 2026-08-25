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
  const total = data.total !== undefined ? round1(data.total) : round1((data.work||0) + (data.mid||0) + (data.jit||0) + (data.final||0));
  const grade = computeGrade(total);
  const gc = gradeClass(grade);

  // Topbar
  document.getElementById("tb-name").textContent = data.name;
  document.getElementById("tb-code").textContent = id;
  document.getElementById("tb-total").textContent = `รวม ${total} / 100`;

  // Hero
  const heroSub = document.getElementById("hero-subject");
  if(heroSub) heroSub.textContent = data.subject || "ไม่ระบุวิชา";
  
  document.getElementById("hero-name").textContent = data.name;
  document.getElementById("hero-code").textContent = `รหัสประจำตัว ${id}`;

  const dialGrade = document.getElementById("dial-grade");
  dialGrade.textContent = `เกรด ${grade}`;
  dialGrade.style.background = gc.bg;
  dialGrade.style.color = gc.fg;

  document.getElementById("dial-total").textContent = total;
  const circumference = 283;
  const offset = circumference - (Math.min(total, 100) / 100) * circumference;
  requestAnimationFrame(() => {
    const dial = document.getElementById("dial-fill");
    if (dial) {
      dial.style.strokeDashoffset = offset;
      dial.style.stroke = total >= 50 ? "var(--mint)" : "var(--rose)";
    }
  });

  // Metrics
  ["work", "mid", "jit", "final"].forEach(key => {
    const val = data[key] || 0;
    const max = MAX[key];
    document.getElementById(`m-${key}`).textContent = round1(val);
    document.getElementById(`sv-${key}`).textContent = `${round1(val)} / ${max}`;
    const pct = Math.min(100, (val / max) * 100);
    requestAnimationFrame(() => {
      const mf = document.getElementById(`mf-${key}`);
      const sf = document.getElementById(`sf-${key}`);
      if(mf) mf.style.width = pct + "%";
      if(sf) sf.style.width = pct + "%";
    });
  });

  document.getElementById("sum-total").textContent = total;
  const sumGrade = document.getElementById("sum-grade");
  sumGrade.textContent = `เกรด ${grade}`;
  sumGrade.style.background = gc.bg;
  sumGrade.style.color = gc.fg;

  // Individual assignments & quizzes.  A blank cell in the source sheet is
  // intentionally shown as "ยังไม่มีคะแนน" so students can follow up on work
  // that may not have been submitted or has not yet been marked.
  const unitGrid = document.getElementById("unit-grid");
  const itemGrid = document.getElementById("item-grid");
  const assignments = Array.isArray(data.assignments) ? data.assignments : [];
  const isSummaryOrNote = (name) => /คะแนนเก็บ|คะแนนระหว่างเรียน|คะแนนรวม|รวมคะแนน|จิตพิสัย|ปลายภาค|เกรด|หมายเหตุ|^รวม(?:\s|$)/.test(name || '');
  const isTest = (item) => item.type === 'test' || /ทดสอบ|แบบสอบ|ข้อสอบ|สอบย่อย|quiz|(?:^|—\s*)(?:ก่อน|หลัง)\s*\d+\s*(?:ข้อ|คะแนน)?/i.test(item.name || '');
  // Filter on the page too, so existing records immediately stop showing
  // summary columns even before the next data sync replaces them.
  const visibleItems = assignments.filter(item => !isSummaryOrNote(item.name));
  const tests = visibleItems.filter(isTest);
  const works = visibleItems.filter(item => !isTest(item));
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

  unitGrid.innerHTML = testsWithUnitNames.length ? renderItems(testsWithUnitNames) : '<p class="empty-items">ไม่มีข้อมูลแบบทดสอบรายข้อ</p>';
  itemGrid.innerHTML = works.length ? renderItems(works) : '<p class="empty-items">ไม่มีข้อมูลงานในชั้นเรียน</p>';

  // Hide assignment sections if no data
  const sectionQuiz = document.getElementById("section-quiz");
  const sectionWork = document.getElementById("section-work");
  if(sectionQuiz) sectionQuiz.style.display = '';
  if(sectionWork) sectionWork.style.display = '';

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
