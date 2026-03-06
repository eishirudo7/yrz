import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabase } from '@/lib/supabase';

// GET - Ambil keluhan berdasarkan toko user
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
            return NextResponse.json({ data: [] });
        }

        const { data, error } = await supabase
            .from('keluhan')
            .select('*')
            .in('shop_id', shopIds)
            .order('create_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        return NextResponse.json({ data: data || [] });
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

        const { error } = await supabase
            .from('keluhan')
            .update({ status_keluhan })
            .eq('id', id);

        if (error) throw error;

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

        const { error } = await supabase
            .from('keluhan')
            .delete()
            .eq('id', parseInt(id));

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting keluhan:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
