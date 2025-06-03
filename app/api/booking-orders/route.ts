import { NextRequest, NextResponse } from 'next/server';
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
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const bookingStatus = searchParams.get('bookingStatus');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('booking_orders')
      .select(`
        id,
        shop_id,
        booking_sn,
        order_sn,
        booking_status,
        match_status,
        shipping_carrier,
        create_time,
        update_time,
        recipient_address,
        item_list,
        dropshipper,
        dropshipper_phone,
        cancel_by,
        cancel_reason,
        fulfillment_flag,
        pickup_done_time,
        tracking_number,
        is_printed,
        document_status
      `)
      .order('create_time', { ascending: false });

    // Filter berdasarkan shopId jika ada
    if (shopId) {
      query = query.eq('shop_id', shopId);
    } else {
      // Jika tidak ada shopId, filter berdasarkan toko yang dimiliki user
      const { data: userShops } = await supabase
        .from('shopee_tokens')
        .select('shop_id')
        .eq('user_id', user.id)
        .eq('is_active', true);
      
      if (userShops && userShops.length > 0) {
        const shopIds = userShops.map(shop => shop.shop_id);
        query = query.in('shop_id', shopIds);
      } else {
        // User tidak memiliki toko aktif
        return NextResponse.json({
          success: true,
          data: [],
          total: 0,
          summary: {
            pending: 0,
            confirmed: 0,
            cancelled: 0,
            completed: 0,
            ready_to_ship: 0,
            total: 0
          }
        });
      }
    }

    // Filter berdasarkan waktu
    if (startTime) {
      query = query.gte('create_time', parseInt(startTime));
    }
    if (endTime) {
      query = query.lte('create_time', parseInt(endTime));
    }

    // Filter berdasarkan status
    if (bookingStatus && bookingStatus !== 'ALL') {
      query = query.eq('booking_status', bookingStatus);
    }

    // Ambil total count untuk summary
    let countQuery = supabase
      .from('booking_orders')
      .select('*', { count: 'exact', head: true });

    // Apply same filters untuk count
    if (shopId) {
      countQuery = countQuery.eq('shop_id', shopId);
    } else {
      // Jika tidak ada shopId, filter berdasarkan toko yang dimiliki user
      const { data: userShops } = await supabase
        .from('shopee_tokens')
        .select('shop_id')
        .eq('user_id', user.id)
        .eq('is_active', true);
      
      if (userShops && userShops.length > 0) {
        const shopIds = userShops.map(shop => shop.shop_id);
        countQuery = countQuery.in('shop_id', shopIds);
      }
    }

    // Filter berdasarkan waktu untuk count
    if (startTime) {
      countQuery = countQuery.gte('create_time', parseInt(startTime));
    }
    if (endTime) {
      countQuery = countQuery.lte('create_time', parseInt(endTime));
    }

    // Filter berdasarkan status untuk count
    if (bookingStatus && bookingStatus !== 'ALL') {
      countQuery = countQuery.eq('booking_status', bookingStatus);
    }

    const { count } = await countQuery;

    // Ambil data dengan pagination
    const { data: bookings, error } = await query
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Error fetching booking orders:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'DATABASE_ERROR', 
          message: 'Gagal mengambil data booking orders' 
        }, 
        { status: 500 }
      );
    }

    // Hitung summary
    let summaryQuery = supabase
      .from('booking_orders')
      .select('booking_status');

    // Apply same filters untuk summary
    if (shopId) {
      summaryQuery = summaryQuery.eq('shop_id', shopId);
    } else {
      const { data: userShops } = await supabase
        .from('shopee_tokens')
        .select('shop_id')
        .eq('user_id', user.id)
        .eq('is_active', true);
      
      if (userShops && userShops.length > 0) {
        const shopIds = userShops.map(shop => shop.shop_id);
        summaryQuery = summaryQuery.in('shop_id', shopIds);
      }
    }

    if (startTime) {
      summaryQuery = summaryQuery.gte('create_time', parseInt(startTime));
    }
    if (endTime) {
      summaryQuery = summaryQuery.lte('create_time', parseInt(endTime));
    }

    const { data: summaryData } = await summaryQuery;

    // Process summary
    const summary = {
      pending: 0,
      confirmed: 0,
      cancelled: 0,
      completed: 0,
      ready_to_ship: 0,
      total: count || 0
    };

    if (summaryData) {
      // Hitung status counts secara manual
      summaryData.forEach((booking: any) => {
        const status = booking.booking_status?.toLowerCase();
        switch (status) {
          case 'pending':
            summary.pending++;
            break;
          case 'confirmed':
            summary.confirmed++;
            break;
          case 'cancelled':
            summary.cancelled++;
            break;
          case 'completed':
            summary.completed++;
            break;
          case 'ready_to_ship':
            summary.ready_to_ship++;
            break;
        }
      });
    }

    // Enrich data dengan shop names
    const shopIds = Array.from(new Set(bookings?.map(b => b.shop_id) || []));
    const { data: shops } = await supabase
      .from('shopee_tokens')
      .select('shop_id, shop_name')
      .in('shop_id', shopIds);

    const shopNameMap = shops?.reduce((acc: any, shop: any) => {
      acc[shop.shop_id] = shop.shop_name;
      return acc;
    }, {}) || {};

    // Add shop names to bookings
    const enrichedBookings = bookings?.map(booking => ({
      ...booking,
      shop_name: shopNameMap[booking.shop_id] || `Shop ${booking.shop_id}`
    })) || [];

    return NextResponse.json({
      success: true,
      data: enrichedBookings,
      total: count || 0,
      summary,
      pagination: {
        offset,
        pageSize,
        hasMore: (count || 0) > offset + pageSize
      }
    });

  } catch (error) {
    console.error('Error in booking orders API:', error);
    
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