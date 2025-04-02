import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { PenaltyService } from '@/app/services/penaltyService';
import { UpdateService } from '@/app/services/updateService';
import { ViolationService } from '@/app/services/violationService';
import { cookies } from 'next/headers';
import { getAllShops } from '@/app/services/shopeeService';

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
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const shop_id = searchParams.get('shop_id');
    const unread_only = searchParams.get('unread_only') === 'true';
    
    // Dapatkan daftar toko yang dimiliki user
    const shops = await getAllShops();
    const userShopIds = shops.map(shop => shop.shop_id);
    
    const supabase = await createClient();
    let query = supabase
      .from('shopee_notifications')
      .select('*')
      .in('notification_type', ['shop_penalty', 'shopee_update', 'item_violation'])
      .in('shop_id', userShopIds)
      .order('created_at', { ascending: false });

    if (shop_id) {
      if (!userShopIds.includes(parseInt(shop_id))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      query = query.eq('shop_id', shop_id);
    }

    if (unread_only) {
      query = query.eq('read', false);
    }

    const { data: notifications, error } = await query;
    
    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform notifications berdasarkan tipenya
    const transformedNotifications = (notifications as Notification[]).map(notification => {
      switch (notification.notification_type) {
        case 'shop_penalty':
          return {
            id: notification.id,
            ...PenaltyService.createPenaltyNotification(notification.data),
            shop_name: notification.shop_name
          };
        case 'shopee_update':
          return {
            ...UpdateService.createUpdateNotification({
              ...notification,
              id: notification.id
            }),
            shop_name: notification.shop_name
          };
        case 'item_violation':
          return {
            id: notification.id,
            ...ViolationService.createViolationNotification(notification.data),
            shop_name: notification.shop_name
          };
        default:
          return null;
      }
    }).filter(Boolean);
    
    return NextResponse.json(transformedNotifications);
  } catch (error) {
    console.error('Error in GET notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
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