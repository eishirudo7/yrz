import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const searchTerm = searchParams.get('search') || '';

        const limitParam = searchParams.get('limit');
        const limit = limitParam ? parseInt(limitParam) : 5000;

        let query = supabase
            .from('hpp_master')
            .select('id, user_id, item_sku, tier1_variation, cost_price, canonical_sku, created_at, updated_at')
            .eq('user_id', user.id)
            .order('item_sku', { ascending: true })
            .order('tier1_variation', { ascending: true });

        if (searchTerm) {
            query = query.or(`item_sku.ilike.%${searchTerm}%,tier1_variation.ilike.%${searchTerm}%`);
        }

        const { data, error } = await query.limit(limit);

        if (error) {
            console.error('Database error fetching HPP data:', error);
            return NextResponse.json({ error: 'Gagal mengambil data HPP' }, { status: 500 });
        }

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Error in GET /api/data/hpp:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }

        const { updates, bulkUpdate } = await request.json();

        if (bulkUpdate) {
            // bulkUpdate: { ids: number[], cost_price: number }
            const { ids, cost_price } = bulkUpdate;
            if (!ids || !Array.isArray(ids) || ids.length === 0) {
                return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
            }

            const { error } = await supabase
                .from('hpp_master')
                .update({ cost_price, updated_at: new Date().toISOString() })
                .in('id', ids)
                .eq('user_id', user.id);

            if (error) throw error;
            return NextResponse.json({ success: true, count: ids.length });
        }

        if (updates && Array.isArray(updates)) {
            let successCount = 0;
            for (const item of updates) {
                const { error } = await supabase
                    .from('hpp_master')
                    .update({ cost_price: item.cost_price, updated_at: new Date().toISOString() })
                    .eq('id', item.id)
                    .eq('user_id', user.id);

                if (!error) successCount++;
            }
            return NextResponse.json({ success: true, count: successCount });
        }

        return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
    } catch (error) {
        console.error('Error in PUT /api/data/hpp:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
