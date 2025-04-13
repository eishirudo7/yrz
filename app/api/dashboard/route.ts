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
          cod
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
          cod
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
          ship_by_date,
          shop_id,
          order_status,
          buyer_user_id,
          create_time,
          update_time,
          pay_time,
          buyer_username,
          shipping_carrier,
          cod
        `)
        .in('shop_id', shopIds)
        .eq('order_status', 'SHIPPED')
        .gte('update_time', startTimestamp)
        .lte('update_time', endTimestamp)
        .order('update_time', { ascending: false })
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
    const [
      { data: orderItemsData, error: orderItemsError },
      { data: logisticData, error: logisticError }
    ] = await Promise.all([
      supabase
        .from('order_items')
        .select('order_sn, model_quantity_purchased, model_discounted_price, item_sku, model_name')
        .in('order_sn', orderSns),
      
      supabase
        .from('logistic')
        .select('order_sn, tracking_number, document_status, is_printed')
        .in('order_sn', orderSns)
    ]);

    if (orderItemsError) {
      console.error('Gagal mengambil data order items:', orderItemsError);
      return NextResponse.json({
        success: false,
        message: 'Gagal mengambil data order items',
        error: orderItemsError.message
      }, { status: 500 });
    }

    if (logisticError) {
      console.error('Gagal mengambil data logistik:', logisticError);
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
      const items = orderItemsData?.filter(item => item.order_sn === order.order_sn) || [];
      const logistic = logisticData?.find(l => l.order_sn === order.order_sn);

      // Proses items tanpa order_sn
      const processedItems = items.map(({ order_sn, ...item }) => ({
        ...item,
        model_quantity_purchased: parseInt(item.model_quantity_purchased || '0'),
        model_discounted_price: parseFloat(item.model_discounted_price || '0')
      }));

      return {
        ...order,
        shop_name: shop?.shop_name || 'Tidak diketahui',
        tracking_number: logistic?.tracking_number,
        document_status: logistic?.document_status,
        is_printed: logistic?.is_printed || false,
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