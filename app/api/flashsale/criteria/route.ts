import { NextRequest, NextResponse } from 'next/server';
import { getFlashSaleItemCriteria } from '@/app/services/shopeeFlashSaleService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shopId = parseInt(searchParams.get('shop_id') || '');
    const itemIds = searchParams.get('item_ids')?.split(',').map(id => parseInt(id));

    if (!shopId || !itemIds?.length) {
      return NextResponse.json(
        { error: 'Parameter shop_id dan item_ids diperlukan' },
        { status: 400 }
      );
    }

    const result = await getFlashSaleItemCriteria(shopId, itemIds);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 