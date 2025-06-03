import { NextRequest, NextResponse } from 'next/server';
import { getBookingList } from '@/app/services/shopeeService';
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
    const timeRangeField = searchParams.get('timeRangeField') as 'create_time' | 'update_time';
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const bookingStatus = searchParams.get('bookingStatus');
    const pageSize = searchParams.get('pageSize');
    const cursor = searchParams.get('cursor');

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

    // Setup options untuk getBookingList
    const options: any = {};
    
    if (timeRangeField) {
      options.timeRangeField = timeRangeField;
    }
    
    if (startTime) {
      const startTimeNum = parseInt(startTime);
      if (!isNaN(startTimeNum)) {
        options.startTime = startTimeNum;
      }
    }
    
    if (endTime) {
      const endTimeNum = parseInt(endTime);
      if (!isNaN(endTimeNum)) {
        options.endTime = endTimeNum;
      }
    }
    
    if (bookingStatus) {
      options.bookingStatus = bookingStatus;
    }
    
    if (pageSize) {
      const pageSizeNum = parseInt(pageSize);
      if (!isNaN(pageSizeNum) && pageSizeNum > 0 && pageSizeNum <= 100) {
        options.pageSize = pageSizeNum;
      }
    }
    
    if (cursor) {
      options.cursor = cursor;
    }

    // Panggil service untuk mendapatkan booking list
    const result = await getBookingList(shopIdNum, options);

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'FETCH_FAILED', 
          message: result.message || 'Gagal mengambil daftar booking' 
        }, 
        { status: 500 }
      );
    }

    // Return response sukses
    return NextResponse.json({
      success: true,
      data: result.data,
      request_id: result.request_id,
      message: 'Berhasil mengambil daftar booking'
    });

  } catch (error) {
    console.error('Error di API booking list:', error);
    
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