import { NextRequest, NextResponse } from 'next/server';
import { updateStock } from '@/app/services/shopeeService';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Validasi shop_id dan item_id di body
    if (!body.shop_id || !body.item_id) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'shop_id dan item_id diperlukan' },
        { status: 400 }
      );
    }

    const shopId = parseInt(body.shop_id);
    const itemId = parseInt(body.item_id);

    if (isNaN(shopId) || isNaN(itemId)) {
      return NextResponse.json(
        { error: 'invalid_parameters', message: 'shop_id dan item_id harus berupa angka' },
        { status: 400 }
      );
    }

    // Validasi stock_list
    if (!body.stock_list || !Array.isArray(body.stock_list)) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'stock_list diperlukan dan harus berupa array' },
        { status: 400 }
      );
    }

    // Validasi struktur stock_list
    for (const item of body.stock_list) {
      if (!item.seller_stock || !Array.isArray(item.seller_stock)) {
        return NextResponse.json(
          { error: 'invalid_request', message: 'Setiap item dalam stock_list harus memiliki seller_stock berupa array' },
          { status: 400 }
        );
      }

      for (const stock of item.seller_stock) {
        if (typeof stock.stock !== 'number' || stock.stock < 0) {
          return NextResponse.json(
            { error: 'invalid_request', message: 'Nilai stock harus berupa angka non-negatif' },
            { status: 400 }
          );
        }
      }
    }

    const result = await updateStock(shopId, itemId, { stock_list: body.stock_list });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          message: result.message,
          warning: result.warning,
          request_id: result.request_id
        },
        { status: 400 }
      );
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in update stock API:', error);
    return NextResponse.json(
      {
        error: 'internal_server_error',
        message: error instanceof Error ? error.message : 'Terjadi kesalahan internal server'
      },
      { status: 500 }
    );
  }
}