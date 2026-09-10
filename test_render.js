const fs = require('fs');
const students = JSON.parse(fs.readFileSync('data.json'));

const studentRollMap = new Map();
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

updateStudentRollNumbers();

function round1(n) { return (Math.round((n || 0) * 100) / 100).toFixed(2); }

// Test with subject filter
const selectedSubject = "วิชาโปรแกรมมัลติมีเดีย";
const filtered = students.filter(s => s.subject === selectedSubject);

filtered.sort((a, b) => {
  if (a.subject !== b.subject) {
    return (a.subject || '').localeCompare(b.subject || '', 'th');
  }
  const rollA = studentRollMap.get(`${a.subject || ''}__${a.id}`) || 0;
  const rollB = studentRollMap.get(`${b.subject || ''}__${b.id}`) || 0;
  if (rollA !== rollB) return rollA - rollB;
  return (a.id || '').localeCompare(b.id || '', undefined, { numeric: true });
});

console.log(`Filtered for "${selectedSubject}": ${filtered.length} students`);
filtered.slice(0, 5).forEach(s => {
  const rollNo = studentRollMap.get(`${s.subject || ''}__${s.id}`) || '-';
  const total = round1(s.work + s.mid + s.jit + s.final);
  console.log(`เลขที่ ${rollNo}: [${s.id}] ${s.name} - รวม: ${total}`);
});

console.log("...");
filtered.slice(-3).forEach(s => {
  const rollNo = studentRollMap.get(`${s.subject || ''}__${s.id}`) || '-';
  const total = round1(s.work + s.mid + s.jit + s.final);
  console.log(`เลขที่ ${rollNo}: [${s.id}] ${s.name} - รวม: ${total}`);
});
