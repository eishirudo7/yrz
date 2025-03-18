import { NextRequest, NextResponse } from 'next/server';
import { shopeeApi } from '@/lib/shopeeConfig';
import { supabase } from '@/lib/supabase';
import { JSONStringify } from 'json-with-bigint';

export async function POST(req: NextRequest) {
  try {
    const { userId, orderSn, shopId } = await req.json();

    if (!userId || !orderSn || !shopId) {
      return NextResponse.json(
        { success: false, error: 'userId, orderSn, dan shopId harus diisi' },
        { status: 400 }
      );
    }

    // Ambil access token dari database
    const { data: tokenData, error: tokenError } = await supabase
      .from('shopee_tokens')
      .select('access_token')
      .eq('shop_id', shopId)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { success: false, error: 'Gagal mengambil akses token' },
        { status: 500 }
      );
    }

    // Kirim pesan order menggunakan API yang sudah ada
    const result = await shopeeApi.sendMessage(
      shopId,
      tokenData.access_token,
      userId,
      'order',
      { order_sn: orderSn }
    );

    // Tampilkan respon dari Shopee API
    console.log('Respon dari Shopee API:', result);

    if (result.response && result.response.message_id) {
      const respData = {
        success: true,
        conversation: {
          ...result.response,
          conversation_id: String(result.response.conversation_id)
        }
      };
      
      // Gunakan JSONStringify untuk memastikan penanganan BigInt yang konsisten
      return new NextResponse(JSONStringify(respData), {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'Gagal memulai percakapan' 
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error starting conversation:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan internal server' },
      { status: 500 }
    );
  }
}
