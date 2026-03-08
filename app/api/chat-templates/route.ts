import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// GET - Ambil semua template chat user
export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }

        const { data, error } = await supabase
            .from('chat_templates')
            .select('*')
            .eq('user_id', user.id)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching templates:', error);
            return NextResponse.json({ error: 'Gagal mengambil template' }, { status: 500 });
        }

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST - Buat template baru
export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }

        const { title, content } = await request.json();

        if (!title?.trim() || !content?.trim()) {
            return NextResponse.json({ error: 'Judul dan isi template diperlukan' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('chat_templates')
            .insert({ user_id: user.id, title: title.trim(), content: content.trim() })
            .select()
            .single();

        if (error) {
            console.error('Error creating template:', error);
            return NextResponse.json({ error: 'Gagal membuat template' }, { status: 500 });
        }

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH - Update template
export async function PATCH(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }

        const { id, title, content } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });
        }

        const updates: Record<string, any> = { updated_at: new Date().toISOString() };
        if (title?.trim()) updates.title = title.trim();
        if (content?.trim()) updates.content = content.trim();

        const { data, error } = await supabase
            .from('chat_templates')
            .update(updates)
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) {
            console.error('Error updating template:', error);
            return NextResponse.json({ error: 'Gagal mengubah template' }, { status: 500 });
        }

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE - Hapus template
export async function DELETE(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });
        }

        const { error } = await supabase
            .from('chat_templates')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            console.error('Error deleting template:', error);
            return NextResponse.json({ error: 'Gagal menghapus template' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
