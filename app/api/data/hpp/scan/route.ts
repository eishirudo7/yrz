import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { headers } from 'next/headers';

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }

        // Get user's shop IDs first
        const { data: userShops, error: shopError } = await supabase
            .from('shopee_tokens')
            .select('shop_id')
            .eq('user_id', user.id);

        if (shopError || !userShops || userShops.length === 0) {
            return NextResponse.json({ error: 'Tidak ada toko terhubung' }, { status: 400 });
        }

        const userShopIds = userShops.map(s => s.shop_id);

        // Get orders only from user's shops
        const { data: userOrders, error: ordError } = await supabase
            .from('orders')
            .select('order_sn, shop_id')
            .in('shop_id', userShopIds)
            .limit(2000);

        if (ordError || !userOrders || userOrders.length === 0) {
            return NextResponse.json({ message: 'Tidak ada pesanan ditemukan', skusInserted: 0 });
        }

        const userOrderSns = userOrders.map(o => o.order_sn);
        const orderShopMap: { [k: string]: number } = {};
        userOrders.forEach(o => { orderShopMap[o.order_sn] = o.shop_id; });

        // Fetch order_items in smaller batches to avoid URI too long errors
        const allOrderItems: any[] = [];
        const batchSize = 100;
        const targetOrderSns = userOrderSns.slice(0, 1000); // limit to process in one scan

        for (let i = 0; i < targetOrderSns.length; i += batchSize) {
            const batchSns = targetOrderSns.slice(i, i + batchSize);
            const { data: itemsBatch, error: batchError } = await supabase
                .from('order_items')
                .select('item_sku, model_sku, model_name, item_id, order_sn')
                .in('order_sn', batchSns);

            if (batchError) {
                console.error(`Database error fetching order_items batch ${i}:`, batchError);
                return NextResponse.json({ error: 'Gagal mengambil data pesanan', details: batchError }, { status: 500 });
            }
            if (itemsBatch) {
                allOrderItems.push(...itemsBatch);
            }
        }

        const orderItems = allOrderItems;

        const { data: existingHpp, error: hppErr } = await supabase
            .from('hpp_master')
            .select('item_sku, canonical_sku')
            .eq('user_id', user.id);

        const skuToCanonicalMap = new Map<string, string>();
        if (!hppErr && existingHpp) {
            existingHpp.forEach(h => {
                if (h.canonical_sku) {
                    skuToCanonicalMap.set(h.item_sku.toUpperCase(), h.canonical_sku);
                }
            });
        }

        const skuMap = new Map<string, { sku: string, shop_id: number, item_id: number, canonical_sku?: string }>();
        orderItems.forEach(oi => {
            const sku = (oi.item_sku && oi.item_sku.trim() !== '' && oi.item_sku !== 'EMPTY') ? oi.item_sku : oi.model_sku;
            if (!sku || !oi.item_id) return;
            const shopId = orderShopMap[oi.order_sn];
            if (!shopId) return;
            const upperSku = sku.toUpperCase();
            if (!skuMap.has(upperSku)) {
                const canonical_sku = skuToCanonicalMap.get(upperSku);
                skuMap.set(upperSku, {
                    sku,
                    shop_id: shopId,
                    item_id: oi.item_id,
                    ...(canonical_sku ? { canonical_sku } : {})
                });
            }
        });

        if (skuMap.size === 0) {
            return NextResponse.json({ message: 'Tidak ada SKU baru', skusInserted: 0 });
        }

        const allSkus = Array.from(skuMap.values());
        let totalInserted = 0;

        // Origin tracking
        const requestHeaders = await headers();
        const origin = requestHeaders.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

        // Call the internal /api/hpp/sync API route
        for (let i = 0; i < allSkus.length; i += 10) {
            const batch = allSkus.slice(i, i + 10);
            try {
                const cookieHeader = requestHeaders.get('cookie');
                const res = await fetch(`${origin}/api/hpp/sync`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
                    },
                    body: JSON.stringify({ skus: batch })
                });

                if (res.ok) {
                    const r = await res.json();
                    totalInserted += r.inserted || 0;
                }
            } catch (err) {
                console.error('Error batch syncing:', err);
            }
        }

        return NextResponse.json({ success: true, skusInserted: totalInserted });
    } catch (error) {
        console.error('Error in POST /api/data/hpp/scan:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
