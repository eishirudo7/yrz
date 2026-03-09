import { createClient } from '@/utils/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  // Tangkap flow Token & Type (Magic Links & Email OTP)
  const token_hash = requestUrl.searchParams.get('token_hash') || requestUrl.searchParams.get('token')
  const type = requestUrl.searchParams.get('type') as any

  const supabase = await createClient()

  if (code) {
    // Standard PKCE Flow
    await supabase.auth.exchangeCodeForSession(code)
  } else if (token_hash && type) {
    // Magic Link / PKCE fallback flow
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (error) {
      console.error('Error verifying OTP/Link:', error)
      return NextResponse.redirect(`${requestUrl.origin}/login?error=Invalid_Token`)
    }
  }

  // URL to redirect to after sign in process completes
  // Di Next.js App Router, biasanya dialihkan ke '/dashboard' atau beranda utama (Origin)
  return NextResponse.redirect(`${requestUrl.origin}/shops`)
} 