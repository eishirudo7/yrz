import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabase } from '@/lib/supabase';

// GET - Get order items for order detail
export async function GET(request: Request) {
    try {
        const supabaseServer = await createClient();
        const { data: { user }, error: userError } = await supabaseServer.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const orderSn = searchParams.get('order_sn');

        if (!orderSn) {
            return NextResponse.json({ error: 'order_sn diperlukan' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('order_items')
            .select('model_quantity_purchased, model_discounted_price, item_sku, model_name')
            .eq('order_sn', orderSn);

        if (error) throw error;

        if (!data || data.length === 0) {
            return NextResponse.json({ data: null });
        }

        return NextResponse.json({
            data: {
                items: data.map(item => ({
                    model_quantity_purchased: parseInt(item.model_quantity_purchased || '0'),
                    model_discounted_price: parseFloat(item.model_discounted_price || '0'),
                    item_sku: item.item_sku,
                    model_name: item.model_name
                }))
            }
        });
    } catch (error) {
        console.error('Error fetching order items:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
