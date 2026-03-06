import { sendEventToShopOwners } from '@/app/services/serverSSEService';
import { insertNotification } from '@/app/services/databaseOperations';

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

      if (Array.isArray(webhookData.data)) {
        actionsToProcess = webhookData.data;
      } else if (webhookData.data?.actions) {
        actionsToProcess = webhookData.data.actions;
      } else {
        throw new Error('Invalid update webhook structure');
      }

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

      const insertedData = await insertNotification({
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
      });

      console.log('[UpdateService] Berhasil menyimpan ke database dengan ID:', insertedData?.id);

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

      sendEventToShopOwners(notification);
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