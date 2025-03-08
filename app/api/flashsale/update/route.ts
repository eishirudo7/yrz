import { NextRequest, NextResponse } from 'next/server';
import { updateShopFlashSale } from '@/app/services/shopeeFlashSaleService';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { shop_id, flash_sale_id, status } = body;

    if (!shop_id || !flash_sale_id || ![1, 2].includes(status)) {
      return NextResponse.json(
        { error: 'Parameter shop_id, flash_sale_id, dan status (1 atau 2) diperlukan' },
        { status: 400 }
      );
    }

    const result = await updateShopFlashSale(shop_id, { flash_sale_id, status });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 