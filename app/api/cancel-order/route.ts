import { NextRequest, NextResponse } from 'next/server';
import { cancelOrder } from '@/app/services/shopeeService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderSn, itemList, shopId } = body;

    // Validasi shopId
    if (!shopId || isNaN(parseInt(shopId))) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'invalid_shop_id', 
          message: 'ID Toko tidak valid' 
        },
        { status: 400 }
      );
    }

    const shopIdInt = parseInt(shopId);

    // Validasi input
    if (!orderSn) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'missing_order_sn', 
          message: 'Nomor pesanan harus diisi' 
        },
        { status: 400 }
      );
    }

    if (!itemList || !Array.isArray(itemList) || itemList.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'invalid_item_list', 
          message: 'Daftar item tidak valid' 
        },
        { status: 400 }
      );
    }

    // Validasi format itemList
    const isValidItemList = itemList.every(item => 
      typeof item === 'object' && 
      Number.isInteger(item.item_id) && 
      Number.isInteger(item.model_id)
    );

    if (!isValidItemList) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'invalid_item_format', 
          message: 'Format item tidak valid. Setiap item harus memiliki item_id dan model_id' 
        },
        { status: 400 }
      );
    }

    const result = await cancelOrder(shopIdInt, orderSn, itemList);

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error, 
          message: result.message,
          request_id: result.request_id 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error dalam route pembatalan pesanan:', error);
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