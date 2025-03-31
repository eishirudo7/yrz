import { NextResponse } from 'next/server';
import { getOneConversation } from '@/app/services/shopeeService';

export async function GET(request: Request) {
  try {
    // Ambil parameter dari query string
    const url = new URL(request.url);
    const conversationId = url.searchParams.get('conversationId');
    const shopId = parseInt(url.searchParams.get('shopId') || '', 10);

    // Pastikan conversationId adalah string
    if (!conversationId || typeof conversationId !== 'string') {
      return NextResponse.json({ error: 'conversationId yang valid diperlukan' }, { status: 400 });
    }

    // Validasi shopId
    if (isNaN(shopId) || shopId <= 0) {
      return NextResponse.json({ error: 'Nilai shopId tidak valid.' }, { status: 400 });
    }

    try {
      // Gunakan service function untuk mendapatkan data percakapan
      const conversation = await getOneConversation(shopId, conversationId);

      // Penanganan khusus untuk kesalahan parameter
      if (conversation.error === 'param_error') {
        console.error('Kesalahan parameter API Shopee:', conversation);
        return NextResponse.json(
          { 
            error: 'Kesalahan parameter API Shopee', 
            message: conversation.message,
            request_id: conversation.request_id 
          }, 
          { status: 400 }
        );
      }

      // Penanganan umum untuk kesalahan lainnya
      if (conversation.error) {
        console.error('Kesalahan API Shopee:', conversation);
        return NextResponse.json(
          { 
            error: 'Kesalahan dari API Shopee', 
            details: conversation 
          }, 
          { status: conversation.status || 500 }
        );
      }

      return NextResponse.json(conversation);
    } catch (error) {
      console.error('Error saat memanggil service getOneConversation:', error);
      return NextResponse.json(
        { 
          error: 'Terjadi kesalahan saat mengambil data percakapan', 
          details: (error as Error).message 
        }, 
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error dalam mendapatkan data percakapan:', error);
    return NextResponse.json(
      { 
        error: 'Terjadi kesalahan internal', 
        details: (error as Error).message 
      }, 
      { status: 500 }
    );
  }
} 