import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/db';
import { orders, orderItems } from '@/db/schema';
import { inArray, ilike, eq, desc } from 'drizzle-orm';
import { getAllShops } from '@/app/services/shopeeService';

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const order_sn = searchParams.get('order_sn');
        const buyer_username = searchParams.get('buyer_username');
        const tracking_number = searchParams.get('tracking_number');

        // Ensure we are fetching specifically for the user's shops
        const userShops = await getAllShops();
        if (!userShops || userShops.length === 0) {
            return NextResponse.json({ success: true, data: [] });
        }
        const userShopIds = userShops.map(shop => shop.shop_id);

        // Build the query safely
        let query = db.select().from(orders).where(inArray(orders.shopId, userShopIds));

        // Refine Query if filters are active
        // Dynamic builder approach natively supported by Drizzle ORM using array destructuring

        // Dynamic builder approach
        let conditions = [inArray(orders.shopId, userShopIds)];
        if (order_sn) conditions.push(ilike(orders.orderSn, `%${order_sn}%`));
        if (buyer_username) conditions.push(ilike(orders.buyerUsername, `%${buyer_username}%`));
        if (tracking_number) conditions.push(ilike(orders.trackingNumber, `%${tracking_number}%`));

        // Combine conditions dynamically using `and`? No, drizzle requires a small utility
        // But we know that Drizzle AND accepts varargs
        const finalWhere = conditions.length > 1
            ? Object.assign({}, ...conditions) // Simplistic approach - better to use direct sql if complex, but here we can just rebuild the query
            : conditions[0];

        // Let's use the standard builder properly:
        // Actually, in drizzle-orm: `and(...conditions)` works array destructured.
        const sqlAnd = require('drizzle-orm').and;

        const dbOrders = await db.select()
            .from(orders)
            .where(sqlAnd(...conditions))
            .orderBy(desc(orders.createTime))
            .limit(100); // Prevent massive payloads on search

        if (!dbOrders || dbOrders.length === 0) {
            return NextResponse.json({ success: true, data: [] });
        }

        const orderSns = dbOrders.map(o => o.orderSn);

        const dbItems = await db.select({
            order_sn: orderItems.orderSn,
            item_sku: orderItems.itemSku,
            model_sku: orderItems.modelSku,
            model_quantity_purchased: orderItems.modelQuantityPurchased,
            model_discounted_price: orderItems.modelDiscountedPrice
        })
            .from(orderItems)
            .where(inArray(orderItems.orderSn, orderSns));

        // Map properties to snake_case just like Supabase did
        const mappedOrders = dbOrders.map(o => ({
            order_sn: o.orderSn,
            shop_id: o.shopId,
            order_status: o.orderStatus,
            total_amount: o.totalAmount,
            buyer_username: o.buyerUsername,
            shipping_carrier: o.shippingCarrier,
            tracking_number: o.trackingNumber,
            create_time: o.createTime,
            update_time: o.updateTime,
            pay_time: o.payTime,
            cod: o.cod,
            cancel_reason: o.cancelReason,
            buyer_user_id: o.buyerUserId,
            document_status: o.documentStatus,
            is_printed: o.isPrinted,
            escrow_amount_after_adjustment: o.escrowAmountAfterAdjustment
        }));

        return NextResponse.json({
            success: true,
            data: {
                ordersData: mappedOrders,
                itemsData: dbItems
            }
        });
    } catch (error) {
        console.error('Error in /api/data/orders/search:', error);
        return NextResponse.json({
            success: false,
            message: 'Failed to search orders',
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
