import { NextRequest } from 'next/server';
import { checkRateLimit, createSSEConnection } from '@/app/services/serverSSEService';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/db';
import { shopeeTokens } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  // Cek rate limiting
  const rateLimitResult = checkRateLimit(ip);

  if (!rateLimitResult.allowed) {
    return new Response('Too Many Requests', { status: 429 });
  }

  try {
    // Autentikasi user
    const supabase = await createClient();

    // Menggunakan getUser() yang lebih aman daripada getSession()
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userId = user.id;

    // Ambil daftar toko yang dimiliki user
    const shops = await db.select({
      shop_id: shopeeTokens.shopId
    })
      .from(shopeeTokens)
      .where(
        and(
          eq(shopeeTokens.userId, userId),
          eq(shopeeTokens.isActive, true)
        )
      );

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