import { NextRequest, NextResponse } from 'next/server';
import { getTokens } from '@/app/services/tokenManager';
import { unblockShopWebhook } from '@/app/services/shopeeService';
import { syncOrders } from '@/app/services/orderSyncs';

export async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get('code');
    const shopId = request.nextUrl.searchParams.get('shop_id');

    if (!code || !shopId) {
        return NextResponse.json({ error: 'Code or shop_id is missing' }, { status: 400 });
    }

    const tokens = await getTokens(code, Number(shopId));
    
    await unblockShopWebhook(Number(shopId));

    // Jalankan sinkronisasi pesanan dan produk secara asynchronous
    // Kita tidak menunggu promise ini selesai agar tidak menunda redirect
    triggerInitialSync(Number(shopId));

    // Ambil host dari request headers
    const host = request.headers.get('host');
    // Tentukan protocol (https untuk production, http untuk development)
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    
    const baseUrl = `${protocol}://${host}`;
    const redirectUrl = new URL('/shops', baseUrl);
    console.log('Redirect URL:', redirectUrl.toString());
    return NextResponse.redirect(redirectUrl);
}

/**
 * Fungsi untuk memicu sinkronisasi data pertama kali setelah penambahan toko
 * Dijalankan secara asynchronous tanpa menunggu hasilnya
 */
async function triggerInitialSync(shopId: number) {
    try {
        console.log(`Memulai sinkronisasi awal untuk toko ${shopId}...`);
        
        // Tunggu sebentar agar token tersimpan dengan baik di database
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Jalankan sinkronisasi pesanan 7 hari terakhir
        const now = Math.floor(Date.now() / 1000);
        const orderResult = await syncOrders(shopId, {
            timeRangeField: 'create_time',
            startTime: now - (7 * 24 * 60 * 60), // 7 hari terakhir
            endTime: now,
            orderStatus: 'ALL',
            pageSize: 50,
            onProgress: (progress) => {
                console.log(`Sinkronisasi pesanan toko ${shopId}: ${progress.current}/${progress.total} pesanan terproses`);
            }
        });
        
        if (orderResult.success) {
            console.log(`Sinkronisasi awal pesanan toko ${shopId} selesai: ${orderResult.data?.processed || 0}/${orderResult.data?.total || 0} pesanan berhasil disinkronkan`);
        } else {
            console.error(`Sinkronisasi awal pesanan toko ${shopId} gagal:`, orderResult.error);
        }

        // Jalankan sinkronisasi produk
        await syncProducts(shopId);
        
    } catch (error) {
        console.error(`Error saat melakukan sinkronisasi awal toko ${shopId}:`, error);
    }
}

/**
 * Fungsi untuk sinkronisasi produk dari toko yang baru ditambahkan
 */
async function syncProducts(shopId: number) {
    try {
        console.log(`Memulai sinkronisasi produk untuk toko ${shopId}...`);
        
        // Ambil data produk dari API
        const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/produk?shop_id=${shopId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Gagal mengambil data produk');
        }
        
        // Buat client Supabase
        const { createClient } = await import('@/utils/supabase/server');
        const supabase = await createClient();
        
        console.log(`Memproses ${data.data.items.length} produk dari toko ${shopId}...`);
        
        // Simpan data produk ke database
        let processedCount = 0;
        for (const item of data.data.items) {
            // Insert/Update item
            const { error } = await supabase.from('items').upsert({
                item_id: item.item_id,
                shop_id: shopId,
                category_id: item.category_id,
                item_name: item.item_name,
                description: item.description,
                item_sku: item.item_sku,
                create_time: item.create_time,
                update_time: item.update_time,
                weight: item.weight,
                image: item.image,
                logistic_info: item.logistic_info,
                pre_order: item.pre_order,
                condition: item.condition,
                item_status: item.item_status,
                has_model: item.has_model,
                brand: item.brand,
                item_dangerous: item.item_dangerous,
                description_type: item.description_type,
                size_chart_id: item.size_chart_id,
                promotion_image: item.promotion_image,
                deboost: item.deboost === 'FALSE' ? false : true,
                authorised_brand_id: item.authorised_brand_id
            }, { 
                onConflict: 'item_id' 
            });
                
            if (error) {
                console.error(`Gagal menyimpan produk ${item.item_id}:`, error);
                continue;
            }
            
            processedCount++;
        }
        
        console.log(`Sinkronisasi produk toko ${shopId} selesai: ${processedCount}/${data.data.items.length} produk berhasil disinkronkan`);
        
        return {
            success: true,
            processed: processedCount,
            total: data.data.items.length
        };
        
    } catch (error) {
        console.error(`Error saat melakukan sinkronisasi produk toko ${shopId}:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
        };
    }
}