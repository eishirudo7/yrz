import { NextRequest, NextResponse } from 'next/server';
import { addShopFlashSaleItems } from '@/app/services/shopeeFlashSaleService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shop_id, flash_sale_id, items } = body;

    // Konversi ke number
    const shopIdNumber = Number(shop_id);
    const flashSaleIdNumber = Number(flash_sale_id);

    // Validasi
    if (isNaN(shopIdNumber) || isNaN(flashSaleIdNumber)) {
      return NextResponse.json(
        { error: 'shop_id dan flash_sale_id harus berupa angka yang valid' },
        { status: 400 }
      );
    }

    // Log request headers
    console.log('=== REQUEST HEADERS ===');
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log(headers);

    // Log request body
    console.log('=== REQUEST BODY ===');
    console.log(JSON.stringify({
      shop_id,
      flash_sale_id,
      items
    }, null, 2));

    if (!shop_id || !flash_sale_id || !items) {
      return NextResponse.json(
        { error: 'Parameter shop_id, flash_sale_id, dan items diperlukan' },
        { status: 400 }
      );
    }

    // Validasi struktur item_list
    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: 'items harus berupa array' },
        { status: 400 }
      );
    }

    // Validasi setiap item dalam item_list
    for (const item of items) {
      if (!item.item_id || item.purchase_limit === undefined || !item.models) {
        return NextResponse.json(
          { error: 'Setiap item harus memiliki item_id, purchase_limit, dan models' },
          { status: 400 }
        );
      }

      if (!Array.isArray(item.models)) {
        return NextResponse.json(
          { error: 'models harus berupa array' },
          { status: 400 }
        );
      }

      for (const model of item.models) {
        if (!model.model_id || !model.input_promo_price || model.stock === undefined) {
          return NextResponse.json(
            { error: 'Setiap model harus memiliki model_id, input_promo_price, dan stock' },
            { status: 400 }
          );
        }
      }
    }

    console.log('=== SENDING REQUEST TO SHOPEE API ===');
    const startTime = new Date();
    const result = await addShopFlashSaleItems(shopIdNumber, { 
      flash_sale_id: flashSaleIdNumber,
      items: items 
    });
    const endTime = new Date();
    
    console.log('=== SHOPEE API RESPONSE ===');
    console.log('Response Time:', endTime.getTime() - startTime.getTime(), 'ms');
    console.log('Response Data:', JSON.stringify(result, null, 2));
    
    return NextResponse.json(result);
  } catch (error) {
    console.log('=== ERROR ===');
    console.error('Error details:', error);
    
    return NextResponse.json(
      { error: 'Internal Server Error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 