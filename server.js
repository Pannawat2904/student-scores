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
  const expectedToken = Buffer.from(`${process.env.ADMIN_USER}:${process.env.ADMIN_PASS}`).toString('base64');
  
  if (token === expectedToken) {
    return next();
  }

  // If asking for an HTML page, redirect to login
  if (req.path === '/admin.html') {
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

// Protect admin.html BEFORE static middleware
app.get('/admin.html', cookieAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.use(express.static('public'));

// Setup multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// GET /api/scores - Get all scores
app.get('/api/scores', async (req, res) => {
  const { data, error } = await supabase.from('scores').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/scores/:id - Get a single student's score
app.get('/api/scores/:id', async (req, res) => {
  const subject = req.query.subject;
  let query = supabase.from('scores').select('*').eq('id', req.params.id);
  if (subject) {
    query = query.eq('subject', subject);
  }
  
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  
  if (data && data.length > 0) {
    res.json(data[0]); // Return the first match if multiple
  } else {
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

// GET /api/config - Get sync configurations
app.get('/api/config', async (req, res) => {
  const { data, error } = await supabase.from('configs').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/config - Save sync configurations (Expects array of configs)
app.post('/api/config', cookieAuth, async (req, res) => {
  const configs = req.body;
  if (!Array.isArray(configs)) return res.status(400).json({ error: 'Expected an array of configs' });
  
  // First, delete all existing configs (simple replacement strategy)
  await supabase.from('configs').delete().neq('subject', 'xxxxxx');
  
  if (configs.length > 0) {
    const { error } = await supabase.from('configs').insert(configs);
    if (error) return res.status(500).json({ error: error.message });
  }
  
  res.json({ success: true, message: 'Config saved' });
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

  const lines = cleanContent.split('\n').map(l => l.trim()).filter(l => l);
  const records = lines.map(parseCSVLine);

  let dataStartIndex = -1;
  let subHeaderIndex = -1;

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    if (row[1] && row[1].match(/^\d{11}$/)) {
      if (dataStartIndex === -1) {
        dataStartIndex = i;
        break;
      }
    }
  }

  if (dataStartIndex > 0) {
    subHeaderIndex = dataStartIndex - 1;
  }

  if (dataStartIndex === -1) {
    throw new Error('ไม่พบรูปแบบตารางคะแนนที่รองรับในไฟล์ CSV นี้');
  }

  // Google Sheets exports often have more than one header row.  Combine the
  // labels so that a grouped heading (for example "งาน") retains the actual
  // assignment name from the row below it.
  const columnHeaders = [];
  for (let c = 0; c < (records[subHeaderIndex] || []).length; c++) {
    const labels = [];
    for (let r = 0; r <= subHeaderIndex; r++) {
      const label = (records[r][c] || '').trim();
      if (label && !labels.includes(label)) labels.push(label);
    }
    columnHeaders[c] = labels.join(' — ');
  }

  let workCol = -1, midCol = -1, jitCol = -1, finalCol = -1, totalCol = -1;
  for (let r = 0; r <= subHeaderIndex; r++) {
    for (let c = 5; c < records[r].length; c++) {
      const h = (records[r][c] || '').trim();
      if (h.includes('คะแนนเก็บ')) workCol = c;
      if (h.includes('ระหว่างเรียน')) midCol = c;
      if (h.includes('จิตพิสัย') && jitCol === -1) jitCol = c;
      if (h.includes('ปลายภาค')) finalCol = c;
      if (h.includes('คะแนนรวม')) totalCol = c;
    }
  }

  const summaryColumns = new Set([workCol, midCol, jitCol, finalCol, totalCol]);
  const assignmentColumns = columnHeaders
    .map((name, index) => ({ name, index }))
    // Columns 0–4 contain row number and student details in the supported export.
    .filter(({ name, index }) => index >= 5 && name && !summaryColumns.has(index))
    .filter(({ name }) => !/^(ลำดับ|รหัส|ชื่อ|นามสกุล|ห้อง|ชั้น|กลุ่ม|เลขที่)(\s|$)/.test(name));

  const parseAssignmentScore = (value) => {
    const text = (value || '').trim();
    if (text === '') return null;
    const score = Number.parseFloat(text.replace(/,/g, ''));
    return Number.isFinite(score) ? score : null;
  };

  const getMaxScore = (name) => {
    const match = name.match(/(?:เต็ม|คะแนน|ข้อ)\s*(\d+(?:\.\d+)?)/) || name.match(/\(\s*(\d+(?:\.\d+)?)\s*\)/);
    return match ? Number.parseFloat(match[1]) : null;
  };

  const isTest = (name) => /ทดสอบ|แบบสอบ|ข้อสอบ|สอบย่อย|quiz/i.test(name);

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
       // Fallback total calculation if no specific total column is found
       total = work + mid + jit + final; 
    }

    const assignments = assignmentColumns.map(({ name: assignmentName, index }) => {
      const score = parseAssignmentScore(row[index]);
      return {
        name: assignmentName,
        score,
        max: getMaxScore(assignmentName),
        type: isTest(assignmentName) ? 'test' : 'work',
        status: score === null ? 'missing' : 'submitted'
      };
    });

    parsedStudents.push({ id, name, subject, work, mid, jit, final, total, assignments });
  }
  return parsedStudents;
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

// POST /api/scores/sync - Trigger sync from all configured Google Sheets
app.post('/api/scores/sync', cookieAuth, async (req, res) => {
  const { data: configs, error: configError } = await supabase.from('configs').select('*');
  if (configError) return res.status(500).json({ error: configError.message });
  if (!configs || configs.length === 0) {
    return res.status(400).json({ error: 'No sync configurations found' });
  }

  let totalProcessed = 0;
  const errors = [];

  for (const conf of configs) {
    try {
      if (!conf.url || !conf.subject) continue;
      const response = await fetch(conf.url);
      if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
      
      const content = await response.text();
      const parsedStudents = processCSVContent(content, conf.subject);
      
      if (parsedStudents.length > 0) {
        const { error: upsertError } = await supabase.from('scores').upsert(parsedStudents, { onConflict: 'id, subject' });
        if (upsertError) throw upsertError;
        totalProcessed += parsedStudents.length;
      }
    } catch (err) {
      errors.push(`วิชา ${conf.subject}: ${err.message}`);
    }
  }

  if (errors.length > 0 && totalProcessed === 0) {
    res.status(500).json({ error: errors.join(', ') });
  } else {
    res.json({ success: true, count: totalProcessed, message: 'Synced successfully' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
