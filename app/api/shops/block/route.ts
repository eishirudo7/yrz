import { NextRequest, NextResponse } from 'next/server';
import { blockShopWebhook } from '@/app/services/shopeeService';

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shopId = parseInt(searchParams.get('shopId') || '');

    if (!shopId || isNaN(shopId)) {
      return NextResponse.json(
        { error: 'ID Toko tidak valid' },
        { status: 400 }
      );
    }

    const result = await blockShopWebhook(shopId);

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error,
          message: result.message 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error dalam route block shop:', error);
    return NextResponse.json(
      { 
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Terjadi kesalahan internal server' 
      },
      { status: 500 }
    );
  }
} 