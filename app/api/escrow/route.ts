import { NextRequest, NextResponse } from 'next/server';
import { getEscrowDetail } from '@/app/services/shopeeService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shopId = searchParams.get('shop_id');
    const orderSn = searchParams.get('order_sn');
    
    if (!shopId || !orderSn) {
      return NextResponse.json(
        { success: false, message: 'Parameter shop_id dan order_sn diperlukan' },
        { status: 400 }
      );
    }
    
    // Panggil API Shopee langsung tanpa pemrosesan tambahan
    const shopIdNumber = parseInt(shopId, 10);
    const response = await getEscrowDetail(shopIdNumber, orderSn);
    
    // Kembalikan respons mentah dari Shopee
    return NextResponse.json({
      success: true,
      message: 'Berhasil mendapatkan respons dari Shopee API',
      raw_response: response
    });
    
  } catch (error: any) {
    console.error('Error dalam API getEscrow raw:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Terjadi kesalahan saat memproses permintaan', 
        error: error.message 
      },
      { status: 500 }
    );
  }
} 