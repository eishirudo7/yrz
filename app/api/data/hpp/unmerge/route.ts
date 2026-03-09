import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }

        const { canonical_group } = await request.json();

        if (!canonical_group) {
            return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
        }

        const { data: aliasItems } = await supabase
            .from('hpp_master')
            .select('id')
            .ilike('canonical_sku', canonical_group)
            .eq('user_id', user.id);

        let updatedCount = 0;

        if (aliasItems && aliasItems.length > 0) {
            const ids = aliasItems.map(item => item.id);
            const { error } = await supabase
                .from('hpp_master')
                .update({ canonical_sku: null, updated_at: new Date().toISOString() })
                .in('id', ids)
                .eq('user_id', user.id);

            if (!error) updatedCount = ids.length;
        }

        return NextResponse.json({ success: true, updated: updatedCount });
    } catch (error) {
        console.error('Error in POST /api/data/hpp/unmerge:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
