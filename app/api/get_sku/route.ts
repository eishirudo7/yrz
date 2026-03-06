import { NextResponse } from 'next/server';
import { getItemsBySku } from '@/app/services/databaseOperations';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shop_id');
    const itemIds = searchParams.get('item_ids')?.split(',');

    // Validasi parameter
    if (!itemIds?.length) {
      return NextResponse.json(
        { error: 'item_ids diperlukan' },
        { status: 400 }
      );
    }

    const items = await getItemsBySku(itemIds, shopId);

    return NextResponse.json({ items });

  } catch (error) {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
} 