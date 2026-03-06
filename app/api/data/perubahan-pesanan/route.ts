import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { fetchPerubahanPesananByShopIds, updatePerubahanPesananStatus, deletePerubahanPesanan } from '@/app/services/databaseOperations';
import { getAllShopsFromDB } from '@/app/services/databaseOperations';

// GET - Ambil perubahan pesanan
export async function GET(request: Request) {
    try {
        const supabaseServer = await createClient();
        const { data: { user }, error: userError } = await supabaseServer.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }

        const shops = await getAllShopsFromDB();
        const shopIds = shops.map(s => s.shop_id.toString());

        if (shopIds.length === 0) {
            return NextResponse.json({ data: [], total: 0 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const size = parseInt(searchParams.get('size') || '21');
        const status = searchParams.get('status') || 'semua';

        const result = await fetchPerubahanPesananByShopIds(shopIds, { page, size, status });
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error fetching perubahan pesanan:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH - Update status perubahan pesanan
export async function PATCH(request: Request) {
    try {
        const supabaseServer = await createClient();
        const { data: { user }, error: userError } = await supabaseServer.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }

        const { id, status } = await request.json();
        await updatePerubahanPesananStatus(id, status);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating perubahan pesanan:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE - Hapus perubahan pesanan
export async function DELETE(request: Request) {
    try {
        const supabaseServer = await createClient();
        const { data: { user }, error: userError } = await supabaseServer.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });
        }

        await deletePerubahanPesanan(parseInt(id));
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting perubahan pesanan:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
