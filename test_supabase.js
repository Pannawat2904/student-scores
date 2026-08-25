require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ttgjkcnrujczzhsboatm.supabase.co';
const supabaseKey = 'sb_publishable_2j3oXeUH5s_em-r2JuMj0g_I3tGVkmJ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('Testing connection to Supabase...');
  try {
    const { data, error } = await supabase.from('configs').select('*');
    if (error) {
      console.error('Error connecting to Supabase:', error);
    } else {
      console.log('Successfully connected to Supabase! Configs table data:', data);
    }
  } catch (err) {
    console.error('Exception during connection:', err);
  }
}

testConnection();
