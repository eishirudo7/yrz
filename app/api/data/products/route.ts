import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabase } from '@/lib/supabase';

// GET - Get products for user's shops
export async function GET(request: Request) {
    try {
        const supabaseServer = await createClient();
        const { data: { user }, error: userError } = await supabaseServer.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const shopIdsParam = searchParams.get('shop_ids');

        if (!shopIdsParam) {
            return NextResponse.json({ error: 'shop_ids diperlukan' }, { status: 400 });
        }

        const shopIds = shopIdsParam.split(',').map(Number);

        const { data, error } = await supabase
            .from('items')
            .select('*')
            .in('shop_id', shopIds);

        if (error) throw error;

        return NextResponse.json({ data: data || [] });
    } catch (error) {
        console.error('Error fetching products:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST - Upsert product items
export async function POST(request: Request) {
    try {
        const supabaseServer = await createClient();
        const { data: { user }, error: userError } = await supabaseServer.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }

        const { item } = await request.json();

        if (!item) {
            return NextResponse.json({ error: 'item diperlukan' }, { status: 400 });
        }

        const { error } = await supabase
            .from('items')
            .upsert(item, { onConflict: 'item_id' });

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error upserting product:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
