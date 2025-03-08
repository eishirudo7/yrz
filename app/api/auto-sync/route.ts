import { NextRequest, NextResponse } from 'next/server';
import { syncOrders } from '@/app/services/orderSyncs';
import { getAllShops } from '@/app/services/shopeeService';

export async function GET(request: NextRequest) {
  try {
    console.log('Memulai sinkronisasi...');
    
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - (24 * 60 * 60);

    console.log('Start Time:', new Date(startTime * 1000).toLocaleString('id-ID', { 
        timeZone: 'Asia/Jakarta',
        hour12: false 
    }));
    console.log('End Time:', new Date(endTime * 1000).toLocaleString('id-ID', { 
        timeZone: 'Asia/Jakarta',
        hour12: false 
    }));

    const shops = await getAllShops();
    
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
          }).then(resolve).catch(reject);
        });
      })
    );

    // Buat summary hasil sync
    const summary = results.reduce<Record<string, any>>((acc, result, index) => {
      const shop = shops[index];
      acc[`${shop.shop_name} (${shop.shop_id})`] = {
        status: result.status,
        ...(result.status === 'fulfilled' && { 
          total_orders: (result.value as { data: { total: number } }).data.total
        }),
        ...(result.status === 'rejected' && { error: result.reason })
      };
      return acc;
    }, {});

    const totalOrders = results.reduce((total, result) => {
      if (result.status === 'fulfilled') {
        return total + (result.value as { data: { total: number } }).data.total;
      }
      return total;
    }, 0);

    console.log('Sync selesai:', {
      total_orders: totalOrders,
      summary
    });

    // Kembalikan hasil sync
    return NextResponse.json({
      success: true,
      message: 'Sync process completed',
      timestamp: new Date().toISOString(),
      data: {
        total_orders: totalOrders,
        summary
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Sync failed:', error);
    return NextResponse.json({
      success: false,
      message: 'Sync process failed',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0