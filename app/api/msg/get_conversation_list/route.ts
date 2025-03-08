import { NextResponse } from 'next/server';
import { getAllShops } from '@/app/services/shopeeService';
import { shopeeApi } from '@/lib/shopeeConfig';
// Inisialisasi Supabase Client



export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const unread = searchParams.get('unread');
    const limit = searchParams.get('limit');
    
    // Tentukan page_size berdasarkan parameter limit atau default 50
    const pageSize = limit ? parseInt(limit) : 50;
    
    // Gunakan getAllShops() sebagai pengganti query Supabase langsung
    const shopsResponse = await getAllShops();
    
    if (!shopsResponse || shopsResponse.length === 0) {
      return NextResponse.json({ message: 'Tidak ada toko yang terhubung' }, { status: 404 });
    }

    // Ambil daftar percakapan untuk setiap toko
    const allConversations = await Promise.all(
      shopsResponse.map(async (shop) => {
        try {
          const conversations = await shopeeApi.getConversationList(
            shop.shop_id,
            shop.access_token,
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
          console.error(`Error mengambil percakapan untuk toko ${shop.shop_id}:`, error);
          return [];
        }
      })
    );

    // Gabungkan semua percakapan menjadi satu array
    const flattenedConversations = allConversations.flat();

    // Filter percakapan unread jika parameter unread=true
    let filteredConversations = flattenedConversations;
    if (unread === 'true') {
      filteredConversations = flattenedConversations.filter(conv => conv.unread_count > 0);
    }

    // Urutkan percakapan berdasarkan last_message_timestamp secara menurun
    const sortedConversations = filteredConversations.sort((a, b) => 
      b.last_message_timestamp - a.last_message_timestamp
    );

    return NextResponse.json(sortedConversations);
  } catch (error) {
    console.error('Error dalam rute API:', error);
    return NextResponse.json({ message: 'Kesalahan Server Internal' }, { status: 500 });
  }
}
