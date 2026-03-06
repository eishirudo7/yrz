import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { markOrdersAsPrinted } from '@/app/services/databaseOperations';

// POST - Mark orders as printed
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

        await markOrdersAsPrinted(order_sns);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error marking orders as printed:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
