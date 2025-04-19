import { NextRequest, NextResponse } from 'next/server';
import { syncOrders, syncOrdersByOrderSns } from '@/app/services/orderSyncs';

// Interface untuk request body
interface SyncRequestBody {
  shopId: number;
  orderSns?: string[];
}

// Validasi input
function validateInput(body: any): { isValid: boolean; error?: string } {
  if (!body.shopId || typeof body.shopId !== 'number') {
    return { isValid: false, error: 'shopId harus berupa angka' };
  }

  if (body.orderSns && !Array.isArray(body.orderSns)) {
    return { isValid: false, error: 'orderSns harus berupa array' };
  }

  if (body.orderSns && body.orderSns.some((sn: string) => typeof sn !== 'string')) {
    return { isValid: false, error: 'Semua orderSns harus berupa string' };
  }

  return { isValid: true };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    
    // Validasi input
    const validation = validateInput(body);
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          success: false,
          error: validation.error,
          data: {
            total: 0,
            success: 0,
            failed: 0
          }
        },
        { status: 400 }
      );
    }

    const { shopId, orderSns } = body as SyncRequestBody;

    // Log request
    console.log(`[Sync API] Memulai sinkronisasi untuk shopId: ${shopId}, orderSns: ${orderSns?.length || 0}`);

    // Pilih fungsi sinkronisasi berdasarkan ketersediaan orderSns
    let result;
    if (!orderSns || orderSns.length === 0) {
      result = await syncOrders(shopId);
    } else {
      result = await syncOrdersByOrderSns(shopId, orderSns);
    }
    
    // Log hasil
    console.log(`[Sync API] Selesai sinkronisasi untuk shopId: ${shopId}, sukses: ${result.data?.processed || 0}, gagal: ${(orderSns?.length || result.data?.total || 0) - (result.data?.processed || 0)}`);

    // Return hasil sinkronisasi
    if (!result.success || !result.data) {
      return NextResponse.json(
        { 
          success: false,
          error: result.error || 'Gagal sinkronisasi',
          data: {
            total: orderSns?.length || 0,
            success: 0,
            failed: orderSns?.length || 0
          },
          metadata: {
            timestamp: new Date().toISOString(),
            processingTime: Date.now() - startTime
          }
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        total: orderSns?.length || result.data.total || 0,
        success: result.data.processed,
        failed: (orderSns?.length || result.data.total || 0) - result.data.processed
      },
      metadata: {
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      }
    });

  } catch (error) {
    console.error('[Sync API] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Terjadi kesalahan internal server',
        data: {
          total: 0,
          success: 0,
          failed: 0
        },
        metadata: {
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime
        }
      },
      { status: 500 }
    );
  }
}

// Handler OPTIONS untuk CORS
export async function OPTIONS() {
  const response = new NextResponse(null, {
    status: 204,
  });
  
  // Security headers
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  return response;
}
