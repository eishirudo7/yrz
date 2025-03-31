import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAllShops } from '@/app/services/shopeeService';

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
    
    // Ambil data pesanan
    const { data: orders, error: ordersError } = await supabase
      .from('dashboard_view')
      .select('*')
      .in('shop_id', shopIds)
      .order('pay_time', { ascending: false });
    
    if (ordersError) {
      console.error('Gagal mengambil data pesanan:', ordersError);
      return NextResponse.json({
        success: false,
        message: 'Gagal mengambil data pesanan',
        error: ordersError.message
      }, { status: 500 });
    }
    
    console.log('Orders found:', orders?.length || 0);
    
    // Proses data untuk ringkasan (hanya pesanan, tidak termasuk iklan)
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
    
    // Hitung data pesanan
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    if (orders && orders.length > 0) {
      orders.forEach(order => {
        const payDate = new Date(order.pay_time * 1000);
        const payDateStr = `${payDate.getFullYear()}-${String(payDate.getMonth() + 1).padStart(2, '0')}-${String(payDate.getDate()).padStart(2, '0')}`;
        
        const isSameDay = payDateStr === todayStr;
        
        if (isSameDay && status_yang_dihitung.includes(order.order_status)) {
          summary.totalOrders++;
          summary.totalOmset += Number(order.total_amount);
          
          const toko = order.shop_name || 'Tidak diketahui';
          summary.pesananPerToko[toko] = (summary.pesananPerToko[toko] || 0) + 1;
          summary.omsetPerToko[toko] = (summary.omsetPerToko[toko] || 0) + Number(order.total_amount);
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        summary,
        orders: orders || [],
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
