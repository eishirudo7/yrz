import { NextRequest, NextResponse } from 'next/server';
import { syncOrders, syncOrdersByOrderSns } from '@/app/services/orderSyncs';

// Interface untuk request body
interface SyncRequestBody {
  shopId: number;
  orderSns: string[];
}


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validasi shopId
    if (!body.shopId) {
      return NextResponse.json(
        { error: 'shopId harus diisi' },
        { status: 400 }
      );
    }

    const { shopId, orderSns } = body as SyncRequestBody;

    // Pilih fungsi sinkronisasi berdasarkan ketersediaan orderSns
    let result;
    if (!orderSns || orderSns.length === 0) {
      // Gunakan syncOrders jika hanya ada shopId
      result = await syncOrders(shopId);
    } else {
      // Gunakan syncOrdersByOrderSns jika ada orderSns
      result = await syncOrdersByOrderSns(shopId, orderSns);
    }
    
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
          }
        }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        total: orderSns?.length || result.data.total || 0,
        success: result.data.processed,
        failed: (orderSns?.length || result.data.total || 0) - result.data.processed
      }
    });

  } catch (error) {
    console.error('Error in sync route:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Terjadi kesalahan internal server',
        data: {
          total: 0,
          success: 0,
          failed: 0
        }
      },
      { status: 500 }
    );
  }
}

// Tambahkan handler OPTIONS untuk CORS jika diperlukan
export async function OPTIONS() {
  const response = new NextResponse(null, {
    status: 204,
  });
  
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  
  return response;
}
