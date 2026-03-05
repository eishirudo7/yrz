import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/db';
import { bookingOrders, shopeeTokens } from '@/db/schema';
import { inArray, and, eq, gte, lte, desc, count } from 'drizzle-orm';

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

    // Base conditions
    let conditions: any[] = [];

    // Filter berdasarkan shopId jika ada
    if (shopId) {
      conditions.push(eq(bookingOrders.shopId, Number(shopId)));
    } else {
      // Jika tidak ada shopId, filter berdasarkan toko yang dimiliki user
      const userShops = await db.select({ shop_id: shopeeTokens.shopId })
        .from(shopeeTokens)
        .where(and(eq(shopeeTokens.userId, user.id), eq(shopeeTokens.isActive, true)));

      if (userShops && userShops.length > 0) {
        const shopIds = userShops.map(shop => shop.shop_id);
        conditions.push(inArray(bookingOrders.shopId, shopIds));
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
    if (startTime) conditions.push(gte(bookingOrders.createTime, parseInt(startTime)));
    if (endTime) conditions.push(lte(bookingOrders.createTime, parseInt(endTime)));

    // Filter berdasarkan status
    if (bookingStatus && bookingStatus !== 'ALL') {
      conditions.push(eq(bookingOrders.bookingStatus, bookingStatus));
    }

    const { and: sqlAnd } = require('drizzle-orm');
    const finalWhere = conditions.length > 0 ? sqlAnd(...conditions) : undefined;

    // Ambil total count untuk summary
    const countResult = await db.select({ value: count() })
      .from(bookingOrders)
      .where(finalWhere);

    const totalCount = countResult[0].value;

    // Ambil data dengan pagination
    const bookingsData = await db.select()
      .from(bookingOrders)
      .where(finalWhere)
      .orderBy(desc(bookingOrders.createTime))
      .limit(pageSize)
      .offset(offset);

    // Hitung summary menggunakan agregasi manual dari DB jika mungkin, tapi karena Drizzle, kita ambil grouping
    // Atau bisa fetch id dan status saja untuk grouping karena limitnya mungkin kecil (atau bisa count group by)
    // Untuk menjaga perilaku lama, kita ambil semua status yang cocok dengan filter.
    const summaryDataQuery = await db.select({ booking_status: bookingOrders.bookingStatus })
      .from(bookingOrders)
      .where(finalWhere);

    // Process summary
    const summary = {
      pending: 0,
      confirmed: 0,
      cancelled: 0,
      completed: 0,
      ready_to_ship: 0,
      total: totalCount || 0
    };

    if (summaryDataQuery) {
      // Hitung status counts secara manual
      summaryDataQuery.forEach((booking: any) => {
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
    const shopIds = Array.from(new Set(bookingsData.map(b => b.shopId) || []));

    let shopNameMap: Record<number, string> = {};
    if (shopIds.length > 0) {
      const shops = await db.select({ shop_id: shopeeTokens.shopId, shop_name: shopeeTokens.shopName })
        .from(shopeeTokens)
        .where(inArray(shopeeTokens.shopId, shopIds));

      shopNameMap = shops.reduce((acc: any, shop: any) => {
        acc[shop.shop_id] = shop.shop_name;
        return acc;
      }, {});
    }

    // Add shop names and mapping to snake_case format to bookings
    const enrichedBookings = bookingsData.map(booking => ({
      id: booking.id,
      shop_id: booking.shopId,
      booking_sn: booking.bookingSn,
      order_sn: booking.orderSn,
      booking_status: booking.bookingStatus,
      match_status: booking.matchStatus,
      shipping_carrier: booking.shippingCarrier,
      create_time: booking.createTime,
      update_time: booking.updateTime,
      recipient_address: booking.recipientAddress,
      item_list: booking.itemList,
      dropshipper: booking.dropshipper,
      dropshipper_phone: booking.dropshipperPhone,
      cancel_by: booking.cancelBy,
      cancel_reason: booking.cancelReason,
      fulfillment_flag: booking.fulfillmentFlag,
      pickup_done_time: booking.pickupDoneTime,
      tracking_number: booking.trackingNumber,
      is_printed: booking.isPrinted,
      document_status: booking.documentStatus,
      shop_name: shopNameMap[booking.shopId] || `Shop ${booking.shopId}`
    }));

    return NextResponse.json({
      success: true,
      data: enrichedBookings,
      total: totalCount || 0,
      summary,
      pagination: {
        offset,
        pageSize,
        hasMore: (totalCount || 0) > offset + pageSize
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