import { NextRequest, NextResponse } from 'next/server';
import { shipBooking } from '@/app/services/shopeeService';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
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

    // Ambil data dari request body
    const body = await request.json();
    const { shopId, bookingSn, shippingMethod, shippingData } = body;

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
    const shopIdNum = typeof shopId === 'string' ? parseInt(shopId) : shopId;
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

    // Validasi shipping method
    const validMethods = ['pickup', 'dropoff'];
    const method = shippingMethod || 'dropoff';
    if (!validMethods.includes(method)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'INVALID_SHIPPING_METHOD', 
          message: 'shippingMethod harus pickup atau dropoff' 
        }, 
        { status: 400 }
      );
    }

    // Panggil service untuk melakukan ship booking
    const result = await shipBooking(shopIdNum, bookingSn, method, shippingData);

    if (!result.success) {
      const statusCode = result.error === 'invalid_input' ? 400 : 500;
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'SHIP_FAILED', 
          message: result.message || 'Gagal melakukan pengiriman booking',
          request_id: result.request_id 
        }, 
        { status: statusCode }
      );
    }

    // Return response sukses
    return NextResponse.json({
      success: true,
      data: result.response || result.data,
      request_id: result.request_id,
      message: `Berhasil melakukan pengiriman booking ${bookingSn} dengan metode ${method}`,
      shipping_method: method
    });

  } catch (error) {
    console.error('Error di API ship booking:', error);
    
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