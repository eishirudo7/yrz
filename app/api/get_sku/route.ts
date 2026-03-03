import { db } from '@/db';
import { items } from '@/db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shop_id');
    const itemIds = searchParams.get('item_ids')?.split(',');

    if (!itemIds?.length) {
      return NextResponse.json(
        { error: 'item_ids diperlukan' },
        { status: 400 }
      );
    }

    const conditions = [
      inArray(items.itemId, itemIds.map(Number)),
    ];

    if (shopId) {
      conditions.push(eq(items.shopId, Number(shopId)));
    }

    const data = await db.select({
      item_id: items.itemId,
      item_sku: items.itemSku,
      item_name: items.itemName,
      image: items.image,
    })
      .from(items)
      .where(and(...conditions));

    return NextResponse.json({ items: data });

  } catch (error) {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}