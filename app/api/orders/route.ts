import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
// Import fungsi getAllShops dari services
import { getAllShops } from '@/app/services/shopeeService';

// Definisikan type Order yang sama dengan yang ada di useOrders.ts
interface Order {
  order_sn: string;
  shop_name: string;
  order_status: string;
  total_amount: string;
  buyer_username: string;
  shipping_carrier: string;
  tracking_number: string;
  sku_qty: string;
  create_time: number;
  cod: boolean;
  cancel_reason: string;
  buyer_user_id?: number;
  shop_id?: number;
  escrow_amount_after_adjustment?: number;
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
    
    // Lakukan proses pagination di server seperti yang dilakukan di client sebelumnya
    let allOrders: Order[] = [];
    let page = 0;
    const pageSize = 800;
    let hasMore = true;
    
    // Proses pagination di server
    while (hasMore) {
      const { data, error } = await supabase
        .from('orders_view')
        .select('*')
        .filter('create_time', 'gte', parseInt(startTimestamp))
        .filter('create_time', 'lte', parseInt(endTimestamp))
        // Filter untuk hanya menampilkan pesanan dari toko milik user
        .in('shop_id', userShopIds)
        .order('pay_time', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) {
        return NextResponse.json({
          success: false,
          message: error.message
        }, { status: 500 });
      }
      
      if (data && data.length > 0) {
        // Cara yang lebih type-safe untuk menggabungkan data
        allOrders = [...allOrders, ...data as Order[]];
        page++;
      }
      
      // Jika data yang dikembalikan kurang dari pageSize, berarti sudah tidak ada lagi data
      hasMore = data && data.length === pageSize;
    }
    
    // Hitung jumlah pesanan tanpa escrow
    const ordersWithNullEscrow = allOrders.filter(
      order => order.escrow_amount_after_adjustment === null
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