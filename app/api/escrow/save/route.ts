// app/api/escrow/save/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Ambil user dari session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({
        success: false,
        message: 'Pengguna tidak terautentikasi'
      }, { status: 401 });
    }
    
    // Ambil data dari body request
    const { shopId, escrowData } = await req.json();
    
    // Simpan ke database dengan client server
    const { error } = await supabase
      .from('escrow_details')
      .upsert({
        shop_id: shopId,
        order_sn: escrowData.order_sn,
        order_income: escrowData.order_income,
        order_income_components: escrowData.order_income_components,
        promotion_income_components: escrowData.promotion_income_components,
        refund_transaction: escrowData.refund_transaction
      }, { 
        onConflict: 'shop_id,order_sn' 
      });
    
    if (error) {
      return NextResponse.json({
        success: false,
        message: error.message
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Data escrow berhasil disimpan'
    });
  } catch (error) {
    console.error('Error menyimpan data escrow:', error);
    return NextResponse.json({
      success: false,
      message: 'Terjadi kesalahan saat menyimpan data escrow'
    }, { status: 500 });
  }
}