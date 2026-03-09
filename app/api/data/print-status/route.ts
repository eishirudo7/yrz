import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabase } from '@/lib/supabase';

// POST - Get print status for multiple order_sns
export async function POST(request: Request) {
    try {
        const supabaseServer = await createClient();
        const { data: { user }, error: userError } = await supabaseServer.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }

        const { order_sns } = await request.json();

        if (!order_sns || !Array.isArray(order_sns) || order_sns.length === 0) {
            return NextResponse.json({ error: 'order_sns diperlukan' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('orders')
            .select('order_sn, is_printed')
            .in('order_sn', order_sns)
            .eq('is_printed', true);

        if (error) {
            throw error;
        }

        // Return hanya order_sn yang sudah di-print
        const printedSns = (data || []).map((row: any) => row.order_sn);

        return NextResponse.json({ success: true, printed: printedSns });
    } catch (error) {
        console.error('Error fetching print status:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
