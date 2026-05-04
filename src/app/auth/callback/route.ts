import { NextResponse } from 'next/server'
// The client you created from the Server-Side Auth instructions
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Validar que termine en @suzuval.cl (se hace también en el middleware, esto es redundancia)
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email && !user.email.endsWith('@suzuval.cl')) {
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=Solo+se+permiten+correos+de+Suzuval`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    } else {
      // Return exact error message
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Error de autenticación: ' + error.message)}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=Falta+codigo+de+autorizacion`)
}
