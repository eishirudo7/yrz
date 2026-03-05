import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAllShops } from '@/app/services/shopeeService';
import { db } from '@/db';
import { orders, orderItems } from '@/db/schema';
import { inArray, and, or, gte, lte, eq, desc } from 'drizzle-orm';

// Definisikan type Order yang sama dengan yang ada di useOrders.ts
interface Order {
  order_sn: string;
  shop_name: string;
  order_status: string;
  total_amount: string | number;
  buyer_username: string;
  shipping_carrier: string;
  tracking_number: string;
  sku_qty: string;
  create_time: number;
  update_time?: number;
  pay_time?: number;
  cod: boolean;
  cancel_reason: string;
  buyer_user_id?: number;
  shop_id?: number;
  document_status?: string;
  is_printed?: boolean;
  escrow_amount_after_adjustment?: number;
  items: {
    sku: string;
    model_name: string;
    tier1_variation: string;
    item_id?: number;
    quantity: number;
    price: number;
    total_price: number;
  }[];
}

export async function GET(req: NextRequest) {
  try {
    // Inisialisasi Supabase client
    const supabase = await createClient();

    // Ambil user dari session
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({
        success: false,
        message: 'Pengguna tidak terautentikasi'
      }, { status: 401 });
    }

    // Gunakan getAllShops untuk mendapatkan daftar toko milik user
    const userShops = await getAllShops();

    // Jika user tidak memiliki toko, kembalikan array kosong
    if (!userShops || userShops.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        total: 0,
        ordersWithoutEscrow: []
      });
    }

    // Buat array shop_id dari toko milik user
    const userShopIds = userShops.map(shop => shop.shop_id);

    // Ambil parameter query
    const url = new URL(req.url);
    const startTimestamp = url.searchParams.get('start_timestamp');
    const endTimestamp = url.searchParams.get('end_timestamp');

    if (!startTimestamp || !endTimestamp) {
      return NextResponse.json({
        success: false,
        message: 'Parameter start_timestamp dan end_timestamp diperlukan'
      }, { status: 400 });
    }

    // Jika start_timestamp dan end_timestamp sama, berarti user ingin data untuk satu hari penuh
    let startTimestampValue = parseInt(startTimestamp);
    let endTimestampValue = parseInt(endTimestamp);

    if (startTimestampValue === endTimestampValue) {
      // Konversi timestamp ke Date untuk mendapatkan tanggal
      const dateObj = new Date(startTimestampValue * 1000);
      // Set waktu ke awal hari (00:00:00)
      dateObj.setHours(0, 0, 0, 0);
      startTimestampValue = Math.floor(dateObj.getTime() / 1000);

      // Set waktu ke akhir hari (23:59:59)
      dateObj.setHours(23, 59, 59, 999);
      endTimestampValue = Math.floor(dateObj.getTime() / 1000);

      console.log(`Mengubah rentang timestamp untuk satu hari penuh: ${startTimestampValue} - ${endTimestampValue}`);
    }

    // === OPTIMASI: Pisahkan query menjadi beberapa bagian dengan paginasi ===
    console.time('fetch_orders');

    // Lakukan proses pagination di server
    let allOrdersData: any[] = [];
    let page = 0;
    const pageSize = 800;
    let hasMore = true;

    // 1. Query dasar untuk data pesanan dengan paginasi (menggunakan Drizzle)
    while (hasMore) {
      const ordersPageData = await db.select({
        order_sn: orders.orderSn,
        shop_id: orders.shopId,
        order_status: orders.orderStatus,
        cod: orders.cod,
        buyer_user_id: orders.buyerUserId,
        total_amount: orders.totalAmount,
        create_time: orders.createTime,
        update_time: orders.updateTime,
        pay_time: orders.payTime,
        buyer_username: orders.buyerUsername,
        shipping_carrier: orders.shippingCarrier,
        escrow_amount_after_adjustment: orders.escrowAmountAfterAdjustment,
        cancel_reason: orders.cancelReason,
        tracking_number: orders.trackingNumber,
        document_status: orders.documentStatus,
        is_printed: orders.isPrinted
      })
        .from(orders)
        .where(
          and(
            inArray(orders.shopId, userShopIds),
            or(
              and(
                eq(orders.cod, true),
                gte(orders.createTime, startTimestampValue),
                lte(orders.createTime, endTimestampValue)
              ),
              and(
                eq(orders.cod, false),
                gte(orders.payTime, startTimestampValue),
                lte(orders.payTime, endTimestampValue)
              )
            )
          )
        )
        .orderBy(desc(orders.createTime))
        .limit(pageSize)
        .offset(page * pageSize);

      if (ordersPageData && ordersPageData.length > 0) {
        allOrdersData = [...allOrdersData, ...(ordersPageData as any[])];
        page++;
      } else {
        hasMore = false;
      }

      if (ordersPageData && ordersPageData.length < pageSize) {
        hasMore = false;
      }
    }

    console.log(`Total orders loaded: ${allOrdersData.length} in ${page} pages`);

    if (allOrdersData.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        total: 0,
        ordersWithoutEscrow: []
      });
    }

    // Data toko sudah tersedia dari hasil getAllShops(), tidak perlu query lagi
    // Siapkan data dalam format yang sama seperti yang diharapkan
    const shopsData = userShops.map(shop => ({
      shop_id: shop.shop_id,
      shop_name: shop.shop_name
    }));

    // Ambil unique order_sn untuk query selanjutnya
    const orderSns = Array.from(new Set(allOrdersData.map(o => o.order_sn)));

    // Data tracking sekarang sudah tersedia dalam allOrdersData, tidak perlu query terpisah

    // Query untuk data order_items dengan batching (menggunakan Drizzle)
    let allOrderItemsData: any[] = [];
    const batchSize = 500; // PostgreSQL umumnya bisa menangani IN clause hingga ~1000 item

    for (let i = 0; i < orderSns.length; i += batchSize) {
      const batchOrderSns = orderSns.slice(i, i + batchSize);

      try {
        const itemsBatchData = await db.select({
          order_sn: orderItems.orderSn,
          item_sku: orderItems.itemSku,
          model_sku: orderItems.modelSku,
          model_name: orderItems.modelName,
          model_quantity_purchased: orderItems.modelQuantityPurchased,
          model_discounted_price: orderItems.modelDiscountedPrice,
          item_id: orderItems.itemId
        })
          .from(orderItems)
          .where(inArray(orderItems.orderSn, batchOrderSns));

        if (itemsBatchData) {
          allOrderItemsData = [...allOrderItemsData, ...itemsBatchData];
        }
      } catch (itemsBatchError) {
        console.error(`Error fetching order items batch ${i}:`, itemsBatchError);
      }
    }

    // 5. Gabungkan data di server
    const allOrders = allOrdersData.map(order => {
      // Cari data toko
      const shop = shopsData?.find(s => s.shop_id === order.shop_id) || { shop_name: 'Tidak diketahui' };

      // Kumpulkan item untuk format sku_qty dan hitung total
      const items = allOrderItemsData?.filter(i => i.order_sn === order.order_sn) || [];

      // Hitung ulang total_amount dari order_items (seperti pada view SQL)
      const recalculated_total_amount = items.reduce((total, item) => {
        const price = parseFloat(item.model_discounted_price || 0);
        const quantity = parseInt(item.model_quantity_purchased || 0);
        return total + (price * quantity);
      }, 0);

      const skuQty = items.length > 0
        ? items.map(item => `${(item.item_sku && item.item_sku !== 'EMPTY' && item.item_sku.trim() !== '') ? item.item_sku : item.model_sku} (${item.model_quantity_purchased})`).join(', ')
        : '';

      // Gabungkan semua data
      return {
        order_sn: order.order_sn,
        shop_id: order.shop_id,
        shop_name: shop.shop_name,
        order_status: order.order_status,
        cod: order.cod,
        buyer_user_id: order.buyer_user_id,
        total_amount: order.total_amount,
        recalculated_total_amount: recalculated_total_amount || order.total_amount,
        create_time: order.create_time,
        update_time: order.update_time,
        pay_time: order.pay_time,
        buyer_username: order.buyer_username,
        shipping_carrier: order.shipping_carrier,
        tracking_number: order.tracking_number,
        document_status: order.document_status,
        is_printed: order.is_printed,
        sku_qty: skuQty,
        cancel_reason: order.cancel_reason,
        escrow_amount_after_adjustment: order.escrow_amount_after_adjustment,
        items: items.map(item => ({
          sku: (item.item_sku && item.item_sku !== 'EMPTY' && item.item_sku.trim() !== '') ? item.item_sku : item.model_sku,
          model_name: item.model_name || '',
          tier1_variation: item.model_name ? item.model_name.split(',')[0].trim() : '',
          item_id: item.item_id,
          quantity: parseInt(item.model_quantity_purchased || '0'),
          price: parseFloat(item.model_discounted_price || '0'),
          total_price: parseFloat(item.model_discounted_price || '0') * parseInt(item.model_quantity_purchased || '0')
        }))
      } as Order;
    });

    // Urutkan pesanan berdasarkan kriteria:
    // - Jika COD, gunakan create_time
    // - Jika bukan COD, gunakan pay_time (dengan fallback ke create_time)
    allOrders.sort((a, b) => {
      const aTime = a.cod ? a.create_time : (a.pay_time || a.create_time);
      const bTime = b.cod ? b.create_time : (b.pay_time || b.create_time);
      return bTime - aTime;
    });

    console.timeEnd('fetch_orders');

    // Hitung jumlah pesanan tanpa escrow
    const ordersWithNullEscrow = allOrders.filter(
      order => (order.escrow_amount_after_adjustment === null ||
        order.escrow_amount_after_adjustment === 0) &&
        order.order_status !== 'CANCELLED' &&
        order.order_status !== 'UNPAID'
    );

    return NextResponse.json({
      success: true,
      data: allOrders,
      total: allOrders.length,
      ordersWithoutEscrow: ordersWithNullEscrow
    });
  } catch (error) {
    console.error('Error mengambil orders:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan saat mengambil data orders'
    }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { order_sn, update_data } = await req.json();

    if (!order_sn || !update_data) {
      return NextResponse.json({ success: false, message: 'Invalid payload' }, { status: 400 });
    }

    // Mapping update_data (snake_case) to Schema definition (camelCase)
    const updatePayload: any = {};
    if (update_data.is_printed !== undefined) {
      updatePayload.isPrinted = update_data.is_printed;
    }
    // Add other fields mapped here later as needed

    if (Object.keys(updatePayload).length > 0) {
      await db.update(orders)
        .set(updatePayload)
        .where(eq(orders.orderSn, order_sn));
    }

    return NextResponse.json({ success: true, message: 'Order updated' });
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ success: false, message: 'Failed to update order' }, { status: 500 });
  }
}