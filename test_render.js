const fs = require('fs');
const students = JSON.parse(fs.readFileSync('data.json'));
let errCount = 0;
try {
  const query = "";
  const filtered = students.filter(
    (s) => s.name.toLowerCase().includes(query) || s.id.includes(query)
  );
  
  function round1(n) { return Math.round(n * 10) / 10; }
  function computeGrade(total) { return 0; }
  function gradeBadgeClass(grade) { return "badge"; }
  
  filtered.forEach((s) => {
    const total = round1(s.work + s.mid + s.jit + s.final);
    const grade = computeGrade(total);
    // string template
    const html = `
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
    `;
  });
  console.log("SUCCESS! Students processed:", filtered.length);
} catch (e) {
  console.error("CRASH:", e);
}
