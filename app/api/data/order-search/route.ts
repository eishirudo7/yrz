import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { searchOrders, fetchOrderItemsByOrderSns } from '@/app/services/databaseOperations';
import { getAllShopsFromDB } from '@/app/services/databaseOperations';

// GET - Search orders
export async function GET(request: Request) {
    try {
        const supabaseServer = await createClient();
        const { data: { user }, error: userError } = await supabaseServer.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }

        const shops = await getAllShopsFromDB();
        const shopIds = shops.map(s => s.shop_id);

        if (shopIds.length === 0) {
            return NextResponse.json({ data: [] });
        }

        const { searchParams } = new URL(request.url);
        const filters = {
            order_sn: searchParams.get('order_sn') || undefined,
            buyer_username: searchParams.get('buyer_username') || undefined,
            tracking_number: searchParams.get('tracking_number') || undefined,
        };

        // 1. Search orders
        const ordersData = await searchOrders(shopIds, filters);

        if (ordersData.length === 0) {
            return NextResponse.json({ data: [] });
        }

        // 2. Get order items
        const orderSns = ordersData.map(o => o.order_sn);
        const itemsData = await fetchOrderItemsByOrderSns(orderSns);

        // 3. Format results
        const results = ordersData.map(order => {
            const shop = shops.find(s => s.shop_id === order.shop_id);
            const orderItems = itemsData.filter(item => item.order_sn === order.order_sn);

            const recalculated_total_amount = orderItems.reduce((total: number, item: any) => {
                return total + (parseFloat(item.model_discounted_price || 0) * parseInt(item.model_quantity_purchased || 0));
            }, 0);

            const skuQty = orderItems.length > 0
                ? orderItems.map((item: any) => `${(item.item_sku && item.item_sku !== 'EMPTY' && item.item_sku.trim() !== '') ? item.item_sku : item.model_sku} (${item.model_quantity_purchased})`).join(', ')
                : '';

            const formattedItems = orderItems.map((item: any) => ({
                sku: (item.item_sku && item.item_sku !== 'EMPTY' && item.item_sku.trim() !== '') ? item.item_sku : item.model_sku,
                quantity: parseInt(item.model_quantity_purchased || '0'),
                price: parseFloat(item.model_discounted_price || '0'),
                total_price: parseFloat(item.model_discounted_price || '0') * parseInt(item.model_quantity_purchased || '0')
            }));

            return {
                ...order,
                shop_name: shop?.shop_name || 'Tidak diketahui',
                recalculated_total_amount: recalculated_total_amount || order.total_amount,
                sku_qty: skuQty,
                items: formattedItems
            };
        });

        // Sort results
        results.sort((a: any, b: any) => {
            const aTime = a.cod ? a.create_time : (a.pay_time || a.create_time);
            const bTime = b.cod ? b.create_time : (b.pay_time || b.create_time);
            return bTime - aTime;
        });

        return NextResponse.json({ data: results });
    } catch (error) {
        console.error('Error searching orders:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
