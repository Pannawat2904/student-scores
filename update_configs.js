const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabase = createClient(
  'https://ttgjkcnrujczzhsboatm.supabase.co',
  'sb_publishable_2j3oXeUH5s_em-r2JuMj0g_I3tGVkmJ'
);

const attDocId = "16-T6awoN63yHhnbQm0nbqpWvXd-ASmutjA-Ov_K2EZM";

const subjectConfigs = [
  {
    subject: "การเขียนโปรแกรมเชิงวัตถุเบื้องต้น ธดท.2/2",
    url: "https://docs.google.com/spreadsheets/d/1gDOukMTR1Vjy8BX3Hbb-7otRPvkAS8DOg12HXhoX5Q0/edit?gid=521597264#gid=521597264",
    attendance_url: `https://docs.google.com/spreadsheets/d/${attDocId}/edit?gid=1212047077#gid=1212047077`
  },
  {
    subject: "วิทยาการก้าวหน้าในอุตสาหกรรมดิจิทัล IT2/1",
    url: "https://docs.google.com/spreadsheets/d/1e5Uv__cww36oQOPbDLSqps8QRT5sd3XGwj6yGrkqpLM/edit?gid=521597264#gid=521597264",
    attendance_url: `https://docs.google.com/spreadsheets/d/${attDocId}/edit?gid=3001#gid=3001`
  },
  {
    subject: "การพัฒนาเว็บแอปพลิเคชัน IT2/1",
    url: "https://docs.google.com/spreadsheets/d/1xZQB_09jU72nQpsNl6zY4KneM8BrPqKD9rS8c7r3gFQ/edit?gid=521597264#gid=521597264",
    attendance_url: `https://docs.google.com/spreadsheets/d/${attDocId}/edit?gid=2001#gid=2001`
  }
];

async function updateConfigs() {
  for (const cfg of subjectConfigs) {
    const { data: existing } = await supabase.from('configs').select('*').eq('subject', cfg.subject).maybeSingle();
    const updatePayload = {
      url: cfg.url,
      jit_config: {
        ...(existing?.jit_config || {}),
        attendance_url: cfg.attendance_url,
        show_to_students: false
      }
    };
    if (existing) {
      const { error: updateErr } = await supabase
        .from('configs')
        .update(updatePayload)
        .eq('subject', cfg.subject);
      if (updateErr) console.error(`Error updating config for ${cfg.subject}:`, updateErr);
      else console.log(`Updated config for ${cfg.subject}`);
    } else {
      const { error: insertErr } = await supabase
        .from('configs')
        .insert({
          subject: cfg.subject,
          ...updatePayload
        });
      if (insertErr) console.error(`Error inserting config for ${cfg.subject}:`, insertErr);
      else console.log(`Inserted config for ${cfg.subject}`);
    }
  }
}

async function triggerSync() {
  // We can just call the local API if the server is running, or trigger it via HTTP
  try {
    const res = await fetch('http://localhost:3000/api/scores/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      // Since it requires cookieAuth, we might need a workaround, or just call the sync script again.
      // Let's just use the previous sync logic or assume the server handles it on the next fetch.
    });
    console.log(`Sync trigger status: ${res.status}`);
  } catch (err) {
    console.log('Server might not be running locally on 3000, that is fine. Vercel will handle it or we can run a manual sync script.');
  }
}

async function run() {
  await updateConfigs();
  console.log('Configs updated. Please trigger sync via UI or the next fetch will auto-sync.');
}

run();
