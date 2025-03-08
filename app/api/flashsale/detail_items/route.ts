import { NextRequest, NextResponse } from 'next/server';
import { getShopFlashSaleItems } from '@/app/services/shopeeFlashSaleService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shopId = searchParams.get('shop_id');
    const flashSaleId = searchParams.get('flash_sale_id');
    const minItems = searchParams.get('min_items');
    const offset = searchParams.get('offset');

    // Validasi parameter wajib
    if (!shopId || !flashSaleId) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_parameters',
          message: 'Parameter shop_id dan flash_sale_id harus diisi'
        },
        { status: 400 }
      );
    }

    // Konversi parameter ke tipe yang sesuai
    const options = {
      minItems: minItems ? parseInt(minItems) : undefined,
      offset: offset ? parseInt(offset) : undefined
    };

    const result = await getShopFlashSaleItems(
      parseInt(shopId),
      parseInt(flashSaleId),
      options
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message: result.message
        },
        { status: 400 }
      );
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error dalam route flash sale items:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'internal_server_error',
        message: 'Terjadi kesalahan internal server'
      },
      { status: 500 }
    );
  }
}