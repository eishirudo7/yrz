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
    
    // Konversi shopId ke number dan validasi
    const shopIdNumber = parseInt(shopId, 10);
    if (isNaN(shopIdNumber)) {
      return NextResponse.json(
        { success: false, message: 'Parameter shop_id harus berupa angka' },
        { status: 400 }
      );
    }
    
    // Panggil API Shopee melalui service
    const result = await getEscrowDetail(shopIdNumber, orderSn);
    
    // Kembalikan respons yang terstruktur
    return NextResponse.json({
      success: true,
      data: result
    });
    
  } catch (error: any) {
    console.error('Error dalam API getEscrow:', error);
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