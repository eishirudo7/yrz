import { NextRequest, NextResponse } from 'next/server';
import { getShopFlashSale } from '@/app/services/shopeeFlashSaleService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shopId = parseInt(searchParams.get('shop_id') || '');
    const flashSaleId = parseInt(searchParams.get('flash_sale_id') || '');

    if (!shopId || !flashSaleId) {
      return NextResponse.json(
        { error: 'Parameter shop_id dan flash_sale_id diperlukan' },
        { status: 400 }
      );
    }

    const result = await getShopFlashSale(shopId, flashSaleId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 