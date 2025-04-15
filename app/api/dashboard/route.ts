import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAllShops } from '@/app/services/shopeeService';
import { startOfDay, endOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

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
    const shopIds = shops.map(shop => shop.shop_id);
    
    // Konversi waktu ke zona Jakarta dan ambil timestamp
    const jakartaDate = toZonedTime(new Date(), 'Asia/Jakarta');
    const startTimestamp = Math.floor(startOfDay(jakartaDate).getTime() / 1000);
    const endTimestamp = Math.floor(endOfDay(jakartaDate).getTime() / 1000);
    
    // Query semua data secara paralel
    const [
      { data: normalOrdersData, error: normalOrdersError },
      { data: cancelledOrdersData, error: cancelledOrdersError },
      { data: shippedOrdersData, error: shippedOrdersError }
    ] = await Promise.all([
      // Query untuk mendapatkan orders dengan status non-SHIPPED dan CANCELLED
      supabase
        .from('orders')
        .select(`
          order_sn,
          shop_id,
          order_status,
          buyer_user_id,
          create_time,
          update_time,
          pay_time,
          buyer_username,
          escrow_amount_after_adjustment,
          shipping_carrier,
          cod,
          tracking_number,
          document_status,
          is_printed
        `)
        .in('shop_id', shopIds)
        .in('order_status', ['READY_TO_SHIP', 'PROCESSED', 'IN_CANCEL', 'TO_RETURN'])
        .order('pay_time', { ascending: false }),

      // Query untuk mendapatkan orders dengan status CANCELLED
      supabase
        .from('orders')
        .select(`
          order_sn,
          shop_id,
          order_status,
          buyer_user_id,
          create_time,
          update_time,
          pay_time,
          buyer_username,
          escrow_amount_after_adjustment,
          shipping_carrier,
          cod,
          tracking_number,
          document_status,
          is_printed
        `)
        .in('shop_id', shopIds)
        .eq('order_status', 'CANCELLED')
        .gte('pay_time', startTimestamp)
        .lte('pay_time', endTimestamp)
        .order('pay_time', { ascending: false }),

      // Query untuk mendapatkan orders dengan status SHIPPED
      supabase
        .from('orders')
        .select(`
          order_sn,
          shop_id,
          order_status,
          buyer_user_id,
          create_time,
          update_time,
          pay_time,
          buyer_username,
          escrow_amount_after_adjustment,
          shipping_carrier,
          cod,
          tracking_number,
          document_status,
          is_printed
        `)
        .in('shop_id', shopIds)
        .eq('order_status', 'SHIPPED')
        .gte('pickup_done_time', startTimestamp)
        .lte('pickup_done_time', endTimestamp)
        .order('pickup_done_time', { ascending: false })
    ]);

    if (normalOrdersError || cancelledOrdersError || shippedOrdersError) {
      console.error('Gagal mengambil data pesanan:', normalOrdersError || cancelledOrdersError || shippedOrdersError);
      return NextResponse.json({
        success: false,
        message: 'Gagal mengambil data pesanan',
        error: (normalOrdersError || cancelledOrdersError || shippedOrdersError)?.message
      }, { status: 500 });
    }

    // Gabungkan hasil ketiga query
    const ordersData = [
      ...(normalOrdersData || []),
      ...(cancelledOrdersData || []),
      ...(shippedOrdersData || [])
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

    // Ambil order_items dan logistic secara paralel
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
      const { data: itemsBatchData, error: itemsBatchError } = await supabase
        .from('order_items')
        .select('order_sn, model_quantity_purchased, model_discounted_price, item_sku, model_name')
        .in('order_sn', batchOrderSns);

      if (itemsBatchError) {
        console.error(`Gagal mengambil batch order items ${i}:`, itemsBatchError);
        continue;
      }
      
      if (itemsBatchData) {
        allOrderItemsData = [...allOrderItemsData, ...itemsBatchData];
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