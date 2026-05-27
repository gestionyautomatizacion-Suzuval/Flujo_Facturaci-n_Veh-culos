import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  const { data, error } = await supabase
    .from('perfiles')
    .select('*')
    .eq('email', 'gvalderrama@suzuval.cl')
    .single()
  console.log('Role:', data?.rol)
}
main()
