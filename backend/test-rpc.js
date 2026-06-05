const { loadEnvConfig } = require('@next/env');
loadEnvConfig('./');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.rpc('reportes_cercanos', {
    lat: 19.0414,
    lng: -98.2063,
    radius_meters: 1000
  });
  console.log('Error:', error);
  console.log('Data:', data);
  
  const { data: all, error: err2 } = await supabase.from('reportes').select('*');
  console.log('All reports:', all);
}

test();
