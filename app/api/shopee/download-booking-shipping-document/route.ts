import { NextRequest, NextResponse } from 'next/server';
import { downloadBookingShippingDocument } from '@/app/services/shopeeService';
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
    const { shopId, bookingList } = body;

    // Validasi parameter wajib
    if (!shopId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'MISSING_SHOP_ID', 
          message: 'shopId diperlukan' 
        }, 
        { status: 400 }
      );
    }

    if (!bookingList || !Array.isArray(bookingList) || bookingList.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'MISSING_BOOKING_LIST', 
          message: 'bookingList tidak boleh kosong dan harus berupa array' 
        }, 
        { status: 400 }
      );
    }

    if (bookingList.length > 50) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'TOO_MANY_BOOKINGS', 
          message: 'bookingList tidak boleh lebih dari 50 item' 
        }, 
        { status: 400 }
      );
    }

    // Validasi setiap booking dalam list
    for (let i = 0; i < bookingList.length; i++) {
      const booking = bookingList[i];
      if (!booking.booking_sn || typeof booking.booking_sn !== 'string' || booking.booking_sn.trim().length === 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'INVALID_BOOKING_SN', 
            message: `booking_sn tidak boleh kosong pada index ${i}` 
          }, 
          { status: 400 }
        );
      }
    }

    console.log(`User ${user.email} mengunduh dokumen pengiriman booking untuk toko ${shopId} dengan ${bookingList.length} booking`);

    // Panggil service untuk mengunduh dokumen
    const result = await downloadBookingShippingDocument(shopId, bookingList);

    // Jika hasil adalah Buffer (file PDF)
    if (result instanceof Buffer) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `booking-shipping-document-${shopId}-${timestamp}.pdf`;
      
      console.log(`Berhasil mengunduh dokumen pengiriman booking untuk toko ${shopId}, ukuran file: ${result.length} bytes`);
      
      return new NextResponse(result, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': result.length.toString(),
        },
      });
    }

    // Jika hasil adalah error response
    if (result.error) {
      const statusCode = result.error === 'invalid_parameters' ? 400 : 500;
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message: result.message,
          request_id: result.request_id
        },
        { status: statusCode }
      );
    }

    // Jika format response tidak dikenali
    return NextResponse.json(
      {
        success: false,
        error: 'UNKNOWN_RESPONSE_FORMAT',
        message: 'Format response dari service tidak dikenali'
      },
      { status: 500 }
    );

  } catch (error) {
    console.error('Error saat mengunduh dokumen pengiriman booking:', error);
    
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