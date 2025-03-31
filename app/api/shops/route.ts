// pages/api/shops/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(req: NextRequest) {
  try {
    // Inisialisasi Supabase client
    const supabase = await createClient();
    
    // Ambil user dari session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({
        success: false,
        message: 'Pengguna tidak terautentikasi'
      }, { status: 401 });
    }
    
    // Ambil toko milik user
    const { data: shops, error: shopsError } = await supabase
      .from('shopee_tokens')
      .select('shop_id, shop_name')
      .eq('user_id', user.id)
      .eq('is_active', true);
    
    if (shopsError) {
      return NextResponse.json({
        success: false,
        message: 'Gagal mengambil data toko',
        error: shopsError.message
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      data: shops || []
    });
  } catch (error) {
    console.error('Error fetching shops:', error);
    return NextResponse.json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data toko',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}