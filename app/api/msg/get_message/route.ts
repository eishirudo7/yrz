import { NextResponse } from 'next/server';
import { getMessages } from '@/app/services/shopeeService';

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

    // Validasi shopId
    if (isNaN(shopId) || shopId <= 0) {
      return NextResponse.json({ error: 'Nilai shopId tidak valid.' }, { status: 400 });
    }

    // Pastikan offset adalah string jika ada
    let offsetParam = offset ? offset.toString() : undefined;

    // Pastikan message_id_list adalah array of integer jika ada
    const messageIdList = message_id_list ? message_id_list.filter(id => Number.isInteger(id)) : undefined;

    // Jika tidak ada offset atau message_id_list, gunakan offset default
    if (!offsetParam && !messageIdList) {
      offsetParam = '0';
    }

    // Gunakan service function untuk mendapatkan pesan
    try {
      const messages = await getMessages(
        shopId,
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
      console.error('Error saat memanggil service getMessages:', error);
      return NextResponse.json(
        { 
          error: 'Terjadi kesalahan saat mengambil pesan', 
          details: (error as Error).message 
        }, 
        { status: 500 }
      );
    }
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
