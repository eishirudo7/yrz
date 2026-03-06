import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabase } from '@/lib/supabase';

// GET - Search orders
export async function GET(request: Request) {
    try {
        const supabaseServer = await createClient();
        const { data: { user }, error: userError } = await supabaseServer.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }

        // Get user's shop IDs
        const { data: shops } = await supabase
            .from('shopee_tokens')
            .select('shop_id, shop_name')
            .eq('user_id', user.id)
            .eq('is_active', true);

        const shopIds = shops?.map(s => s.shop_id) || [];

        if (shopIds.length === 0) {
            return NextResponse.json({ data: [] });
        }

        const { searchParams } = new URL(request.url);
        const order_sn = searchParams.get('order_sn');
        const buyer_username = searchParams.get('buyer_username');
        const tracking_number = searchParams.get('tracking_number');

        // 1. Query orders
        let query = supabase
            .from('orders')
            .select('*')
            .in('shop_id', shopIds);

        if (order_sn) query = query.ilike('order_sn', `%${order_sn}%`);
        if (buyer_username) query = query.ilike('buyer_username', `%${buyer_username}%`);
        if (tracking_number) query = query.ilike('tracking_number', `%${tracking_number}%`);

        const { data: ordersData, error: ordersError } = await query.order('create_time', { ascending: false });
        if (ordersError) throw ordersError;

        if (!ordersData || ordersData.length === 0) {
            return NextResponse.json({ data: [] });
        }

        // 2. Get order items
        const orderSns = ordersData.map(o => o.order_sn);
        const { data: itemsData, error: itemsError } = await supabase
            .from('order_items')
            .select('order_sn, item_sku, model_sku, model_quantity_purchased, model_discounted_price')
            .in('order_sn', orderSns);

        if (itemsError) throw itemsError;

        // 3. Format results
        const results = ordersData.map(order => {
            const shop = shops?.find(s => s.shop_id === order.shop_id);
            const orderItems = itemsData?.filter(item => item.order_sn === order.order_sn) || [];

            const recalculated_total_amount = orderItems.reduce((total, item) => {
                return total + (parseFloat(item.model_discounted_price || 0) * parseInt(item.model_quantity_purchased || 0));
            }, 0);

            const skuQty = orderItems.length > 0
                ? orderItems.map(item => `${(item.item_sku && item.item_sku !== 'EMPTY' && item.item_sku.trim() !== '') ? item.item_sku : item.model_sku} (${item.model_quantity_purchased})`).join(', ')
                : '';

            const formattedItems = orderItems.map(item => ({
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
