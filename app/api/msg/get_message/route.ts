import { NextResponse } from 'next/server';
import { shopeeApi } from '@/lib/shopeeConfig';
import { supabase } from '@/lib/supabase';


// Inisialisasi Supabase Client

export async function GET(request: Request) {
  try {
    // Ambil parameter dari query string
    const url = new URL(request.url);
    const conversationId = url.searchParams.get('conversationId');
    const offset = url.searchParams.get('offset') || undefined;
    const pageSize = parseInt(url.searchParams.get('pageSize') || '25', 10);
    const shopId = parseInt(url.searchParams.get('shopId') || '', 10);
    const message_id_list = url.searchParams.get('message_id_list')?.split(',').map(Number) || undefined;

    // Pastikan conversationId adalah string
    if (!conversationId || typeof conversationId !== 'string') {
      return NextResponse.json({ error: 'conversationId yang valid diperlukan' }, { status: 400 });
    }

    // Validasi pageSize
    if (isNaN(pageSize) || pageSize <= 0 || pageSize > 60) {
      return NextResponse.json({ error: 'Nilai pageSize tidak valid. Harus antara 1 dan 60.' }, { status: 400 });
    }

    // Ambil token berdasarkan shopId
    const { data: tokenData, error: tokenError } = await supabase
      .from('shopee_tokens')
      .select('access_token')
      .eq('shop_id', shopId)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json({ error: 'Gagal mengambil token untuk toko yang dipilih' }, { status: 500 });
    }
    console.log(tokenData)

    // Tambahkan log untuk memeriksa parameter
    console.log('Parameter API Shopee:', {
      shopId,
      accessToken: tokenData.access_token,
      conversationId,
      offset,
      pageSize
    });

    // Pastikan offset adalah string jika ada
    let offsetParam = offset ? offset.toString() : undefined;

    // Pastikan message_id_list adalah array of integer jika ada
    const messageIdList = message_id_list ? message_id_list.filter(id => Number.isInteger(id)) : undefined;

    // Jika tidak ada offset atau message_id_list, gunakan offset default
    if (!offsetParam && !messageIdList) {
      offsetParam = '0';
    }

    // Gunakan ShopeeAPI untuk mendapatkan pesan
    const messages = await shopeeApi.getMessages(
      shopId,
      tokenData.access_token,
      conversationId,
      { 
        offset: offsetParam, 
        page_size: pageSize,
        message_id_list: messageIdList
      }
    );

    // Penanganan khusus untuk kesalahan parameter
    if (messages.error === 'param_error') {
      console.error('Kesalahan parameter API Shopee:', messages);
      return NextResponse.json(
        { 
          error: 'Kesalahan parameter API Shopee', 
          message: messages.message,
          request_id: messages.request_id 
        }, 
        { status: 400 }
      );
    }

    // Penanganan umum untuk kesalahan lainnya
    if (messages.error) {
      console.error('Kesalahan API Shopee:', messages);
      return NextResponse.json(
        { 
          error: 'Kesalahan dari API Shopee', 
          details: messages 
        }, 
        { status: messages.status || 500 }
      );
    }

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error dalam mendapatkan pesan:', error);
    return NextResponse.json(
      { 
        error: 'Terjadi kesalahan internal', 
        details: (error as Error).message 
      }, 
      { status: 500 }
    );
  }
}
