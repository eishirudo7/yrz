import { db } from '@/db';
import { shopeeNotifications } from '@/db/schema';
import { eq, inArray, desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { PenaltyService } from '@/app/services/penaltyService';
import { UpdateService } from '@/app/services/updateService';
import { ViolationService } from '@/app/services/violationService';
import { getAllShops } from '@/app/services/shopeeService';

// GET - Ambil notifikasi
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const shop_id = searchParams.get('shop_id');
    const unread_only = searchParams.get('unread_only') === 'true';

    const shops = await getAllShops();

    if (shops.length === 0) {
      return NextResponse.json([]);
    }

    const shop_ids = shops.map(shop => shop.id);

    // Build where conditions
    const conditions = [
      inArray(shopeeNotifications.notificationType, ['shop_penalty', 'shopee_update', 'item_violation']),
      inArray(shopeeNotifications.shopId, shop_ids.map(Number)),
    ];

    if (shop_id && shop_ids.includes(shop_id)) {
      conditions.push(eq(shopeeNotifications.shopId, Number(shop_id)));
    }

    if (unread_only) {
      conditions.push(eq(shopeeNotifications.read, false));
    }

    const { and } = await import('drizzle-orm');
    const notifications = await db.select()
      .from(shopeeNotifications)
      .where(and(...conditions))
      .orderBy(desc(shopeeNotifications.createdAt));

    // Transform notifications berdasarkan tipenya
    const transformedNotifications = notifications.map(notification => {
      switch (notification.notificationType) {
        case 'shop_penalty':
          return {
            id: notification.id,
            ...PenaltyService.createPenaltyNotification(notification.data as any),
            shop_name: notification.shopName
          };
        case 'shopee_update':
          return {
            ...UpdateService.createUpdateNotification({
              ...notification,
              id: notification.id
            } as any),
            shop_name: notification.shopName
          };
        case 'item_violation':
          return {
            id: notification.id,
            ...ViolationService.createViolationNotification(notification.data as any),
            shop_name: notification.shopName
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

    await db.update(shopeeNotifications)
      .set({
        read: true,
        updatedAt: new Date(),
      })
      .where(inArray(shopeeNotifications.id, notification_ids));

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