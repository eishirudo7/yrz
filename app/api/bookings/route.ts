import { NextRequest, NextResponse } from 'next/server';
import { 
  saveBookingOrders, 
  getBookingOrdersFromDB, 
  deleteBookingOrders,
  updateBookingOrder,
  searchBookingOrders,
  updateTrackingNumber,
  markDocumentsAsPrinted,
  getBookingsReadyToPrint
} from '@/app/services/bookingService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shop_id');
    const action = searchParams.get('action');

    if (!shopId) {
      return NextResponse.json({
        success: false,
        message: 'Parameter shop_id diperlukan'
      }, { status: 400 });
    }

    const shopIdNum = parseInt(shopId);
    if (isNaN(shopIdNum)) {
      return NextResponse.json({
        success: false,
        message: 'shop_id harus berupa angka'
      }, { status: 400 });
    }

    // Get bookings ready to print
    if (action === 'ready_to_print') {
      const result = await getBookingsReadyToPrint(shopIdNum);
      return NextResponse.json(result);
    }

    // Search booking orders
    if (action === 'search') {
      const searchText = searchParams.get('search');
      const searchFields = searchParams.get('fields')?.split(',') || ['booking_sn', 'order_sn'];

      if (!searchText) {
        return NextResponse.json({
          success: false,
          message: 'Parameter search diperlukan untuk action search'
        }, { status: 400 });
      }

      const result = await searchBookingOrders(
        shopIdNum, 
        searchText, 
        searchFields as ('booking_sn' | 'order_sn' | 'recipient_name' | 'item_name' | 'tracking_number')[]
      );

      return NextResponse.json(result);
    }

    // Get booking orders with filters
    const filters = {
      booking_status: searchParams.get('booking_status') || undefined,
      booking_sn: searchParams.get('booking_sn') || undefined,
      order_sn: searchParams.get('order_sn') || undefined,
      tracking_number: searchParams.get('tracking_number') || undefined,
      is_printed: searchParams.get('is_printed') ? searchParams.get('is_printed') === 'true' : undefined,
      document_status: searchParams.get('document_status') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0
    };

    const result = await getBookingOrdersFromDB(shopIdNum, filters);
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error di GET /api/bookings:', error);
    return NextResponse.json({
      success: false,
      message: 'Terjadi kesalahan internal server'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shop_id, booking_list, action } = body;

    if (!shop_id) {
      return NextResponse.json({
        success: false,
        message: 'Parameter shop_id diperlukan'
      }, { status: 400 });
    }

    // Mark documents as printed
    if (action === 'mark_printed') {
      const { booking_sn_list } = body;
      
      if (!booking_sn_list || !Array.isArray(booking_sn_list) || booking_sn_list.length === 0) {
        return NextResponse.json({
          success: false,
          message: 'Parameter booking_sn_list diperlukan dan harus berupa array'
        }, { status: 400 });
      }

      const result = await markDocumentsAsPrinted(shop_id, booking_sn_list);
      return NextResponse.json(result);
    }

    // Update tracking number
    if (action === 'update_tracking') {
      const { booking_sn, tracking_number } = body;
      
      if (!booking_sn || !tracking_number) {
        return NextResponse.json({
          success: false,
          message: 'Parameter booking_sn dan tracking_number diperlukan'
        }, { status: 400 });
      }

      const result = await updateTrackingNumber(shop_id, booking_sn, tracking_number);
      return NextResponse.json(result);
    }

    // Save booking orders (default action)
    if (!booking_list || !Array.isArray(booking_list) || booking_list.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Parameter booking_list diperlukan dan harus berupa array'
      }, { status: 400 });
    }

    const result = await saveBookingOrders(booking_list, shop_id);
    
    if (result.success) {
      return NextResponse.json(result, { status: 201 });
    } else {
      return NextResponse.json(result, { status: 400 });
    }

  } catch (error) {
    console.error('Error di POST /api/bookings:', error);
    return NextResponse.json({
      success: false,
      message: 'Terjadi kesalahan internal server'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { shop_id, booking_sn, update_data } = body;

    if (!shop_id || !booking_sn) {
      return NextResponse.json({
        success: false,
        message: 'Parameter shop_id dan booking_sn diperlukan'
      }, { status: 400 });
    }

    if (!update_data || typeof update_data !== 'object') {
      return NextResponse.json({
        success: false,
        message: 'Parameter update_data diperlukan dan harus berupa object'
      }, { status: 400 });
    }

    const result = await updateBookingOrder(shop_id, booking_sn, update_data);
    
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 400 });
    }

  } catch (error) {
    console.error('Error di PUT /api/bookings:', error);
    return NextResponse.json({
      success: false,
      message: 'Terjadi kesalahan internal server'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { shop_id, booking_sn_list } = body;

    if (!shop_id) {
      return NextResponse.json({
        success: false,
        message: 'Parameter shop_id diperlukan'
      }, { status: 400 });
    }

    if (!booking_sn_list || !Array.isArray(booking_sn_list) || booking_sn_list.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Parameter booking_sn_list diperlukan dan harus berupa array'
      }, { status: 400 });
    }

    const result = await deleteBookingOrders(shop_id, booking_sn_list);
    
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 400 });
    }

  } catch (error) {
    console.error('Error di DELETE /api/bookings:', error);
    return NextResponse.json({
      success: false,
      message: 'Terjadi kesalahan internal server'
    }, { status: 500 });
  }
} 