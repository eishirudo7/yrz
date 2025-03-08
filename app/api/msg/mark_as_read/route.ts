import { NextRequest, NextResponse } from 'next/server';
import { readConversation } from '@/app/services/shopeeService';
import { JSONStringify } from 'json-with-bigint';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shopId = parseInt(searchParams.get('shopId') || '0');
    const conversationId = searchParams.get('conversationId') || '0';
    const lastReadMessageId = searchParams.get('lastReadMessageId') || '';

    if (!shopId || !conversationId || !lastReadMessageId) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const result = await readConversation(shopId, conversationId, lastReadMessageId);

    return new NextResponse(JSONStringify(result), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
  } catch (error) {
    console.error('Kesalahan saat menandai pesan sebagai dibaca:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan internal' }, { status: 500 });
  }
}
