import { NextRequest, NextResponse } from 'next/server';
import { getBookingTrackingNumber } from '@/app/services/shopeeService';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // Autentikasi user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'UNAUTHORIZED', 
          message: 'User tidak terautentikasi' 
        }, 
        { status: 401 }
      );
    }

    // Ambil parameter dari URL
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');
    const bookingSn = searchParams.get('bookingSn');
    const packageNumber = searchParams.get('packageNumber'); // opsional

    // Validasi parameter wajib
    if (!shopId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'MISSING_SHOP_ID', 
          message: 'Parameter shopId diperlukan' 
        }, 
        { status: 400 }
      );
    }

    if (!bookingSn) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'MISSING_BOOKING_SN', 
          message: 'Parameter bookingSn diperlukan' 
        }, 
        { status: 400 }
      );
    }

    // Konversi shopId ke number
    const shopIdNum = parseInt(shopId);
    if (isNaN(shopIdNum)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'INVALID_SHOP_ID', 
          message: 'shopId harus berupa angka' 
        }, 
        { status: 400 }
      );
    }

    // Panggil service untuk mendapatkan tracking number booking
    const result = await getBookingTrackingNumber(
      shopIdNum, 
      bookingSn, 
      packageNumber || undefined
    );

    if (!result.success) {
      const statusCode = result.error === 'invalid_input' ? 400 : 500;
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'FETCH_FAILED', 
          message: result.message || 'Gagal mengambil tracking number booking' 
        }, 
        { status: statusCode }
      );
    }

    // Return response sukses
    return NextResponse.json({
      success: true,
      data: result.data,
      request_id: result.request_id,
      message: `Berhasil mengambil tracking number untuk booking ${bookingSn}`,
      note: "Data berisi informasi tracking number yang dapat digunakan untuk melacak pengiriman booking"
    });

  } catch (error) {
    console.error('Error di API booking tracking number:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'INTERNAL_SERVER_ERROR', 
        message: error instanceof Error ? error.message : 'Terjadi kesalahan server internal' 
      }, 
      { status: 500 }
    );
  }
} 