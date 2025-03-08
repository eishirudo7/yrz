import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shop_id');
    const itemIds = searchParams.get('item_ids')?.split(',');

    // Validasi parameter
    if (!shopId || !itemIds?.length) {
      return NextResponse.json(
        { error: 'shop_id dan item_ids diperlukan' },
        { status: 400 }
      );
    }

    // Query ke database untuk multiple items
    const { data, error } = await supabase
      .from('items')
      .select('item_id, item_sku')
      .eq('shop_id', shopId)
      .in('item_id', itemIds);

    if (error) {
      return NextResponse.json(
        { error: 'Gagal mengambil data' },
        { status: 500 }
      );
    }

    return NextResponse.json({ items: data });

  } catch (error) {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
} 