import { NextRequest, NextResponse } from 'next/server';
import { unblockShopWebhook, getShopInfo } from '@/app/services/shopeeService';

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shopId = parseInt(searchParams.get('shopId') || '');

    if (!shopId || isNaN(shopId)) {
      return NextResponse.json(
        { error: 'ID Toko tidak valid' },
        { status: 400 }
      );
    }

    // Cek apakah toko ada di database kita
    try {
      await getShopInfo(shopId);
    } catch (error) {
      // Jika toko tidak ditemukan di database, berarti ini toko baru
      return NextResponse.json({
        success: true,
        message: 'Toko baru, belum pernah terhubung dengan aplikasi',
        data: {
          shop_id: shopId,
          is_blocked: false
        }
      });
    }

    // Jika toko ada di database, lanjutkan dengan proses unblock
    const result = await unblockShopWebhook(shopId);
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error dalam route unblock shop:', error);
    return NextResponse.json(
      { 
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Terjadi kesalahan internal server' 
      },
      { status: 500 }
    );
  }
} 