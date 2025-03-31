import { NextRequest, NextResponse } from 'next/server';
import { sendMessage } from '@/app/services/shopeeService';
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

    try {
      // Gunakan service function untuk mengirim pesan
      const result = await sendMessage(
        shopId,
        userId,
        'order',
        { order_sn: orderSn }
      );

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
      console.error('Error mengirim pesan:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Terjadi kesalahan saat menginisialisasi percakapan',
          details: (error as Error).message
        },
        { status: 500 }
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
