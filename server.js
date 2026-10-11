require('dotenv').config();
// Polyfill fetch for Node.js < 18 (Vercel may use older Node version)
if (!globalThis.fetch) {
  const nodeFetch = require('node-fetch');
  globalThis.fetch = nodeFetch;
  globalThis.Headers = nodeFetch.Headers;
  globalThis.Request = nodeFetch.Request;
  globalThis.Response = nodeFetch.Response;
}
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase setup — always use known-correct values
// NOTE: env var SUPABASE_URL was incorrectly set to .com instead of .co on Vercel
const supabaseUrl = 'https://ttgjkcnrujczzhsboatm.supabase.co';
const supabaseKey = 'sb_publishable_2j3oXeUH5s_em-r2JuMj0g_I3tGVkmJ';
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json());

// Debug endpoint — remove after fix
app.get('/api/debug', async (req, res) => {
  const info = {
    nodeVersion: process.version,
    hasFetch: typeof fetch !== 'undefined',
    supabaseUrl: supabaseUrl,
    supabaseKeyLen: supabaseKey.length,
    env_SUPABASE_URL: process.env.SUPABASE_URL || '(not set)',
    env_SUPABASE_KEY_len: (process.env.SUPABASE_KEY || '').length
  };
  try {
    const testRes = await fetch(`${supabaseUrl}/rest/v1/scores?select=id&limit=1`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    info.supabaseStatus = testRes.status;
    info.supabaseOk = testRes.ok;
    const text = await testRes.text();
    info.supabaseResponse = text.substring(0, 200);
  } catch(e) {
    info.supabaseError = e.message;
  }
  res.json(info);
});

// Cookie Parsing Helper
function parseCookies(request) {
  const list = {};
  const cookieHeader = request.headers?.cookie;
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach(function(cookie) {
      let [ name, ...rest] = cookie.split('=');
      name = name?.trim();
      if (!name) return;
      const value = rest.join('=').trim();
      if (!value) return;
      list[name] = decodeURIComponent(value);
  });
  return list;
}

// Cookie Auth Middleware
const cookieAuth = (req, res, next) => {
  const cookies = parseCookies(req);
  const token = cookies['admin_token'];
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'password';
  const expectedToken = Buffer.from(`${adminUser}:${adminPass}`).toString('base64');
  
  if (token === expectedToken) {
    return next();
  }

  // If asking for an HTML page, redirect to login
  if (req.path === '/admin.html' || req.path === '/history.html') {
    return res.redirect('/login.html');
  }
  
  // Otherwise it's an API request
  res.status(401).json({ error: 'Authentication required' });
};

// API: Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'password';

  if (username === adminUser && password === adminPass) {
    const token = Buffer.from(`${username}:${password}`).toString('base64');
    res.setHeader('Set-Cookie', `admin_token=${token}; Max-Age=${7 * 24 * 60 * 60}; HttpOnly; SameSite=Lax; Path=/`);
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', `admin_token=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/`);
  res.json({ success: true });
});

// Protect admin pages BEFORE static middleware
app.get('/admin.html', cookieAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/history.html', cookieAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'history.html'));
});

app.use(express.static('public'));

