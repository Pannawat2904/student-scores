require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://ttgjkcnrujczzhsboatm.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_2j3oXeUH5s_em-r2JuMj0g_I3tGVkmJ';
const supabase = createClient(supabaseUrl, supabaseKey);

const configs = [
  {
    subject: "วิชาเทคโนโลยีการนำเข้าข้อมูลเข้าสู่ระบบคอมพิวเตอร์",
    url: "https://docs.google.com/spreadsheets/d/1HnojJBK-01OuNhf6NEHLqcUncgG1A1oCLwlx-cPDd7I/export?format=csv&gid=0"
  },
  {
    subject: "รายวิชาโปรแกรมมัลติมีเดีย",
    url: "https://docs.google.com/spreadsheets/d/1zfYvIHD5EZeOsvuHyz0mmXJGp4MldgkJ8ZUTqxKEHZk/export?format=csv&gid=0"
  },
  {
    subject: "วิชาโปรแกรมฐานข้อมูล",
    url: "https://docs.google.com/spreadsheets/d/1-y2Ax6q1f3AOrekB6dp82nhtV97625zda4MCOyqszs0/export?format=csv&gid=0"
  }
];

async function insertConfigs() {
  console.log("Deleting old configs...");
  await supabase.from('configs').delete().neq('subject', 'xxxx');
  
  console.log("Inserting new configs...");
  const { data, error } = await supabase.from('configs').insert(configs);
  
  if (error) {
    console.error("Error inserting configs:", error);
  } else {
    console.log("Configs inserted successfully!");
  }
}

insertConfigs();
