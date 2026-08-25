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

  // Assignments & Quizzes
  const unitGrid = document.getElementById("unit-grid");
  const itemGrid = document.getElementById("item-grid");

  if (data.assignments) {
    const tests = data.assignments.filter(a => a.name.includes("ทดสอบ") || a.name.includes("สอบ"));
    const works = data.assignments.filter(a => !a.name.includes("ทดสอบ") && !a.name.includes("สอบ"));

    const quizzesByUnit = {};
    const standaloneTests = [];

    tests.forEach(t => {
      const match = t.name.match(/หน่วย\s*(ที่\s*)?(\d+)/);
      if (match) {
        const unitNum = match[2];
        const unitName = `หน่วยที่ ${unitNum}`;
        if (!quizzesByUnit[unitName]) quizzesByUnit[unitName] = { unit: unitName, pre: null, post: null };

        const isPre = t.name.includes("ก่อน");
        let max = 10;
        const maxMatch = t.name.match(/(\d+)\s*ข้อ/);
        if (maxMatch) max = parseInt(maxMatch[1], 10);
        else {
          const m = t.name.match(/หลัง\s*(\d+)/) || t.name.match(/ก่อน\s*(\d+)/);
          if (m) max = parseInt(m[1], 10);
        }

        const label = t.name.replace(/แบบทดสอบหน่วย(ที่)?\s*\d+\s*/, "").replace(/[\(\)]/g, "").trim() || (isPre ? "ก่อนเรียน" : "หลังเรียน");
        const val = t.status === "submitted" ? t.score : null;
        
        // We will assign it to pre or post based on name, if both are populated we just add it to post
        if (isPre) {
          if(!quizzesByUnit[unitName].pre) quizzesByUnit[unitName].pre = { label, val, max };
        } else {
          quizzesByUnit[unitName].post = { label, val, max };
        }
      } else {
        standaloneTests.push(t);
      }
    });

    const quizList = Object.values(quizzesByUnit);

    if (quizList.length > 0) {
      unitGrid.innerHTML = quizList.map(q => `
        <div class="unit-card glass">
          <p class="u-title">${q.unit}</p>
          <div class="chip-row">
            ${[q.pre, q.post].filter(Boolean).map(part => `
              <div class="chip ${part.val === null ? 'missing' : ''}">
                <div class="c-label">
                  <span>${part.label}</span>
                  <span class="c-status ${part.val === null ? 'status-missing' : 'status-ok'}">${part.val === null ? 'ยังไม่ส่ง' : 'ส่งแล้ว'}</span>
                </div>
                <div class="c-val">${part.val === null ? '—' : part.val} <span style="font-size:11px; color:var(--ink-dim); font-weight:400;">/ ${part.max}</span></div>
              </div>
            `).join("")}
          </div>
        </div>
      `).join("");
    } else {
      unitGrid.innerHTML = `<p style="color:var(--ink-dim); font-size:14px; padding:10px;">ไม่มีข้อมูลแบบทดสอบรายหน่วย</p>`;
    }

    const allWorks = [...works, ...standaloneTests];
    if (allWorks.length > 0) {
      itemGrid.innerHTML = allWorks.map(it => {
        const isSubmitted = it.status === 'submitted';
        const val = isSubmitted ? it.score : null;
        return `
          <div class="item-row glass">
            <span class="t" title="${it.name}">${it.name}</span>
            <div class="r">
              <span class="sc ${val === null ? 'missing' : ''}">${val === null ? '—' : val}</span>
              <span class="pill ${val === null ? 'status-missing' : 'status-ok'}">${val === null ? 'ยังไม่ส่ง' : 'ส่งแล้ว'}</span>
            </div>
          </div>
        `;
      }).join("");
    } else {
      itemGrid.innerHTML = `<p style="color:var(--ink-dim); font-size:14px; padding:10px;">ไม่มีข้อมูลภาระงาน</p>`;
    }
  }

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
