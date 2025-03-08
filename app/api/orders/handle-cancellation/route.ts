import { NextRequest, NextResponse } from 'next/server';
import { handleBuyerCancellation } from '@/app/services/shopeeService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shopId, orderSn, operation } = body;

    // Validasi input
    if (!shopId || !orderSn || !operation) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_parameters',
          message: 'Parameter shopId, orderSn, dan operation harus diisi'
        },
        { status: 400 }
      );
    }

    // Validasi operation
    if (!['ACCEPT', 'REJECT'].includes(operation)) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_operation',
          message: 'Operation harus berupa ACCEPT atau REJECT'
        },
        { status: 400 }
      );
    }

    const result = await handleBuyerCancellation(
      Number(shopId),
      orderSn,
      operation as 'ACCEPT' | 'REJECT'
    );

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
    console.error('Terjadi kesalahan saat memproses pembatalan:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'internal_server_error',
        message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
      },
      { status: 500 }
    );
  }
} 