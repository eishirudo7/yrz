import { NextResponse } from 'next/server';
import { getReadyToShipOrders, processReadyToShipOrders, getAllShops } from '@/app/services/shopeeService';

// Tambahkan interface ini di bagian atas file
interface Shop {
    shop_name: string;
    shop_id: string;
    access_token: string;
}


async function getAllOrders(shopId: string, accessToken: string) {
    // Definisikan interface untuk order (sesuaikan dengan struktur data dari Shopee API)
    interface ShopeeOrder {
        order_sn: string;
        // ... properti lainnya jika diperlukan
    }
    
    let allOrders: ShopeeOrder[] = [];
    let hasMore = true;
    let cursor = '';
    let successfulOrders = 0;
    
    console.log('Original shopId:', shopId, 'Type:', typeof shopId);
    
    const numericShopId = Number(shopId);
    
    console.log('Converted shopId:', numericShopId, 'Type:', typeof numericShopId);
    
    if (isNaN(numericShopId)) {
        throw new Error('Shop ID tidak valid: ' + shopId);
    }
    
    while (hasMore) {
        const orders = await getReadyToShipOrders(numericShopId, accessToken);
        
        if (orders.response?.order_list && orders.response.order_list.length > 0) {
            console.log(`Memproses ${orders.response.order_list.length} pesanan...`);
            
            for (const order of orders.response.order_list) {
                try {
                    const processResult = await processReadyToShipOrders(
                        numericShopId,
                        order.order_sn,
                        'dropoff'
                    );
                    
                    if (processResult.success) {
                        successfulOrders++;
                    }
                    
                    console.log('Hasil proses pesanan:', JSON.stringify(processResult, null, 2));
                } catch (error) {
                    console.error(`Gagal memproses pesanan ${order.order_sn}:`, error);
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            allOrders = [...allOrders, ...orders.response.order_list];
        }
        
        hasMore = orders.response?.more || false;
        cursor = orders.response?.next_cursor || '';
        
        // Tambah delay untuk menghindari rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return {
        totalOrders: allOrders.length,
        successfulOrders,
        orders: allOrders
    };
}

export async function GET(): Promise<Response> {
    try {
        const shops = await getAllShops() as Shop[];
        
        console.log('Data shops dari database:', JSON.stringify(shops, null, 2));
        
        if (!Array.isArray(shops) || shops.length === 0) {
            return NextResponse.json({
                success: false,
                message: 'Gagal mendapatkan daftar toko',
                error: 'Tidak ada data toko yang ditemukan'
            }, { status: 400 });
        }

        const allShopOrders = [];
        for (const shop of shops) {
            if (!shop.shop_id) {
                console.error(`Shop ID tidak ditemukan untuk ${shop.shop_name}`);
                continue;
            }
            
            console.log(`Mengambil pesanan untuk ${shop.shop_name}...`);
            const orderResult = await getAllOrders(shop.shop_id, shop.access_token);
            console.log(`${shop.shop_name}: Total ${orderResult.totalOrders} pesanan, ${orderResult.successfulOrders} berhasil diproses`);
            
            allShopOrders.push({
                shop_name: shop.shop_name,
                shop_id: shop.shop_id,
                total_orders: orderResult.totalOrders,
                successful_orders: orderResult.successfulOrders,
                orders: orderResult.orders
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Berhasil mendapatkan semua pesanan',
            data: allShopOrders,
            summary: allShopOrders.map(shop => ({
                shop_name: shop.shop_name,
                total_orders: shop.total_orders,
                successful_orders: shop.successful_orders
            }))
        }, { status: 200 });
    } catch (error) {
        console.error('Error in GET orders:', error);
        return NextResponse.json({
            success: false,
            message: 'Terjadi kesalahan saat mengambil pesanan',
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// Tambahkan export config untuk mencegah static generation
export const dynamic = 'force-dynamic'
export const revalidate = 0
