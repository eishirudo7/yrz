import { supabase } from '@/lib/supabase';
import { sendEventToAll } from '@/app/api/webhook/route';

// Types
export interface ViolationItemWebhook {
  data: {
    item_id: number;
    item_name: string;
    item_status: 'BANNED' | 'SHOPEE_DELETE' | 'NORMAL';
    deboost: boolean;
    item_status_details?: Array<{
      suggested_category: any;
      violation_type: string;
      violation_reason: string;
      suggestion: string;
      fix_deadline_time: number;
      update_time: number;
    }>;
    deboosted_details?: Array<{
      violation_type: string;
      violation_reason: string;
      suggestion: string;
      fix_deadline_time: number;
      update_time: number;
      suggested_category?: Array<{
        category_id: number;
        category_name: string;
      }>;
    }>;
  };
  shop_id: number;
  shop_name: string;
  code: number;
  timestamp: number;
}

export interface ViolationNotification {
  id?: number;
  type: 'item_violation';
  action: string;
  shop_id: number;
  shop_name: string;
  details: {
    item_id: number;
    item_name: string;
    status: string;
    violations: Array<{
      type: string;
      reason: string;
      suggestion: string;
      deadline: number;
      suggested_category?: Array<{
        id: number;
        name: string;
      }>;
    }>;
  };
  timestamp: number;
  read: boolean;
}

// Service Class
export class ViolationService {
  static async handleViolation(data: ViolationItemWebhook & { shop_name: string }) {
    try {
      await this.sendViolationNotification(data);
    } catch (error) {
      console.error('Error handling violation:', error);
      throw error;
    }
  }

  private static async sendViolationNotification(data: ViolationItemWebhook & { shop_name: string }) {
    try {
      // Simpan ke database dan dapatkan ID
      const { data: insertedData, error } = await supabase
        .from('shopee_notifications')
        .insert({
          notification_type: 'item_violation',
          shop_id: data.shop_id,
          shop_name: data.shop_name,
          data: data,
          processed: true,
          read: false
        })
        .select('id')
        .single();

      if (error) throw error;

      // Buat notifikasi dengan ID dari database
      const notification = this.createViolationNotification(data);
      const notificationWithId = {
        ...notification,
        id: insertedData.id,
        shop_name: data.shop_name
      };

      sendEventToAll(notificationWithId);
    } catch (error) {
      console.error('Error sending violation notification:', error);
      throw error;
    }
  }

  public static createViolationNotification(data: ViolationItemWebhook): ViolationNotification {
    const violations = data.data.deboost 
      ? data.data.deboosted_details
      : data.data.item_status_details;

    return {
      type: 'item_violation',
      action: this.getViolationAction(data.data),
      shop_id: data.shop_id,
      shop_name: data.shop_name,
      details: {
        item_id: data.data.item_id,
        item_name: data.data.item_name,
        status: data.data.item_status,
        violations: violations?.map(v => ({
          type: v.violation_type,
          reason: v.violation_reason,
          suggestion: v.suggestion,
          deadline: v.fix_deadline_time,
          suggested_category: v.suggested_category
        })) || []
      },
      timestamp: data.timestamp,
      read: false
    };
  }

  private static getViolationAction(data: ViolationItemWebhook['data']): string {
    if (data.item_status === 'BANNED') return 'ITEM_BANNED';
    if (data.item_status === 'SHOPEE_DELETE') return 'ITEM_DELETED';
    if (data.deboost) return 'ITEM_DEBOOSTED';
    return 'ITEM_VIOLATION';
  }
} 