import { NextRequest, NextResponse } from 'next/server';
import { deleteShopFlashSaleItems } from '@/app/services/shopeeFlashSaleService';

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shopId = parseInt(searchParams.get('shop_id') || '');
    const flashSaleId = parseInt(searchParams.get('flash_sale_id') || '');
    const itemIds = searchParams.get('item_ids')?.split(',').map(id => parseInt(id));

    if (!shopId || !flashSaleId || !itemIds?.length) {
      return NextResponse.json(
        { error: 'Parameter shop_id, flash_sale_id, dan item_ids diperlukan' },
        { status: 400 }
      );
    }

    const result = await deleteShopFlashSaleItems(shopId, { flash_sale_id: flashSaleId, item_ids: itemIds });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 