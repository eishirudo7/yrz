import { NextRequest, NextResponse } from 'next/server';
import { updateShopFlashSaleItems } from '@/app/services/shopeeFlashSaleService';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    // Log request
    console.log('[Flash Sale Update Items Request]:', {
      method: request.method,
      url: request.url,
      body: body
    });

    const { shop_id, flash_sale_id, items } = body;

    if (!shop_id || !flash_sale_id || !items) {
      const errorResponse = { 
        error: 'Parameter shop_id, flash_sale_id, dan items diperlukan' 
      };
      // Log error response
      console.log('[Flash Sale Update Items Error]:', errorResponse);
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const flashSaleId = parseInt(flash_sale_id);
    if (isNaN(flashSaleId) || flashSaleId <= 0 || !Number.isInteger(flashSaleId)) {
      const errorResponse = {
        success: false,
        error: 'invalid_parameter',
        message: 'flash_sale_id harus berupa integer positif'
      };
      console.log('[Flash Sale Update Items Error]:', errorResponse);
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const result = await updateShopFlashSaleItems(shop_id, { 
      flash_sale_id: flashSaleId,
      items 
    });
    // Log success response
    console.log('[Flash Sale Update Items Response]:', result);
    return NextResponse.json(result);
  } catch (error) {
    const errorResponse = {
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    // Log error
    console.error('[Flash Sale Update Items Error]:', errorResponse);
    return NextResponse.json(errorResponse, { status: 500 });
  }
} 