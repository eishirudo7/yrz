import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabase } from '@/lib/supabase';

// GET - Ambil perubahan pesanan
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
            .select('shop_id')
            .eq('user_id', user.id)
            .eq('is_active', true);

        const shopIds = shops?.map(s => s.shop_id.toString()) || [];

        if (shopIds.length === 0) {
            return NextResponse.json({ data: [], total: 0 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const size = parseInt(searchParams.get('size') || '21');
        const status = searchParams.get('status') || 'semua';
        const offset = (page - 1) * size;

        let query = supabase
            .from('perubahan_pesanan')
            .select('*', { count: 'exact' })
            .in('shop_id', shopIds);

        if (status !== 'semua') {
            query = query.eq('status', status);
        }

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + size - 1);

        if (error) throw error;

        return NextResponse.json({ data: data || [], total: count || 0 });
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

        const { error } = await supabase
            .from('perubahan_pesanan')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;

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

        const { error } = await supabase
            .from('perubahan_pesanan')
            .delete()
            .eq('id', parseInt(id));

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting perubahan pesanan:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
