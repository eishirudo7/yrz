import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
// Import fungsi getAllShops dari services
import { getAllShops } from '@/app/services/shopeeService';

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
    
    // 1. Query dasar untuk data pesanan dengan paginasi
    while (hasMore) {
      const { data: ordersPageData, error: ordersPageError } = await supabase
        .from('orders')
        .select(`
          order_sn, shop_id, order_status, cod, buyer_user_id,
          total_amount, create_time, update_time, pay_time,
          buyer_username, shipping_carrier, escrow_amount_after_adjustment,
          cancel_reason, tracking_number, document_status, is_printed
        `)
        .or(`and(cod.eq.true,create_time.gte.${startTimestampValue},create_time.lte.${endTimestamp}),and(cod.eq.false,pay_time.gte.${startTimestampValue},pay_time.lte.${endTimestamp})`)
        .in('shop_id', userShopIds)
        .order('create_time', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (ordersPageError) {
        console.error('Error fetching orders page:', ordersPageError);
        return NextResponse.json({
          success: false,
          message: ordersPageError.message
        }, { status: 500 });
      }
      
      if (ordersPageData && ordersPageData.length > 0) {
        allOrdersData = [...allOrdersData, ...ordersPageData];
        page++;
      }
      
      hasMore = ordersPageData && ordersPageData.length === pageSize;
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
    
    // Query untuk data order_items dengan batching
    let allOrderItemsData: any[] = [];
    const batchSize = 500; // PostgreSQL umumnya bisa menangani IN clause hingga ~1000 item
    
    for (let i = 0; i < orderSns.length; i += batchSize) {
      const batchOrderSns = orderSns.slice(i, i + batchSize);
      
      const { data: itemsBatchData, error: itemsBatchError } = await supabase
        .from('order_items')
        .select('order_sn, item_sku, model_sku, model_quantity_purchased, model_discounted_price')
        .in('order_sn', batchOrderSns);
      
      if (itemsBatchError) {
        console.error(`Error fetching order items batch ${i}:`, itemsBatchError);
      } else if (itemsBatchData) {
        console.log('Sample order items data:', itemsBatchData.slice(0, 2)); // Log sample data untuk debugging
        allOrderItemsData = [...allOrderItemsData, ...itemsBatchData];
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
      order => order.escrow_amount_after_adjustment === null || 
               order.escrow_amount_after_adjustment === 0
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