// Setup multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// GET /api/scores - Get all scores
app.get('/api/scores', async (req, res) => {
  // Auto-sync if data is older than interval
  try {
    await checkAndAutoSync(null);
  } catch (e) {
    console.warn('[Auto-Sync] Error during scores fetch:', e.message);
  }

  const { data, error } = await supabase.from('scores').select('*').order('id', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  
  const formatted = (data || []).map(s => ({
    ...s,
    attendance: s.jit_scores?.attendance || null
  }));
  res.json(formatted);
});

// GET /api/scores/sync-status - Check current sync status and latest update times
app.get('/api/scores/sync-status', async (req, res) => {
  const { data } = await supabase
    .from('scores')
    .select('subject, updated_at')
    .order('updated_at', { ascending: false })
    .limit(10);

  res.json({
    interval_minutes: AUTO_SYNC_INTERVAL_MINUTES,
    last_global_sync: lastGlobalSyncTime ? new Date(lastGlobalSyncTime).toISOString() : null,
    recent_db_updates: data
  });
});

// GET /api/scores/:id - Get a single student's score
app.get('/api/scores/:id', async (req, res) => {
  const subject = req.query.subject;

  // Smart Auto-Sync: automatically sync if data is older than interval (e.g. 5 mins)
  try {
    await checkAndAutoSync(subject || null);
  } catch (e) {
    console.warn('[Auto-Sync] Error during student score lookup:', e.message);
  }

  let query = supabase.from('scores').select('*').eq('id', req.params.id);
  if (subject) {
    query = query.eq('subject', subject.trim());
  }
  
  let { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  
  // If no match found and a subject filter was provided, try fuzzy/partial match on subject name
  if ((!data || data.length === 0) && subject) {
    const cleanSub = subject.trim();
    const { data: fuzzyData } = await supabase
      .from('scores')
      .select('*')
      .eq('id', req.params.id)
      .ilike('subject', `%${cleanSub}%`);
    if (fuzzyData && fuzzyData.length > 0) {
      data = fuzzyData;
    }
  }

  if (data && data.length > 0) {
    const student = { ...data[0] };
    // Log access to login_history
    supabase.from('login_history').insert({
      student_id: student.id,
      student_name: student.name,
      subject: student.subject
    }).then(({ error }) => {
      if (error) console.error("Error logging history:", error.message);
    });

    // Check if jit should be shown to student
    const cookies = parseCookies(req);
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASS || 'password';
    const expectedToken = Buffer.from(`${adminUser}:${adminPass}`).toString('base64');
    const isAdmin = cookies.admin_token === expectedToken;

    if (!isAdmin && student.subject) {
      const { data: confData } = await supabase
        .from('configs')
        .select('jit_config')
        .eq('subject', student.subject)
        .maybeSingle();

      const showToStudents = confData?.jit_config?.show_to_students === true;
      if (!showToStudents) {
        student.show_jit = false;
        student.jit = null; // Mask jit score from student
        student.total = (student.work || 0) + (student.mid || 0) + (student.final || 0);
      } else {
        student.show_jit = true;
      }
    } else {
      student.show_jit = true;
    }

    student.attendance = student.jit_scores?.attendance || null;

    // Find other subjects this student is enrolled in for Quick Switch
    try {
      const { data: otherRecords } = await supabase
        .from('scores')
        .select('subject')
        .eq('id', student.id);
      
      if (otherRecords && otherRecords.length > 1) {
        student.other_subjects = [...new Set(otherRecords.map(r => r.subject))].filter(sub => sub !== student.subject);
      } else {
        student.other_subjects = [];
      }
    } catch(e) {
      student.other_subjects = [];
    }

    res.json(student); // Return the first match if multiple
  } else {
    // Check if the student ID exists in any other subjects to provide helpful guidance
    try {
      const { data: anySubjects } = await supabase
        .from('scores')
        .select('subject, name')
        .eq('id', req.params.id);

      if (anySubjects && anySubjects.length > 0) {
        const studentName = anySubjects[0].name;
        const enrolled = [...new Set(anySubjects.map(r => r.subject))];
        return res.status(404).json({
          error: 'Student not in this subject',
          student_id: req.params.id,
          student_name: studentName,
          enrolled_subjects: enrolled
        });
      }
    } catch (_) {}

    res.status(404).json({ error: 'Student not found' });
  }
});

// POST /api/scores - Add or Update a single score manually
app.post('/api/scores', cookieAuth, async (req, res) => {
  const studentData = {
    id: req.body.id,
    subject: req.body.subject || 'Default',
    name: req.body.name,
    work: parseFloat(req.body.work) || 0,
    mid: parseFloat(req.body.mid) || 0,
    jit: parseFloat(req.body.jit) || 0,
    final: parseFloat(req.body.final) || 0,
  };
  studentData.total = studentData.work + studentData.mid + studentData.jit + studentData.final;

  const { error } = await supabase.from('scores').upsert(studentData, { onConflict: 'id, subject' });
  if (error) return res.status(500).json({ error: error.message });
  
  res.json({ success: true, message: 'Score saved' });
});

// DELETE /api/scores/:id - Delete a score
app.delete('/api/scores/:id', cookieAuth, async (req, res) => {
  // In a real app, you might also need the subject to delete a specific row
  // Here we just delete all records for this student id
  const { error } = await supabase.from('scores').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, message: 'Score deleted' });
});

// GET /api/history/login - Get login history
app.get('/api/history/login', cookieAuth, async (req, res) => {
  const { data, error } = await supabase.from('login_history').select('*').order('login_time', { ascending: false }).limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/history/login - Clear login history
app.delete('/api/history/login', cookieAuth, async (req, res) => {
  const { error } = await supabase.from('login_history').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, message: 'Login history cleared' });
});

