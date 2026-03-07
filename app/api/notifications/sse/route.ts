import { NextRequest } from 'next/server';
import { checkRateLimit, createSSEConnection } from '@/app/services/serverSSEService';
import { createClient } from '@/utils/supabase/server';

export async function GET(req: NextRequest) {
  try {
    // Autentikasi user
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userId = user.id;

    // FIX #3: Rate limit berbasis userId, bukan IP
    const rateLimitResult = checkRateLimit(userId);
    if (!rateLimitResult.allowed) {
      return new Response('Too Many Requests', { status: 429 });
    }

    // Ambil daftar toko yang dimiliki user
    const { data: shops } = await supabase
      .from('shopee_tokens')
      .select('shop_id')
      .eq('user_id', userId)
      .eq('is_active', true);

    const shopIds = shops ? shops.map(shop => shop.shop_id) : [];

    // Buat koneksi SSE
    const stream = createSSEConnection(req, userId, shopIds);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[SSE] Error dalam membuat koneksi:', error);
    return new Response('Error', { status: 500 });
  }
}