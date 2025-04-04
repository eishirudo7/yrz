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

    // Jalankan sinkronisasi pesanan 7 hari terakhir secara asynchronous
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
 * Fungsi untuk memicu sinkronisasi pesanan pertama kali setelah penambahan toko
 * Dijalankan secara asynchronous tanpa menunggu hasilnya
 */
async function triggerInitialSync(shopId: number) {
    try {
        console.log(`Memulai sinkronisasi awal untuk toko ${shopId}...`);
        
        // Tunggu sebentar agar token tersimpan dengan baik di database
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Jalankan sinkronisasi pesanan 7 hari terakhir
        const now = Math.floor(Date.now() / 1000);
        const result = await syncOrders(shopId, {
            timeRangeField: 'create_time',
            startTime: now - (7 * 24 * 60 * 60), // 7 hari terakhir
            endTime: now,
            orderStatus: 'ALL',
            pageSize: 50,
            onProgress: (progress) => {
                console.log(`Sinkronisasi toko ${shopId}: ${progress.current}/${progress.total} pesanan terproses`);
            }
        });
        
        if (result.success) {
            console.log(`Sinkronisasi awal toko ${shopId} selesai: ${result.data?.processed || 0}/${result.data?.total || 0} pesanan berhasil disinkronkan`);
        } else {
            console.error(`Sinkronisasi awal toko ${shopId} gagal:`, result.error);
        }
    } catch (error) {
        console.error(`Error saat melakukan sinkronisasi awal toko ${shopId}:`, error);
    }
}