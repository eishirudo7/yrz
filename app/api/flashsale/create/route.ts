import { NextRequest, NextResponse } from 'next/server';
import { createShopFlashSale } from '@/app/services/shopeeFlashSaleService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shop_id, timeslot_id } = body;

    if (!shop_id || !timeslot_id) {
      return NextResponse.json(
        { error: 'Parameter shop_id dan timeslot_id diperlukan' },
        { status: 400 }
      );
    }

    const result = await createShopFlashSale(shop_id, timeslot_id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 