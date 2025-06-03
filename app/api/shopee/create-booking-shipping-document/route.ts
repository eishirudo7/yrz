import { NextRequest, NextResponse } from 'next/server';
import { createBookingShippingDocument } from '@/app/services/shopeeService';
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
    const { shopId, bookingList, documentType } = body;

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

    if (!bookingList) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'MISSING_BOOKING_LIST', 
          message: 'Parameter bookingList diperlukan' 
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

    // Validasi bookingList adalah array
    if (!Array.isArray(bookingList)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'INVALID_BOOKING_LIST', 
          message: 'bookingList harus berupa array' 
        }, 
        { status: 400 }
      );
    }

    if (bookingList.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'EMPTY_BOOKING_LIST', 
          message: 'bookingList tidak boleh kosong' 
        }, 
        { status: 400 }
      );
    }

    if (bookingList.length > 50) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'BOOKING_LIST_TOO_LARGE', 
          message: 'bookingList tidak boleh lebih dari 50 item' 
        }, 
        { status: 400 }
      );
    }

    // Validasi struktur bookingList
    for (let i = 0; i < bookingList.length; i++) {
      const booking = bookingList[i];
      if (!booking || typeof booking !== 'object') {
        return NextResponse.json(
          { 
            success: false, 
            error: 'INVALID_BOOKING_STRUCTURE', 
            message: `Item booking pada index ${i} harus berupa object` 
          }, 
          { status: 400 }
        );
      }

      if (!booking.booking_sn || typeof booking.booking_sn !== 'string') {
        return NextResponse.json(
          { 
            success: false, 
            error: 'MISSING_BOOKING_SN', 
            message: `booking_sn diperlukan pada index ${i}` 
          }, 
          { status: 400 }
        );
      }
    }

    // Validasi document type
    const validDocumentTypes = [
      'THERMAL_AIR_WAYBILL',
      'NORMAL_AIR_WAYBILL',
      'A4_PDF'
    ];

    const docType = documentType || 'THERMAL_AIR_WAYBILL';
    if (!validDocumentTypes.includes(docType)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'INVALID_DOCUMENT_TYPE', 
          message: `documentType tidak valid. Harus salah satu dari: ${validDocumentTypes.join(', ')}` 
        }, 
        { status: 400 }
      );
    }

    // Panggil service untuk membuat dokumen pengiriman booking
    const result = await createBookingShippingDocument(shopIdNum, bookingList, docType);

    if (!result.success) {
      const statusCode = result.error === 'invalid_input' ? 400 : 500;
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'CREATE_FAILED', 
          message: result.message || 'Gagal membuat dokumen pengiriman booking',
          request_id: result.request_id 
        }, 
        { status: statusCode }
      );
    }

    // Return response sukses
    return NextResponse.json({
      success: true,
      data: result.data,
      request_id: result.request_id,
      message: `Berhasil membuat dokumen pengiriman untuk ${bookingList.length} booking dengan tipe ${docType}`,
      document_type: docType,
      booking_count: bookingList.length
    });

  } catch (error) {
    console.error('Error di API create booking shipping document:', error);
    
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