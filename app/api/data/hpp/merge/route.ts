import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }

        const { canonical_sku, alias_groups } = await request.json();

        if (!canonical_sku || !alias_groups || !Array.isArray(alias_groups)) {
            return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
        }

        let updatedCount = 0;

        for (const aliasGroup of alias_groups) {
            const { data: aliasItems } = await supabase
                .from('hpp_master')
                .select('id')
                .ilike('item_sku', aliasGroup)
                .eq('user_id', user.id);

            if (aliasItems && aliasItems.length > 0) {
                const ids = aliasItems.map(item => item.id);
                const { error } = await supabase
                    .from('hpp_master')
                    .update({ canonical_sku, updated_at: new Date().toISOString() })
                    .in('id', ids)
                    .eq('user_id', user.id);

                if (!error) updatedCount += ids.length;
            }
        }

        return NextResponse.json({ success: true, updated: updatedCount });
    } catch (error) {
        console.error('Error in POST /api/data/hpp/merge:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
