import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getEscrowDetail } from '@/app/services/shopeeService';
import { saveEscrowDetail } from '@/app/services/databaseOperations';

// Interface untuk request body
interface EscrowRequest {
  shopId: number;  // Wajib
  orderSn?: string;
  orderSns?: string[];
  escrowData?: any;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shopId = searchParams.get('shop_id');
    const orderSn = searchParams.get('order_sn');
    
    if (!shopId || !orderSn) {
      return NextResponse.json(
        { success: false, message: 'Parameter shop_id dan order_sn diperlukan' },
        { status: 400 }
      );
    }
    
    const shopIdNumber = parseInt(shopId, 10);
    if (isNaN(shopIdNumber)) {
      return NextResponse.json(
        { success: false, message: 'Parameter shop_id harus berupa angka' },
        { status: 400 }
      );
    }
    
    const result = await getEscrowDetail(shopIdNumber, orderSn);
    return NextResponse.json({
      success: true,
      data: result
    });
    
  } catch (error: any) {
    console.error('Error dalam API getEscrow:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Terjadi kesalahan saat memproses permintaan', 
        error: error.message 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Autentikasi user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({
        success: false,
        message: 'Pengguna tidak terautentikasi'
      }, { status: 401 });
    }

    const body: EscrowRequest = await request.json();
    
    // Validasi shopId
    if (!body.shopId) {
      return NextResponse.json({
        success: false,
        message: 'Parameter shopId diperlukan'
      }, { status: 400 });
    }
    
    // Handle batch request
    if (body.orderSns && body.orderSns.length > 0) {
      const results = await Promise.all(body.orderSns.map(async (orderSn) => {
        try {
          const escrowResponse = await getEscrowDetail(body.shopId, orderSn);
          if (!escrowResponse.success || !escrowResponse.data) {
            throw new Error(escrowResponse.message || 'Gagal mengambil data escrow');
          }

          // Gunakan fungsi saveEscrowDetail yang sudah ada
          await saveEscrowDetail(body.shopId, escrowResponse.data);

          return {
            order_sn: orderSn,
            success: true,
            data: escrowResponse.data
          };
        } catch (error) {
          console.error(`Error processing order ${orderSn}:`, error);
          return {
            order_sn: orderSn,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }));

      return NextResponse.json({
        success: true,
        data: results
      });
    }

    // Handle single escrow data save
    if (body.orderSn && body.escrowData) {
      try {
        await saveEscrowDetail(body.shopId, body.escrowData);
        return NextResponse.json({
          success: true,
          message: 'Data escrow berhasil disimpan'
        });
      } catch (error) {
        return NextResponse.json({
          success: false,
          message: error instanceof Error ? error.message : 'Gagal menyimpan data escrow'
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: false,
      message: 'Parameter tidak lengkap'
    }, { status: 400 });

  } catch (error: any) {
    console.error('Error dalam API escrow:', error);
    return NextResponse.json({
      success: false,
      message: 'Terjadi kesalahan saat memproses permintaan',
      error: error.message
    }, { status: 500 });
  }
} 