import { NextResponse } from 'next/server';
import { getAllShops, getConversationList } from '@/app/services/shopeeService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const unread = searchParams.get('unread');
    const limit = searchParams.get('limit');
    const pageSize = limit ? parseInt(limit) : 50;

    const shopsResponse = await getAllShops();

    if (!shopsResponse || shopsResponse.length === 0) {
      return NextResponse.json({ message: 'Tidak ada toko yang terhubung' }, { status: 404 });
    }

    // FIX #12: Track error per toko agar UI bisa menampilkan warning
    const shopErrors: { shopId: number; shopName: string; error: string }[] = [];

    const allConversations = await Promise.all(
      shopsResponse.map(async (shop) => {
        try {
          const conversations = await getConversationList(
            shop.shop_id,
            {
              direction: 'older',
              type: 'all',
              page_size: pageSize
            }
          );

          return conversations.response.conversations.map((conv: any) => ({
            ...conv,
            shop_name: shop.shop_name
          }));
        } catch (error) {
          // FIX #12: Catat error per toko alih-alih ditelan
          console.error(`[get_conversation_list] Error toko ${shop.shop_id} (${shop.shop_name}):`, error);
          shopErrors.push({
            shopId: shop.shop_id,
            shopName: shop.shop_name,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          return [];
        }
      })
    );

    const flattenedConversations = allConversations.flat();

    let filteredConversations = flattenedConversations;
    if (unread === 'true') {
      filteredConversations = flattenedConversations.filter(conv => conv.unread_count > 0);
    }

    const sortedConversations = filteredConversations.sort((a, b) =>
      b.last_message_timestamp - a.last_message_timestamp
    );

    // FIX #12: Jika ada toko yang gagal, sertakan dalam response agar client bisa warning
    if (shopErrors.length > 0) {
      return NextResponse.json({ conversations: sortedConversations, shopErrors });
    }

    return NextResponse.json(sortedConversations);
  } catch (error) {
    console.error('[get_conversation_list] Error:', error);
    return NextResponse.json({ message: 'Kesalahan Server Internal' }, { status: 500 });
  }
}
