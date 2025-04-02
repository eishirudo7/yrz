import { NextRequest } from 'next/server';
import { checkRateLimit, createSSEConnection } from '@/app/services/serverSSEService';
import { createClient } from '@/utils/supabase/server';

export async function GET(req: NextRequest) {
  const ip = req.ip || 'unknown';
  
  // Cek rate limiting
  const rateLimitResult = checkRateLimit(ip);
  
  if (!rateLimitResult.allowed) {
    return new Response('Too Many Requests', { status: 429 });
  }

  try {
    // Autentikasi user
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session || !session.user) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    const userId = session.user.id;
    
    // Ambil daftar toko yang dimiliki user
    const { data: shops } = await supabase
      .from('shopee_tokens')
      .select('shop_id')
      .eq('user_id', userId)
      .eq('is_active', true);
    
    const shopIds = shops ? shops.map(shop => shop.shop_id) : [];
    
    // Buat koneksi SSE dengan informasi user dan toko
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
    console.error('Error dalam membuat SSE connection:', error);
    return new Response('Error', { status: 500 });
  }
} 