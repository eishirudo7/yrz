import { NextRequest } from 'next/server';
import { checkRateLimit, createSSEConnection } from '@/app/services/serverSSEService';
import { createClient } from '@/utils/supabase/server';

export async function GET(req: NextRequest) {
  console.log('SSE endpoint hit - new connection attempt');
  const ip = req.ip || 'unknown';
  console.log('Client IP:', ip);
  
  // Cek rate limiting
  const rateLimitResult = checkRateLimit(ip);
  console.log('Rate limit check result:', rateLimitResult);
  
  if (!rateLimitResult.allowed) {
    console.log('Rate limit exceeded, rejecting connection');
    return new Response('Too Many Requests', { status: 429 });
  }

  try {
    // Autentikasi user
    console.log('Validating authentication');
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session || !session.user) {
      console.log('User not authenticated, rejecting connection');
      return new Response('Unauthorized', { status: 401 });
    }
    
    const userId = session.user.id;
    console.log('Authenticated user ID:', userId);
    
    // Ambil daftar toko yang dimiliki user
    console.log('Fetching shops owned by user');
    const { data: shops } = await supabase
      .from('shopee_tokens')
      .select('shop_id')
      .eq('user_id', userId)
      .eq('is_active', true);
    
    const shopIds = shops ? shops.map(shop => shop.shop_id) : [];
    console.log('User shops:', shopIds);
    
    // Buat koneksi SSE dengan informasi user dan toko
    console.log('Creating SSE connection for user');
    const stream = createSSEConnection(req, userId, shopIds);
    console.log('SSE stream created successfully');

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