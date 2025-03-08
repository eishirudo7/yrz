import { NextRequest, NextResponse } from 'next/server';
import { syncOrders } from '@/app/services/orderSyncs';
import { getAllShops } from '@/app/services/shopeeService';


export async function GET(request: NextRequest) {
  try {
    console.log('Memulai sinkronisasi...');

    // Waktu sekarang dalam detik (tanpa perlu menambah offset)
    const endTime = Math.floor(Date.now() / 1000); // Konversi ke detik
    const startTime = endTime - (24 * 60 * 60); // 1 jam dalam detik

    // Tampilkan startTime dan endTime dalam format string
    console.log('Start Time:', new Date(startTime * 1000).toLocaleString('id-ID', { 
        timeZone: 'Asia/Jakarta',
        hour12: false 
    }));
    console.log('End Time:', new Date(endTime * 1000).toLocaleString('id-ID', { 
        timeZone: 'Asia/Jakarta',
        hour12: false 
    }));
    

    // Daftar toko yang akan disinkronkan
    const shops = await getAllShops();

    // Jalankan sinkronisasi untuk setiap toko
    const results = await Promise.allSettled(
      shops.map(async (shop) => {
        return new Promise((resolve, reject) => {
          syncOrders(shop.shop_id, {
            timeRangeField: 'create_time',
            startTime,
            endTime,
            orderStatus: 'ALL',
            onProgress: ({ current, total }) => {
              console.log(`Shop ${shop.shop_name} (${shop.shop_id}): ${current}/${total}`);
            },
            onError: (error) => {
              console.error(`Error syncing shop ${shop.shop_name} (${shop.shop_id}):`, error);
              reject(error);
            }
          }).then((orderCount) => {
            resolve(orderCount); // Asumsikan syncOrders mengembalikan jumlah pesanan
          }).catch(reject);
        });
      })
    );

    // Analisis hasil
    const summary = results.reduce<Record<string, any>>((acc, result, index) => {
      const shop = shops[index];
      acc[`${shop.shop_name} (${shop.shop_id})`] = {
        status: result.status,
        ...(result.status === 'fulfilled' && { 
          total_orders: (result.value as { data: { total: number } }).data.total // Ambil total dari data dengan type assertion
        }),
        ...(result.status === 'rejected' && { error: result.reason })
      };
      return acc;
    }, {});

    // Hitung total keseluruhan
    const totalOrders = results.reduce((total, result) => {
      if (result.status === 'fulfilled') {
        return total + (result.value as { data: { total: number } }).data.total;
      }
      return total;
    }, 0);

    return NextResponse.json({
      success: true,
      message: `Sync completed`,
      total_orders: totalOrders, // Tambahkan total keseluruhan
      summary
    });

  } catch (error: unknown) {
    console.error('Auto sync failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
} 

export const dynamic = 'force-dynamic'
export const revalidate = 0