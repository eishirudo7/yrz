// app/api/user/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@/utils/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Dapatkan user yang sedang login
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({
        success: false,
        message: "Pengguna tidak terautentikasi"
      }, { status: 401 });
    }
    
    // Ambil metadata user (profil)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('display_name, phone, profile_image')
      .eq('id', user.id)
      .single();
    
    if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = tidak ada data
      console.error('Error fetching profile:', profileError);
    }
    
    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        email_verified: user.email_confirmed_at ? true : false,
        name: profile?.display_name || user.user_metadata?.display_name || '',
        phone: profile?.phone || user.user_metadata?.phone || '',
        profile_image: profile?.profile_image || null,
        created_at: user.created_at
      }
    });
    
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({
      success: false,
      message: "Terjadi kesalahan saat memproses permintaan",
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}