import { NextRequest, NextResponse } from 'next/server';
import { shopeeApi } from '@/lib/shopeeConfig';
import { supabase } from '@/lib/supabase';

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
      // Jika berhasil, return data lengkap dari response Shopee
      return NextResponse.json({
        success: true,
        conversation: {
          message_id: result.response.message_id,
          to_id: result.response.to_id,
          message_type: result.response.message_type,
          content: result.response.content,
          conversation_id: result.response.conversation_id,
          created_timestamp: result.response.created_timestamp,
          source_content: result.response.source_content
        }
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
