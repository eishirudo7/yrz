import { createClient } from '@/utils/supabase/server';
import { NextResponse, NextRequest } from 'next/server';

import { getAllShops } from '@/app/services/shopeeService';
import { checkRateLimit, createSSEConnection } from '@/app/services/serverSSEService';

interface Notification {
  id: number;
  shop_id: number;
  notification_type: 'shop_penalty' | 'shopee_update' | 'item_violation';
  data: any;
  shop_name: string;
  read: boolean;
  created_at: string;
  updated_at: string;
}

// GET - Ambil notifikasi
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

// POST - Tandai sebagai sudah dibaca
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { notification_ids } = body;

    if (!notification_ids || !Array.isArray(notification_ids)) {
      return NextResponse.json(
        { error: 'notification_ids harus berupa array' }, 
        { status: 400 }
      );
    }

    // Dapatkan daftar toko yang dimiliki user
    const shops = await getAllShops();
    const userShopIds = shops.map(shop => shop.shop_id);

    const supabase = await createClient();
    // Pastikan semua notifikasi yang akan diupdate adalah milik toko user
    const { data: notifications } = await supabase
      .from('shopee_notifications')
      .select('id, shop_id')
      .in('id', notification_ids);

    if (!notifications) {
      return NextResponse.json({ error: 'Notifications not found' }, { status: 404 });
    }

    // Cek apakah ada notifikasi yang bukan milik toko user
    const unauthorizedNotifications = (notifications as Notification[]).filter(
      notification => !userShopIds.includes(notification.shop_id)
    );

    if (unauthorizedNotifications.length > 0) {
      return NextResponse.json({ error: 'Unauthorized access to some notifications' }, { status: 403 });
    }

    const { error } = await supabase
      .from('shopee_notifications')
      .update({ 
        read: true,
        updated_at: new Date().toISOString()
      })
      .in('id', notification_ids);

    if (error) {
      console.error('Error updating notifications:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `${notification_ids.length} notifikasi ditandai telah dibaca` 
    });
    
  } catch (error) {
    console.error('Error in POST notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 