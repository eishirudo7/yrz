import { createClient } from '@/utils/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const token_hash = requestUrl.searchParams.get('token_hash') || requestUrl.searchParams.get('token')
  const type = requestUrl.searchParams.get('type') as any

  const supabase = await createClient()

  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (error) {
      console.error('Error verifying OTP/Link:', error)
      return NextResponse.redirect('https://yorozuya.me/login?error=Invalid_Token')
    }
  }

  // Hardcoded to production URL to bypass Nginx proxy localhost issue
  return NextResponse.redirect('https://yorozuya.me/shops')
}