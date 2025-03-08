import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { PenaltyService } from '@/app/services/penaltyService';
import { UpdateService } from '@/app/services/updateService';
import { ViolationService } from '@/app/services/violationService';

// GET - Ambil notifikasi
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const shop_id = searchParams.get('shop_id');
    const unread_only = searchParams.get('unread_only') === 'true';
    
    let query = supabase
      .from('shopee_notifications')
      .select('*')
      .in('notification_type', ['shop_penalty', 'shopee_update', 'item_violation'])
      .order('created_at', { ascending: false });

    if (shop_id) {
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
    const transformedNotifications = notifications.map(notification => {
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