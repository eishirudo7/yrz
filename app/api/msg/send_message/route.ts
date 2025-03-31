import { NextRequest, NextResponse } from 'next/server';
import { JSONStringify } from 'json-with-bigint';
import { sendMessage } from '@/app/services/shopeeService';

export async function POST(req: NextRequest) {
  const currentTime = new Date().toISOString();
  const body = await req.json();
  
  console.log(`[${currentTime}] Data baru yang diterima di server:`, JSON.stringify(body));

  try {
    const { toId, messageType = 'text', content, shopId } = body;
    console.log('Data yang diterima di server:', { toId, messageType, content, shopId });

    // Pastikan toId dan shopId adalah number
    const parsedToId = Number(toId);
    const parsedShopId = Number(shopId);

    if (isNaN(parsedToId) || isNaN(parsedShopId)) {
      return NextResponse.json({ success: false, error: 'toId dan shopId harus berupa angka' }, { status: 400 });
    }

    // Validasi messageType
    if (!['text', 'sticker', 'image', 'item', 'order'].includes(messageType)) {
      return NextResponse.json({ success: false, error: 'messageType tidak valid' }, { status: 400 });
    }

    // Validasi content berdasarkan messageType
    if (!validateContent(messageType, content)) {
      return NextResponse.json({ success: false, error: 'content tidak valid untuk messageType yang dipilih' }, { status: 400 });
    }

    try {
      // Gunakan service function untuk mengirim pesan
      const result = await sendMessage(parsedShopId, parsedToId, messageType, content);
      
      // Log hasil dari API Shopee
      console.log('Hasil dari API Shopee:', result);
  
      // Periksa keberhasilan berdasarkan adanya 'response' dan 'message_id'
      if (result.response && result.response.message_id) {
        console.log('Pesan berhasil dikirim:', result.response);
        
        // Gunakan NextResponse dengan JSONStringify untuk menangani BigInt
        return new NextResponse(JSONStringify({
          success: true,
          data: {
            ...result.response,
            conversation_id: String(result.response.conversation_id) // Pastikan conversation_id adalah string
          }
        }), {
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } else {
        console.error('Gagal mengirim pesan:', result.error || 'Tidak ada message_id dalam respons');
        return NextResponse.json({ success: false, error: result.error || 'Gagal mengirim pesan' }, { status: 400 });
      }
    } catch (error) {
      console.error('Error saat mengirim pesan:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Terjadi kesalahan saat mengirim pesan',
          details: (error as Error).message
        }, 
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error internal server:', error);
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan internal server' }, { status: 500 });
  }
}

function validateContent(messageType: string, content: any): boolean {
  switch (messageType) {
    case 'text':
      return typeof content === 'string' && content.trim().length > 0;
    case 'sticker':
      return content && typeof content.sticker_id === 'number' && typeof content.sticker_package_id === 'number';
    case 'image':
      return content && typeof content.image_url === 'string' && content.image_url.trim().length > 0;
    case 'item':
      return content && Number.isInteger(content.item_id) && content.item_id > 0;
    case 'order':
      return content && typeof content.order_sn === 'string' && content.order_sn.trim().length > 0;
    default:
      return false;
  }
}
