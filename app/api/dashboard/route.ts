import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAllShops } from '@/app/services/shopeeService';
import { startOfDay, endOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { fetchDashboardOrders, fetchOrderItemsBatch } from '@/app/services/databaseOperations';

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

    console.time('fetch_orders_dashboard');

    const ordersData = await fetchDashboardOrders(shopIds, startTimestamp, endTimestamp);

    console.timeEnd('fetch_orders_dashboard');

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

    const allOrderItemsData = await fetchOrderItemsBatch(orderSns);

    if (allOrderItemsData.length === 0) {
      console.error('Gagal mengambil data order items: Tidak ada data yang berhasil diambil');
      return NextResponse.json({
        success: false,
        message: 'Gagal mengambil data order items',
        error: 'Tidak ada data yang berhasil diambil'
      }, { status: 500 });
    }

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