// GET /api/config - Get sync configurations
app.get('/api/config', async (req, res) => {
  const { data, error } = await supabase.from('configs').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/subjects - Get all distinct subjects (from both configs and scores)
app.get('/api/subjects', async (req, res) => {
  try {
    const [cfgRes, scoreRes] = await Promise.all([
      supabase.from('configs').select('subject'),
      supabase.from('scores').select('subject')
    ]);
    const cfgSubs = (cfgRes.data || []).map(c => c.subject).filter(Boolean);
    const scoreSubs = (scoreRes.data || []).map(s => s.subject).filter(Boolean);
    const allSubs = [...new Set([...cfgSubs, ...scoreSubs])];
    res.json(allSubs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/config - Save sync configurations
app.post('/api/config', cookieAuth, async (req, res) => {
  let configs = [];
  let deleteSubjects = [];

  if (Array.isArray(req.body)) {
    configs = req.body;
  } else if (req.body && typeof req.body === 'object') {
    configs = Array.isArray(req.body.configs) ? req.body.configs : [];
    deleteSubjects = Array.isArray(req.body.deleteSubjects) ? req.body.deleteSubjects : [];
  } else {
    return res.status(400).json({ error: 'Expected an array of configs or { configs, deleteSubjects }' });
  }

  // Delete scores for removed subjects if requested
  if (deleteSubjects.length > 0) {
    const { error: delScoresErr } = await supabase
      .from('scores')
      .delete()
      .in('subject', deleteSubjects);
    if (delScoresErr) {
      console.error('[Config] Error deleting scores for removed subjects:', delScoresErr);
    }
  }

  // First, delete all existing configs (simple replacement strategy)
  await supabase.from('configs').delete().neq('subject', 'xxxxxx');

  if (configs.length > 0) {
    const formattedConfigs = configs.map(c => ({
      subject: c.subject,
      url: c.url || '',
      jit_config: {
        ...(c.jit_config || {}),
        show_to_students: c.show_to_students === true || c.jit_config?.show_to_students === true,
        attendance_url: c.attendance_url || c.jit_config?.attendance_url || ''
      }
    }));
    const { error } = await supabase.from('configs').insert(formattedConfigs);
    if (error) return res.status(500).json({ error: error.message });
  }

  res.json({ success: true, message: 'Config saved', deleteSubjects });
});

// POST /api/config/toggle-jit - Quick toggle for jit score visibility for a subject
app.post('/api/config/toggle-jit', cookieAuth, async (req, res) => {
  const { subject, show_to_students } = req.body;
  if (!subject) return res.status(400).json({ error: 'Subject is required' });

  const { data: conf, error: findErr } = await supabase
    .from('configs')
    .select('*')
    .eq('subject', subject)
    .maybeSingle();

  if (findErr) return res.status(500).json({ error: findErr.message });

  const currentJitConfig = conf?.jit_config || {};
  const willShow = typeof show_to_students === 'boolean' 
    ? show_to_students 
    : !(currentJitConfig.show_to_students === true);

  const newJitConfig = {
    ...currentJitConfig,
    show_to_students: willShow
  };

  if (conf) {
    const { error: updateErr } = await supabase
      .from('configs')
      .update({ jit_config: newJitConfig })
      .eq('subject', subject);
    if (updateErr) return res.status(500).json({ error: updateErr.message });
  } else {
    const { error: insErr } = await supabase
      .from('configs')
      .upsert({ subject, url: '', jit_config: newJitConfig });
    if (insErr) return res.status(500).json({ error: insErr.message });
  }

  res.json({ success: true, subject, show_to_students: willShow });
});

// DELETE /api/scores/subject/:subject - Delete all scores for a specific subject
app.delete('/api/scores/subject/:subject', cookieAuth, async (req, res) => {
  const subject = decodeURIComponent(req.params.subject);
  const { error } = await supabase.from('scores').delete().eq('subject', subject);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, message: `All scores for ${subject} deleted` });
});

// CSV Parsing Helpers
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i+1] === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function processCSVContent(content, subject) {
  let inQuotes = false;
  let cleanContent = '';
  for(let i=0; i<content.length; i++){
    if(content[i] === '"') inQuotes = !inQuotes;
    if(content[i] === '\n' && inQuotes) {
      cleanContent += ' ';
    } else {
      cleanContent += content[i];
    }
  }

  const lines = cleanContent.split('\n').map(l => l.trim()).filter(Boolean);
  const records = lines.map(parseCSVLine);

  let dataStartIndex = -1;
  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    if (row[1] && row[1].match(/^\d{11}$/)) {
      dataStartIndex = i;
      break;
    }
  }

  if (dataStartIndex === -1) {
    throw new Error('ไม่พบรูปแบบตารางคะแนนที่รองรับในไฟล์ CSV นี้');
  }

  const subHeaderIndex = dataStartIndex - 1;

  // 1. Identify summary columns accurately with priority matching
  let workCol = -1, midCol = -1, jitCol = -1, finalCol = -1, totalCol = -1;

  for (let c = 4; c < (records[subHeaderIndex] || []).length; c++) {
    for (let r = 1; r <= subHeaderIndex; r++) {
      const val = (records[r][c] || '').trim();
      if ((val === 'รวมงาน' || val === 'คะแนนเก็บ' || val.includes('รวมคะแนนงาน')) && workCol === -1) workCol = c;
      if ((val === 'รวมทดสอบ' || val === 'ระหว่างเรียน' || val === 'รวมระหว่างเรียน') && midCol === -1) midCol = c;
      if ((val === 'รวมจิตพิสัย' || val === 'จิตพิสัย') && !val.includes('ด้าน') && !/^\d+\./.test(val) && jitCol === -1) jitCol = c;
      if ((val === 'รวมปลายภาค' || val === 'ปลายภาค') && !val.includes('ทฤษฎี') && !val.includes('ปฏิบัติ') && finalCol === -1) finalCol = c;
      if ((val === 'รวมทั้งสิ้น' || val === 'คะแนนรวม' || val === 'รวมคะแนน') && totalCol === -1) totalCol = c;
    }
  }

  const summaryColumns = new Set([workCol, midCol, jitCol, finalCol, totalCol].filter(x => x !== -1));

  // 2. Build assignment columns definitions
  let currentCategory = '';
  let currentUnit = '';
  const assignmentColumns = [];

  for (let c = 4; c < (records[subHeaderIndex] || []).length; c++) {
    if (summaryColumns.has(c)) continue;

    const r1 = records[1] && records[1][c] ? records[1][c].trim() : '';
    if (r1) currentCategory = r1;

    const r2 = records[2] && records[2][c] ? records[2][c].trim() : '';
    if (r2 && /หน่วย\s*(?:ที่\s*)?\d+/i.test(r2)) currentUnit = r2;

    const r3 = records[3] && records[3][c] ? records[3][c].trim() : '';

    if (/^(ลำดับ|รหัส|ชื่อ|นามสกุล|ชื่อเล่น|ห้อง|ชั้น|กลุ่ม|เลขที่|วันที่|เดือน|วัน\/เดือน)(\s|$)/i.test(r2)) continue;
    if (/^(วันที่|เดือน|วัน\/เดือน|วัน\/เดือน\/ปี)$/i.test((r2 || '').trim()) || /^(วันที่|เดือน|วัน\/เดือน|วัน\/เดือน\/ปี)$/i.test((r3 || '').trim())) continue;
    if (/วินัย|ซื่อสัตย์|รับผิดชอบ|ใฝ่รู้|เข้าเรียน/.test(r2)) continue;
    if (r2.includes('หมายเหตุ') || r2.includes('ลำดับ')) continue;

    let colName = '';
    let max = null;
    let type = 'work';

    if (/ก่อน|หลัง/i.test(r3)) {
      type = 'test';
      colName = (currentUnit ? currentUnit + ' — ' : '') + r3;
      const m = r3.match(/\d+(?:\.\d+)?/);
      if (m) max = parseFloat(m[0]);
    } else if (/ทฤษฎี|ปฏิบัติ/i.test(r2)) {
      type = 'final';
      colName = 'สอบปลายภาค — ' + r2;
      const m = r3.match(/\d+(?:\.\d+)?/);
      if (m) max = parseFloat(m[0]);
    } else if (r2.includes('งานที่') || currentCategory.includes('งาน')) {
      type = 'work';
      colName = r2 || ('งานคอลัมน์ ' + c);
      const m = r3.match(/\d+(?:\.\d+)?/);
      if (m && r3 !== '-') max = parseFloat(m[0]);
    } else if (r2.includes('คะแนนพิเศษ')) {
      type = 'work';
      colName = 'คะแนนพิเศษ';
    } else {
      colName = [r2, r3].filter(x => x && x !== '-').join(' ');
      const m = (r3 || r2).match(/(?:เต็ม|คะแนน|ข้อ)\s*(\d+(?:\.\d+)?)/);
      if (m) max = parseFloat(m[1]);
    }

    if (colName) {
      assignmentColumns.push({ index: c, name: colName, max, type });
    }
  }

  const parseAssignmentScore = (value) => {
    const text = (value || '').trim();
    if (text === '' || text === '-') return null;
    const score = Number.parseFloat(text.replace(/,/g, ''));
    return Number.isFinite(score) ? score : null;
  };

  const parsedStudents = [];
  for (let i = dataStartIndex; i < records.length; i++) {
    const row = records[i];
    if (!row[1] || !row[1].match(/^\d{11}$/)) continue;

    const id = row[1].trim();
    const name = row[2].trim();

    let work = workCol !== -1 ? (parseFloat((row[workCol] || '').trim()) || 0) : 0;
    let mid = midCol !== -1 ? (parseFloat((row[midCol] || '').trim()) || 0) : 0;
    let jit = jitCol !== -1 ? (parseFloat((row[jitCol] || '').trim()) || 0) : 0;
    let final = finalCol !== -1 ? (parseFloat((row[finalCol] || '').trim()) || 0) : 0;
    let total = totalCol !== -1 ? (parseFloat((row[totalCol] || '').trim()) || 0) : 0;

    if (total === 0) {
      total = work + mid + jit + final;
    }

    const assignments = assignmentColumns.map(({ name: assignmentName, index, max, type }) => {
      const score = parseAssignmentScore(row[index]);
      return {
        name: assignmentName,
        score,
        max,
        type,
        status: score === null ? 'missing' : 'submitted'
      };
    });

    const nowIso = new Date().toISOString();
    parsedStudents.push({ id, name, subject, work, mid, jit, final, total, assignments, updated_at: nowIso });
  }

  return parsedStudents;
}

// Attendance CSV Parser
function processAttendanceCSV(content, subject) {
  let inQuotes = false;
  let cleanContent = '';
  for(let i=0; i<content.length; i++){
    if(content[i] === '"') inQuotes = !inQuotes;
    if(content[i] === '\n' && inQuotes) {
      cleanContent += ' ';
    } else {
      cleanContent += content[i];
    }
  }

  const lines = cleanContent.split('\n').map(l => l.trim()).filter(l => l);
  const records = lines.map(parseCSVLine);

  let weekRowIndex = -1, monthRowIndex = -1, dateRowIndex = -1, dataStartIndex = -1;

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowText = row.join(' ');
    if (rowText.includes('สัปดาห์') && weekRowIndex === -1) weekRowIndex = i;
    if (rowText.includes('เดือน') && monthRowIndex === -1) monthRowIndex = i;
    if (rowText.includes('วันที่') && dateRowIndex === -1) dateRowIndex = i;
    if (row[1] && row[1].trim().match(/^\d{11}$/)) {
      dataStartIndex = i;
      break;
    }
  }

  if (dataStartIndex === -1) return [];

  const isLabelHeader = (val) => {
    if (!val) return false;
    const clean = String(val).trim().replace(/\s+/g, '');
    return /^(วันที่|เดือน|สัปดาห์|สัปดาห์ที่|วัน\/เดือน|วัน\/เดือน\/ปี|วัน|ลำดับ|เลขที่|รหัส|ชื่อ|นามสกุล|ชื่อเล่น)$/i.test(clean);
  };

  // Detect summary columns from top rows
  let comeCol = -1, lateCol = -1, absentCol = -1, sickLeaveCol = -1, errandLeaveCol = -1, percentCol = -1;
  for (let r = 0; r < Math.min(4, records.length); r++) {
    for (let c = 4; c < records[r].length; c++) {
      const val = (records[r][c] || '').trim();
      if (val.includes('มาเรียน') || val === 'มา') comeCol = c;
      else if (val.includes('สาย')) lateCol = c;
      else if (val.includes('ขาด')) absentCol = c;
      else if (val.includes('ลา') && !val.includes('ลำดับ')) {
        if (sickLeaveCol === -1) sickLeaveCol = c;
        else if (errandLeaveCol === -1) errandLeaveCol = c;
      }
      else if (val.includes('ร้อยละ')) percentCol = c;
    }
  }

  if (percentCol === -1) {
    if (errandLeaveCol > -1) percentCol = errandLeaveCol + 1;
    else if (sickLeaveCol > -1) percentCol = sickLeaveCol + 2;
  }

  const sessionCols = [];
  const startCol = 4;
  const endCol = comeCol > -1 ? comeCol : 23;
  for (let c = startCol; c < endCol; c++) {
    const weekVal = weekRowIndex > -1 ? (records[weekRowIndex][c] || '').trim() : '';
    const monthVal = monthRowIndex > -1 ? (records[monthRowIndex][c] || '').trim() : '';
    const dateVal = dateRowIndex > -1 ? (records[dateRowIndex][c] || '').trim() : '';

    // Ignore columns whose header label literally says วันที่ or เดือน or สัปดาห์
    if (isLabelHeader(dateVal) || isLabelHeader(monthVal)) {
      continue;
    }
    if (isLabelHeader(weekVal) && !dateVal && !monthVal) {
      continue;
    }

    if (dateVal || weekVal) {
      sessionCols.push({
        col: c,
        week: isLabelHeader(weekVal) ? '' : weekVal,
        month: isLabelHeader(monthVal) ? '' : monthVal,
        date: isLabelHeader(dateVal) ? '' : dateVal
      });
    }
  }

  const students = [];
  for (let i = dataStartIndex; i < records.length; i++) {
    const row = records[i];
    if (!row[1] || !row[1].trim().match(/^\d{11}$/)) continue;
    const id = row[1].trim();
    const name = row[2].trim();
    const present = comeCol > -1 ? parseInt(row[comeCol]) || 0 : 0;
    const late = lateCol > -1 ? parseInt(row[lateCol]) || 0 : 0;
    const absent = absentCol > -1 ? parseInt(row[absentCol]) || 0 : 0;
    const leave = (sickLeaveCol > -1 ? parseInt(row[sickLeaveCol]) || 0 : 0) + 
                  (errandLeaveCol > -1 ? parseInt(row[errandLeaveCol]) || 0 : 0);
    const percent = percentCol > -1 ? parseFloat(row[percentCol]) || 0 : 100;

    const sessions = sessionCols.map(s => {
      const statusRaw = (row[s.col] || '').trim();
      let label = '';
      if (s.date && s.month) {
        label = `${s.date} ${s.month}`.trim();
      } else if (s.date) {
        label = s.date;
      } else if (s.week) {
        label = s.week;
      }
      return {
        week: s.week,
        date: label,
        val: statusRaw
      };
    }).filter(s => s.date && !isLabelHeader(s.date) && s.date !== 'วันที่ เดือน');

    students.push({
      id,
      name,
      subject,
      attendance: {
        present,
        late,
        absent,
        leave,
        percent,
        total_sessions: sessions.length,
        sessions
      }
    });
  }
  return students;
}

// POST /api/scores/upload - Upload and parse CSV
app.post('/api/scores/upload', cookieAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const subject = req.body.subject || 'Unknown Subject';
  const content = req.file.buffer.toString();
  
  try {
    const parsedStudents = processCSVContent(content, subject);
    if (parsedStudents.length > 0) {
      const { error } = await supabase.from('scores').upsert(parsedStudents, { onConflict: 'id, subject' });
      if (error) throw error;
    }
    res.json({ success: true, count: parsedStudents.length, message: 'CSV uploaded and processed' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// Auto-Sync Logic & Helpers
// ==========================================
const AUTO_SYNC_INTERVAL_MINUTES = parseInt(process.env.AUTO_SYNC_INTERVAL_MINUTES, 10) || 0;
const AUTO_SYNC_INTERVAL_MS = (parseInt(process.env.AUTO_SYNC_INTERVAL_SECONDS, 10) || (AUTO_SYNC_INTERVAL_MINUTES > 0 ? AUTO_SYNC_INTERVAL_MINUTES * 60 : 30)) * 1000;

const lastSyncBySubject = new Map(); // subject -> timestamp (ms)
let lastGlobalSyncTime = 0;
const inFlightSyncs = new Map(); // key -> Promise

// Helper to convert Google Sheets edit URL to export CSV URL with gid
function formatGoogleSheetsExportUrl(url) {
  if (!url) return '';
  let cleanUrl = url.trim();
  if (cleanUrl.includes('/edit')) {
    const gidMatch = cleanUrl.match(/gid=([a-zA-Z0-9]+)/);
    cleanUrl = cleanUrl.replace(/\/edit.*$/, '/export?format=csv');
    if (gidMatch) {
      cleanUrl += '&gid=' + gidMatch[1];
    }
  }
  return cleanUrl;
}

// Sync a single subject configuration (Scores + Attendance)
async function syncSingleSubject(conf) {
  if (!conf || !conf.subject) return 0;
  let totalCount = 0;

  const attendanceUrl = conf.attendance_url || conf.jit_config?.attendance_url;
  const attendanceMap = new Map(); // id -> { name, attendance }

  // 1. Fetch & parse Attendance CSV if configured
  if (attendanceUrl) {
    try {
      const exportAttUrl = formatGoogleSheetsExportUrl(attendanceUrl);
      const attRes = await fetch(exportAttUrl);
      if (attRes.ok) {
        const attContent = await attRes.text();
        const parsedAtt = processAttendanceCSV(attContent, conf.subject);
        parsedAtt.forEach(item => {
          attendanceMap.set(item.id, {
            name: item.name,
            attendance: item.attendance
          });
        });
      } else {
        console.warn(`[Sync] Failed to fetch attendance for ${conf.subject}: ${attRes.status}`);
      }
    } catch (e) {
      console.warn(`[Sync] Error syncing attendance for ${conf.subject}:`, e.message);
    }
  }

  // 2. Fetch & parse Scores CSV if configured
  let parsedStudents = [];
  if (conf.url) {
    try {
      const exportScoreUrl = formatGoogleSheetsExportUrl(conf.url);
      const scoreRes = await fetch(exportScoreUrl);
      if (scoreRes.ok) {
        const scoreContent = await scoreRes.text();
        parsedStudents = processCSVContent(scoreContent, conf.subject);
      }
    } catch (e) {
      console.warn(`[Sync] Error syncing scores for ${conf.subject}:`, e.message);
    }
  }

  // 3. Merge attendance with scores
  const studentMap = new Map();

  parsedStudents.forEach(s => {
    studentMap.set(s.id, s);
  });

  // Attach attendance to existing score rows or add student if not yet in score sheet
  attendanceMap.forEach((attInfo, id) => {
    if (studentMap.has(id)) {
      const s = studentMap.get(id);
      s.jit_scores = { ...(s.jit_scores || {}), attendance: attInfo.attendance };
    } else {
      const nowIso = new Date().toISOString();
      studentMap.set(id, {
        id,
        name: attInfo.name,
        subject: conf.subject,
        work: 0,
        mid: 0,
        jit: 0,
        final: 0,
        total: 0,
        assignments: [],
        jit_scores: { attendance: attInfo.attendance },
        updated_at: nowIso
      });
    }
  });

  const finalStudents = Array.from(studentMap.values());
  if (finalStudents.length > 0) {
    const { error: upsertError } = await supabase.from('scores').upsert(finalStudents, { onConflict: 'id, subject' });
    if (upsertError) throw upsertError;
    
    // Cleanup stale students
    const validIds = Array.from(studentMap.keys());
    const { data: existing } = await supabase.from('scores').select('id').eq('subject', conf.subject);
    if (existing) {
      const idsToDelete = existing.map(e => e.id).filter(id => !validIds.includes(id));
      if (idsToDelete.length > 0) {
        for (let i = 0; i < idsToDelete.length; i += 100) {
          const chunk = idsToDelete.slice(i, i + 100);
          await supabase.from('scores').delete().eq('subject', conf.subject).in('id', chunk);
        }
      }
    }
    totalCount = finalStudents.length;
  }

  const now = Date.now();
  lastSyncBySubject.set(conf.subject, now);
  lastGlobalSyncTime = now;
  return totalCount;
}

// Sync all configured subjects in parallel
async function syncAllSubjects() {
  const { data: configs, error: configError } = await supabase.from('configs').select('*');
  if (configError) throw configError;
  if (!configs || configs.length === 0) return { count: 0, errors: [] };

  const results = await Promise.allSettled(configs.map(conf => syncSingleSubject(conf)));
  let totalProcessed = 0;
  const errors = [];

  results.forEach((res, index) => {
    if (res.status === 'fulfilled') {
      totalProcessed += res.value;
    } else {
      errors.push(`วิชา ${configs[index].subject}: ${res.reason?.message || res.reason}`);
    }
  });

  lastGlobalSyncTime = Date.now();
  return { count: totalProcessed, errors };
}

// Smart Auto-Sync: Checks freshness (TTL) and triggers sync if stale
async function checkAndAutoSync(subject = null, force = false) {
  const syncKey = subject || '__ALL__';

  // Deduplication: Return ongoing promise if sync is already in flight
  if (inFlightSyncs.has(syncKey)) {
    return inFlightSyncs.get(syncKey);
  }

  const promise = (async () => {
    const now = Date.now();

    try {
      if (subject) {
        // 1. Check in-memory timestamp
        const memTime = lastSyncBySubject.get(subject) || 0;
        if (!force && (now - memTime < AUTO_SYNC_INTERVAL_MS)) {
          return { synced: false, reason: 'fresh_in_memory' };
        }

        // 2. Check Supabase scores updated_at
        if (!force) {
          const { data } = await supabase
            .from('scores')
            .select('updated_at')
            .eq('subject', subject)
            .order('updated_at', { ascending: false })
            .limit(1);

          if (data && data.length > 0 && data[0].updated_at) {
            const dbTime = new Date(data[0].updated_at).getTime();
            if (now - dbTime < AUTO_SYNC_INTERVAL_MS) {
              lastSyncBySubject.set(subject, dbTime);
              return { synced: false, reason: 'fresh_in_db' };
            }
          }
        }

        // 3. Needs sync: fetch config for this subject
        const { data: conf, error: confError } = await supabase
          .from('configs')
          .select('*')
          .eq('subject', subject)
          .maybeSingle();

        if (confError || !conf || !conf.url) {
          return { synced: false, reason: 'no_config' };
        }

        console.log(`[Auto-Sync] Syncing subject: ${subject}...`);
        const count = await syncSingleSubject(conf);
        console.log(`[Auto-Sync] Successfully synced ${subject} (${count} records)`);
        return { synced: true, count };
      } else {
        // Global sync
        if (!force && (now - lastGlobalSyncTime < AUTO_SYNC_INTERVAL_MS)) {
          return { synced: false, reason: 'fresh_in_memory' };
        }

        if (!force) {
          const { data } = await supabase
            .from('scores')
            .select('updated_at')
            .order('updated_at', { ascending: false })
            .limit(1);

          if (data && data.length > 0 && data[0].updated_at) {
            const dbTime = new Date(data[0].updated_at).getTime();
            if (now - dbTime < AUTO_SYNC_INTERVAL_MS) {
              lastGlobalSyncTime = dbTime;
              return { synced: false, reason: 'fresh_in_db' };
            }
          }
        }

        console.log('[Auto-Sync] Syncing all subjects...');
        const res = await syncAllSubjects();
        console.log(`[Auto-Sync] Synced all subjects: ${res.count} records, ${res.errors.length} errors`);
        return { synced: true, ...res };
      }
    } catch (err) {
      console.warn(`[Auto-Sync] Warning: Failed to sync (${syncKey}):`, err.message);
      return { synced: false, error: err.message };
    } finally {
      inFlightSyncs.delete(syncKey);
    }
  })();

  inFlightSyncs.set(syncKey, promise);
  return promise;
}


// POST /api/scores/sync - Manual force sync from all configured Google Sheets
app.post('/api/scores/sync', cookieAuth, async (req, res) => {
  try {
    const result = await syncAllSubjects();
    if (result.errors.length > 0 && result.count === 0) {
      res.status(500).json({ error: result.errors.join(', ') });
    } else {
      res.json({ success: true, count: result.count, errors: result.errors, message: 'Synced successfully' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Background periodic sync for continuous Node servers (e.g. local dev, VPS, etc.)
if (AUTO_SYNC_INTERVAL_MS > 0) {
  setInterval(async () => {
    try {
      await checkAndAutoSync(null);
    } catch (err) {
      console.warn('[Auto-Sync] Background interval sync warning:', err.message);
    }
  }, Math.max(AUTO_SYNC_INTERVAL_MS, 60000));
}

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`[Auto-Sync] Enabled with ${AUTO_SYNC_INTERVAL_MINUTES} minute interval.`);
});
