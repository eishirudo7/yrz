import { NextRequest, NextResponse } from 'next/server';
import { getFlashSaleTimeSlotId } from '@/app/services/shopeeFlashSaleService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shopId = parseInt(searchParams.get('shop_id') || '');
    
    // Menggunakan nilai default jika start_time dan end_time tidak ada
    const now = Math.floor(Date.now() / 1000); // Konversi ke UNIX timestamp (detik)
    const bufferTime = now + 5; // Menambahkan buffer 5 detik
    const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
    
    // Memastikan startTime tidak lebih kecil dari waktu sekarang + buffer
    const requestedStartTime = parseInt(searchParams.get('start_time') || '') || bufferTime;
    const startTime = Math.max(requestedStartTime, bufferTime);
    const endTime = parseInt(searchParams.get('end_time') || '') || (bufferTime + thirtyDaysInSeconds);

    if (!shopId) {
      return NextResponse.json(
        { error: 'Parameter shop_id diperlukan' },
        { status: 400 }
      );
    }

    const result = await getFlashSaleTimeSlotId(shopId, startTime, endTime);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 