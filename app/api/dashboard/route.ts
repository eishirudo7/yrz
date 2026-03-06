import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAllShops } from '@/app/services/shopeeService';
import { startOfDay, endOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { db } from '@/db';
import { orders, orderItems } from '@/db/schema';
import { inArray, and, gte, lte, eq, desc } from 'drizzle-orm';

// Pastikan fungsi GET diekspor dengan benar
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Ambil user yang sedang login
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({
        success: false,
        message: 'Pengguna tidak terautentikasi'
      }, { status: 401 });
    }

    // Gunakan getAllShops() untuk mendapatkan toko milik user
    const shops = await getAllShops();

    if (!shops || shops.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          summary: {
            pesananPerToko: {},
            omsetPerToko: {},
            totalOrders: 0,
            totalOmset: 0
          },
          orders: [],
          shops: []
        }
      });
    }

    console.log('Shops found:', shops.length);

    // Ambil shop_ids untuk filter
    const shopIds = shops.map(shop => shop.shop_id).filter(id => id !== undefined && id !== null);

    if (shopIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          summary: {
            pesananPerToko: {},
            omsetPerToko: {},
            totalOrders: 0,
            totalOmset: 0
          },
          orders: [],
          shops: []
        }
      });
    }

    // Konversi waktu ke zona Jakarta dan ambil timestamp
    const jakartaDate = toZonedTime(new Date(), 'Asia/Jakarta');
    const startTimestamp = Math.floor(startOfDay(jakartaDate).getTime() / 1000);
    const endTimestamp = Math.floor(endOfDay(jakartaDate).getTime() / 1000);

    console.time('fetch_orders_dashboard_drizzle');

    // Drizzle Queries don't require manual pagination because we query local postgres
    const normalOrdersData = await db.select({
      order_sn: orders.orderSn,
      shop_id: orders.shopId,
      order_status: orders.orderStatus,
      buyer_user_id: orders.buyerUserId,
      create_time: orders.createTime,
      update_time: orders.updateTime,
      pay_time: orders.payTime,
      buyer_username: orders.buyerUsername,
      escrow_amount_after_adjustment: orders.escrowAmountAfterAdjustment,
      shipping_carrier: orders.shippingCarrier,
      cod: orders.cod,
      tracking_number: orders.trackingNumber,
      document_status: orders.documentStatus,
      is_printed: orders.isPrinted
    })
      .from(orders)
      .where(
        and(
          inArray(orders.shopId, shopIds),
          inArray(orders.orderStatus, ['READY_TO_SHIP', 'PROCESSED', 'IN_CANCEL', 'TO_RETURN'])
        )
      )
      .orderBy(desc(orders.payTime));

    const cancelledOrdersData = await db.select({
      order_sn: orders.orderSn,
      shop_id: orders.shopId,
      order_status: orders.orderStatus,
      buyer_user_id: orders.buyerUserId,
      create_time: orders.createTime,
      update_time: orders.updateTime,
      pay_time: orders.payTime,
      buyer_username: orders.buyerUsername,
      escrow_amount_after_adjustment: orders.escrowAmountAfterAdjustment,
      shipping_carrier: orders.shippingCarrier,
      cod: orders.cod,
      tracking_number: orders.trackingNumber,
      document_status: orders.documentStatus,
      is_printed: orders.isPrinted
    })
      .from(orders)
      .where(
        and(
          inArray(orders.shopId, shopIds),
          eq(orders.orderStatus, 'CANCELLED'),
          gte(orders.payTime, startTimestamp),
          lte(orders.payTime, endTimestamp)
        )
      )
      .orderBy(desc(orders.payTime));

    const shippedOrdersData = await db.select({
      order_sn: orders.orderSn,
      shop_id: orders.shopId,
      order_status: orders.orderStatus,
      buyer_user_id: orders.buyerUserId,
      create_time: orders.createTime,
      update_time: orders.updateTime,
      pay_time: orders.payTime,
      buyer_username: orders.buyerUsername,
      escrow_amount_after_adjustment: orders.escrowAmountAfterAdjustment,
      shipping_carrier: orders.shippingCarrier,
      cod: orders.cod,
      tracking_number: orders.trackingNumber,
      document_status: orders.documentStatus,
      is_printed: orders.isPrinted
    })
      .from(orders)
      .where(
        and(
          inArray(orders.shopId, shopIds),
          eq(orders.orderStatus, 'SHIPPED'),
          gte(orders.pickupDoneTime, startTimestamp),
          lte(orders.pickupDoneTime, endTimestamp)
        )
      )
      .orderBy(desc(orders.pickupDoneTime));

    console.timeEnd('fetch_orders_dashboard_drizzle');

    // Gabungkan hasil ketiga query
    const ordersData = [
      ...(normalOrdersData as any[]),
      ...(cancelledOrdersData as any[]),
      ...(shippedOrdersData as any[])
    ];


    if (!ordersData || ordersData.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          summary: {
            pesananPerToko: {},
            omsetPerToko: {},
            totalOrders: 0,
            totalOmset: 0
          },
          orders: [],
          shops: shops
        }
      });
    }

    // Ambil order_items secara paralel
    const orderSns = ordersData.map(order => order.order_sn);

    // Implementasi batching untuk order_items
    const batchSize = 500; // PostgreSQL umumnya bisa menangani IN clause hingga ~1000 item

    interface OrderItem {
      order_sn: string;
      model_quantity_purchased: string | number;
      model_discounted_price: string | number;
      item_sku: string;
      model_name: string;
    }

    let allOrderItemsData: OrderItem[] = [];

    // Batch processing untuk order_items
    for (let i = 0; i < orderSns.length; i += batchSize) {
      const batchOrderSns = orderSns.slice(i, i + batchSize);

      try {
        const itemsBatchData = await db.select({
          order_sn: orderItems.orderSn,
          model_quantity_purchased: orderItems.modelQuantityPurchased,
          model_discounted_price: orderItems.modelDiscountedPrice,
          item_sku: orderItems.itemSku,
          model_name: orderItems.modelName
        })
          .from(orderItems)
          .where(inArray(orderItems.orderSn, batchOrderSns));

        if (itemsBatchData) {
          allOrderItemsData = [...allOrderItemsData, ...(itemsBatchData as any[])];
        }
      } catch (itemsBatchError) {
        console.error(`Gagal mengambil batch order items ${i}:`, itemsBatchError);
      }
    }

    if (allOrderItemsData.length === 0) {
      console.error('Gagal mengambil data order items: Tidak ada data yang berhasil diambil');
      return NextResponse.json({
        success: false,
        message: 'Gagal mengambil data order items',
        error: 'Tidak ada data yang berhasil diambil'
      }, { status: 500 });
    }

    // Proses data untuk summary
    const status_yang_dihitung = ['IN_CANCEL', 'PROCESSED', 'READY_TO_SHIP', 'SHIPPED'];
    const summary = {
      pesananPerToko: {} as Record<string, number>,
      omsetPerToko: {} as Record<string, number>,
      totalOrders: 0,
      totalOmset: 0
    };

    // Inisialisasi data per toko
    shops.forEach(shop => {
      summary.pesananPerToko[shop.shop_name] = 0;
      summary.omsetPerToko[shop.shop_name] = 0;
    });

    // Gabungkan dan proses data
    const processedOrders = ordersData.map(order => {
      const shop = shops.find(s => s.shop_id === order.shop_id);
      const items = allOrderItemsData.filter(item => item.order_sn === order.order_sn) || [];

      // Proses items tanpa order_sn
      const processedItems = items.map(({ order_sn, ...item }) => ({
        ...item,
        model_quantity_purchased: parseInt(String(item.model_quantity_purchased || '0')),
        model_discounted_price: parseFloat(String(item.model_discounted_price || '0'))
      }));

      return {
        ...order,
        shop_name: shop?.shop_name || 'Tidak diketahui',
        items: processedItems
      };
    });

    // Urutkan processedOrders berdasarkan pay_time (dari terbaru ke lama)
    processedOrders.sort((a, b) => {
      const aTime = a.pay_time || a.create_time;
      const bTime = b.pay_time || b.create_time;
      return bTime - aTime;
    });

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          pesananPerToko: {},
          omsetPerToko: {},
          totalOrders: 0,
          totalOmset: 0
        },
        orders: processedOrders,
        shops: shops
      }
    });

  } catch (error) {
    console.error('Error saat mengambil data dashboard:', error);
    return NextResponse.json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data dashboard',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}