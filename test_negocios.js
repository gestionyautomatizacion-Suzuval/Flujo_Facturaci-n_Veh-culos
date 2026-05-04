const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const envConfig = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envConfig[match[1].trim()] = match[2].trim();
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    const { data, error } = await supabase.from('negocios').select('*').limit(1);
    if (error) console.error(error);
    else if (data && data.length) console.log(Object.keys(data[0]));
    else {
        // fetch single random record or schema via rest? We can insert a dummy and rollback, or just post a new record and delete it.
        const { data: d2, error: e2 } = await supabase.from('negocios').insert([{ 
            interno: 'DUMMY_TEST_' + Date.now(),
            pedido_venta: 'DUMMY_TEST',
            rut: '1-9',
            nombre_apellido: 'Test',
            estado: 'PARA_REVISIÓN',
            suc_vta: 'S',
            vendedor_nombre: 'V',
            tipo_compra: 'T',
            saldo: '0'
        }]).select('*');
        if (d2 && d2.length) {
            console.log("Cols:", Object.keys(d2[0]));
            await supabase.from('negocios').delete().eq('interno', d2[0].interno);
        } else {
            console.log(e2);
        }
    }
}

run();
