import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { fetchKeluhanByShopIds, updateKeluhanStatus, deleteKeluhan } from '@/app/services/databaseOperations';
import { getAllShopsFromDB } from '@/app/services/databaseOperations';

// GET - Ambil keluhan berdasarkan toko user
export async function GET() {
    try {
        const supabaseServer = await createClient();
        const { data: { user }, error: userError } = await supabaseServer.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }

        const shops = await getAllShopsFromDB();
        const shopIds = shops.map(s => s.shop_id.toString());

        if (shopIds.length === 0) {
            return NextResponse.json({ data: [] });
        }

        const data = await fetchKeluhanByShopIds(shopIds);
        return NextResponse.json({ data });
    } catch (error) {
        console.error('Error fetching keluhan:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH - Update status keluhan
export async function PATCH(request: Request) {
    try {
        const supabaseServer = await createClient();
        const { data: { user }, error: userError } = await supabaseServer.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }

        const { id, status_keluhan } = await request.json();
        await updateKeluhanStatus(id, status_keluhan);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating keluhan:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE - Hapus keluhan
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

        await deleteKeluhan(parseInt(id));
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting keluhan:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
