const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xcamqzutgvrplhzvmlka.supabase.co';
const supabaseKey = 'sb_publishable_Qw-j033S0vfojEHdq-9Csw_sr2HPw6o';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdate() {
  const { data, error } = await supabase
      .from('negocios')
      .update({
        nombre_apellido: "Test",
        rut: "Test",
        direccion_cliente: "Test",
        region_cliente: "Test",
        comuna_cliente: "Test",
        mail_cliente: "Test",
        movil_cliente: "Test",
        contribuyente_electronico: "Test",
        tipo_negocio: "Test",
        estado_civil: "Test",
        comunidad_bienes: "Test",
        nacionalidad: "Test",
        profesion_giro: "Test"
      })
      .eq('interno', -1);
      
  if (error) {
    console.error("Supabase Error:", error);
  } else {
    console.log("Success");
  }
}

testUpdate();
