import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  
  // Lakukan logout
  await supabase.auth.signOut()
  
  return NextResponse.json({ success: true })
} 