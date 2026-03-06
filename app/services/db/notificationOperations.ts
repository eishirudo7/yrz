/**
 * Database operations untuk shopee_notifications
 */
import { supabase } from '@/lib/supabase';

// ============================================================
// INSERT NOTIFICATIONS
// ============================================================

export async function insertNotification(data: {
    notification_type: string;
    shop_id: number;
    shop_name: string;
    data: any;
    processed: boolean;
    read: boolean;
}): Promise<{ id: number }> {
    const { data: insertedData, error } = await supabase
        .from('shopee_notifications')
        .insert(data)
        .select('id')
        .single();

    if (error) throw error;
    return insertedData;
}

// ============================================================
// UPDATE NOTIFICATIONS
// ============================================================

export async function updateNotificationProcessed(shopId: number, timestamp: number): Promise<void> {
    await supabase
        .from('shopee_notifications')
        .update({ processed: true })
        .eq('shop_id', shopId)
        .eq('data->timestamp', timestamp);
}

export async function markNotificationsAsRead(notificationIds: number[]): Promise<void> {
    const { error } = await supabase
        .from('shopee_notifications')
        .update({
            read: true,
            updated_at: new Date().toISOString()
        })
        .in('id', notificationIds);

    if (error) {
        console.error('Error updating notifications:', error);
        throw error;
    }
}

// ============================================================
// FETCH NOTIFICATIONS
// ============================================================

export async function fetchNotifications(params: {
    shopIds: (string | number)[];
    shopId?: string | null;
    unreadOnly?: boolean;
}): Promise<any[]> {
    let query = supabase
        .from('shopee_notifications')
        .select('*')
        .in('notification_type', ['shop_penalty', 'shopee_update', 'item_violation'])
        .in('shop_id', params.shopIds)
        .order('created_at', { ascending: false });

    if (params.shopId && params.shopIds.includes(params.shopId)) {
        query = query.eq('shop_id', params.shopId);
    }

    if (params.unreadOnly) {
        query = query.eq('read', false);
    }

    const { data: notifications, error } = await query;

    if (error) {
        console.error('Error fetching notifications:', error);
        throw error;
    }

    return notifications || [];
}
