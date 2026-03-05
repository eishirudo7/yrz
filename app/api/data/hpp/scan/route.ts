import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/db';
import { shopeeTokens, orders as ordersTable, orderItems } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';

export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        // Get user's shop IDs
        const userShops = await db.select({ shop_id: shopeeTokens.shopId })
            .from(shopeeTokens)
            .where(eq(shopeeTokens.userId, user.id));

        if (!userShops || userShops.length === 0) {
            return NextResponse.json({ success: false, message: 'Tidak ada toko terhubung', skus: [] });
        }

        const userShopIds = userShops.map(s => s.shop_id);

        // Get orders only from user's shops
        const userOrders = await db.select({ order_sn: ordersTable.orderSn, shop_id: ordersTable.shopId })
            .from(ordersTable)
            .where(inArray(ordersTable.shopId, userShopIds))
            .limit(2000);

        if (!userOrders || userOrders.length === 0) {
            return NextResponse.json({ success: false, message: 'Tidak ada pesanan ditemukan', skus: [] });
        }

        const userOrderSns = userOrders.map(o => o.order_sn);
        const orderShopMap: { [k: string]: number } = {};
        userOrders.forEach(o => { orderShopMap[o.order_sn] = o.shop_id; });

        // Get order_items
        const items = await db.select({
            item_sku: orderItems.itemSku,
            model_sku: orderItems.modelSku,
            model_name: orderItems.modelName,
            item_id: orderItems.itemId,
            order_sn: orderItems.orderSn
        })
            .from(orderItems)
            .where(inArray(orderItems.orderSn, userOrderSns.slice(0, 1000)));

        const skuMap = new Map<string, { sku: string, shop_id: number, item_id: number }>();
        items.forEach(oi => {
            const sku = (oi.item_sku && oi.item_sku.trim() !== '' && oi.item_sku !== 'EMPTY') ? oi.item_sku : oi.model_sku;
            if (!sku || !oi.item_id || !oi.order_sn) return;

            const shopId = orderShopMap[oi.order_sn];
            if (!shopId) return;

            const upperSku = sku.toUpperCase();
            if (!skuMap.has(upperSku)) {
                skuMap.set(upperSku, { sku, shop_id: shopId, item_id: oi.item_id });
            }
        });

        const allSkus = Array.from(skuMap.values());

        return NextResponse.json({ success: true, skus: allSkus });
    } catch (error: any) {
        console.error('Error scanning skus:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
