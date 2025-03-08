import { supabase } from '@/lib/supabase';
import { sendEventToAll } from '@/app/api/webhook/route';

// Types
export interface ShopeeUpdateWebhook {
  code: number;
  timestamp: number;
  shop_id: number;
  data: {
    actions: Array<{
      content: string;
      update_time: number;
      title: string;
      url: string;
    }>;
  };
}

export interface UpdateNotification {
  id?: number;
  type: 'shopee_update';
  action: string;
  shop_id: number;
  shop_name: string;
  title: string;
  content: string;
  url: string;
  details: any;
  timestamp: number;
  read: boolean;
}

// Service Class
export class UpdateService {
  static async handleUpdate(webhookData: any & { shop_name: string }) {
    try {
      let actionsToProcess = [];
      
      // Cek struktur data dan sesuaikan
      if (Array.isArray(webhookData.data)) {
        // Struktur pertama: data langsung berupa array
        actionsToProcess = webhookData.data;
      } else if (webhookData.data?.actions) {
        // Struktur kedua: data.actions berupa array
        actionsToProcess = webhookData.data.actions;
      } else {
        throw new Error('Invalid update webhook structure');
      }

      // Proses setiap action
      for (const action of actionsToProcess) {
        await this.sendUpdateNotification(webhookData.shop_id, action, webhookData.shop_name);
      }
    } catch (error) {
      console.error('Error handling update:', error);
      throw error;
    }
  }

  private static async sendUpdateNotification(
    shop_id: number, 
    action: ShopeeUpdateWebhook['data']['actions'][0],
    shop_name: string
  ) {
    try {
      console.log('[UpdateService] Memulai proses notifikasi untuk shop_id:', shop_id);
      console.log('[UpdateService] Data action yang diterima:', JSON.stringify(action, null, 2));

      // Simpan ke database dulu dan dapatkan ID-nya
      const { data: insertedData, error } = await supabase
        .from('shopee_notifications')
        .insert({
          notification_type: 'shopee_update',
          shop_id: shop_id,
          shop_name: shop_name,
          data: {
            shop_id,
            shop_name,
            data: { actions: [action] }
          },
          processed: false,
          read: false
        })
        .select('id')
        .single();

      if (error) {
        console.error('[UpdateService] Error saat menyimpan ke database:', error);
        throw error;
      }

      console.log('[UpdateService] Berhasil menyimpan ke database dengan ID:', insertedData?.id);

      // Buat notifikasi dengan ID dari database
      const notification: UpdateNotification = {
        id: insertedData.id,
        type: 'shopee_update',
        action: 'UPDATE',
        shop_id: shop_id,
        shop_name: shop_name,
        title: action.title,
        content: action.content,
        url: action.url,
        details: {
          title: action.title,
          content: action.content,
          url: action.url
        },
        timestamp: action.update_time,
        read: false
      };

      sendEventToAll(notification);
    } catch (error) {
      console.error('Error sending update notification:', error);
      throw error;
    }
  }

  public static createUpdateNotification(notification: any): UpdateNotification {
    const action = notification.data.data.actions[0];
    return {
      id: notification.id,
      type: 'shopee_update',
      action: 'UPDATE',
      shop_id: notification.data.shop_id,
      shop_name: notification.data.shop_name,
      title: action.title,
      content: action.content,
      url: action.url,
      details: {
        title: action.title,
        content: action.content,
        url: action.url
      },
      timestamp: action.update_time,
      read: notification.read
    };
  }
} 