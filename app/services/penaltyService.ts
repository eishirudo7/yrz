import { supabase } from '@/lib/supabase';
import { sendEventToAll } from '@/app/api/webhook/route';

// Types
export interface ShopPenaltyWebhook {
  data: {
    action_type: 1 | 2 | 3;
    points_issued_data?: {
      issued_points: number;
      violation_type: number;
    };
    points_removed_data?: {
      removed_points: number;
      violation_type: number;
      removed_reason: number;
    };
    tier_update_data?: {
      old_tier: number;
      new_tier: number;
    };
    update_time: number;
  };
  shop_id: number;
  shop_name: string;
  code: number;
  timestamp: number;
}

export interface PenaltyNotification {
  type: 'shop_penalty';
  action: string;
  shop_id: number;
  shop_name: string;
  details: any;
  timestamp: number;
  read: boolean;
}

// Constants
export const VIOLATION_TYPES: { [key: number]: string } = {
  5: 'Tingkat Pengiriman Terlambat Tinggi',
  6: 'Tingkat Non-fulfillment Tinggi',
  7: 'Jumlah pesanan tidak terpenuhi tinggi',
  8: 'Jumlah pengiriman terlambat tinggi',
  9: 'Produk Terlarang',
  10: 'Pelanggaran Hak Cipta / IP',
  11: 'Spam',
  12: 'Menyalin/Mencuri gambar',
  13: 'Mengunggah ulang produk yang dihapus tanpa perubahan',
  14: 'Membeli barang palsu dari mall',
  15: 'Barang palsu terdeteksi Shopee',
  16: 'Persentase pre-order tinggi',
  17: 'Percobaan penipuan terkonfirmasi (total)',
  18: 'Percobaan penipuan mingguan (Voucher)',
  19: 'Alamat pengembalian palsu',
  20: 'Penipuan/penyalahgunaan pengiriman',
  21: 'Tingkat chat tidak direspon tinggi',
  22: 'Balasan chat kasar',
  23: 'Meminta pembeli membatalkan pesanan',
  24: 'Balasan kasar pada ulasan pembeli',
  25: 'Melanggar kebijakan Pengembalian/Refund',
  101: 'Alasan Tier',
  // ... tambahkan violation types lainnya dari 3026-3145
} as const;

export const REMOVAL_REASONS: { [key: number]: string } = {
  101: 'Alasan Lain',
  102: 'Error Sistem Shopee',
  103: 'Masalah Logistik Pihak Ketiga',
  104: 'Cuaca / Bencana Alam',
  105: 'Pengecualian Khusus',
  106: 'Pengecualian untuk fulfillment SBS',
  107: 'Pengecualian untuk pelanggaran listing SIP',
  108: 'IPR Tervalidasi'
} as const;

export const PENALTY_ACTIONS = {
  1: 'POINT_ISSUED',
  2: 'POINT_REMOVED',
  3: 'TIER_UPDATE'
} as const;


// Service Class
export class PenaltyService {
  static async handlePenalty(data: ShopPenaltyWebhook & { shop_name: string }) {
    try {
      await this.processPenaltyAction(data);
      await this.updateProcessedStatus(data);
      await this.sendPenaltyNotification(data);
    } catch (error) {
      console.error('Error handling penalty:', error);
      throw error;
    }
  }

  private static async processPenaltyAction(data: ShopPenaltyWebhook) {
    const processors = {
      1: this.processPenaltyPointIssued,
      2: this.processPenaltyPointRemoved,
      3: this.processPunishmentTierUpdate
    };

    const processor = processors[data.data.action_type];
    if (processor) {
      await processor(data);
    }
  }

  private static async updateProcessedStatus(data: ShopPenaltyWebhook) {
    await supabase
      .from('shopee_notifications')
      .update({ processed: true })
      .eq('shop_id', data.shop_id)
      .eq('data->timestamp', data.timestamp);
  }

  private static async sendPenaltyNotification(data: ShopPenaltyWebhook & { shop_name: string }) {
    try {
      const { data: insertedData, error } = await supabase
        .from('shopee_notifications')
        .insert({
          notification_type: 'shop_penalty',
          shop_id: data.shop_id,
          shop_name: data.shop_name,
          data: data,
          processed: false,
          read: false
        })
        .select('id')
        .single();

      if (error) throw error;

      const notification = this.createPenaltyNotification(data);
      const notificationWithId = {
        ...notification,
        id: insertedData.id,
        shop_name: data.shop_name
      };

      sendEventToAll(notificationWithId);
    } catch (error) {
      console.error('Error sending penalty notification:', error);
      throw error;
    }
  }

  public static createPenaltyNotification(data: ShopPenaltyWebhook): PenaltyNotification {
    return {
      type: 'shop_penalty',
      action: PENALTY_ACTIONS[data.data.action_type],
      shop_id: data.shop_id,
      shop_name: data.shop_name,
      details: this.getPenaltyDetails(data),
      timestamp: data.timestamp,
      read: false
    };
  }

  private static getPenaltyDetails(data: ShopPenaltyWebhook) {
    const { data: penaltyData } = data;

    if (penaltyData.points_issued_data) {
      return {
        points: penaltyData.points_issued_data.issued_points,
        violation_type: VIOLATION_TYPES[penaltyData.points_issued_data.violation_type]
      };
    }

    if (penaltyData.points_removed_data) {
      return {
        points: penaltyData.points_removed_data.removed_points,
        reason: REMOVAL_REASONS[penaltyData.points_removed_data.removed_reason]
      };
    }

    if (penaltyData.tier_update_data) {
      return {
        old_tier: penaltyData.tier_update_data.old_tier,
        new_tier: penaltyData.tier_update_data.new_tier
      };
    }

    return {};
  }

  private static async processPenaltyPointIssued(data: ShopPenaltyWebhook) {
    const { points_issued_data } = data.data;
    if (!points_issued_data) return;

    console.log(`
      Toko ${data.shop_id} menerima penalti:
      - Poin: ${points_issued_data.issued_points}
      - Jenis Pelanggaran: ${VIOLATION_TYPES[points_issued_data.violation_type]}
      - Waktu: ${new Date(data.data.update_time * 1000).toLocaleString()}
    `);
  }

  private static async processPenaltyPointRemoved(data: ShopPenaltyWebhook) {
    const { points_removed_data } = data.data;
    if (!points_removed_data) return;

    console.log(`
      Penalti dihapus untuk toko ${data.shop_id}:
      - Poin: ${points_removed_data.removed_points}
      - Alasan: ${REMOVAL_REASONS[points_removed_data.removed_reason]}
      - Waktu: ${new Date(data.data.update_time * 1000).toLocaleString()}
    `);
  }

  private static async processPunishmentTierUpdate(data: ShopPenaltyWebhook) {
    const { tier_update_data } = data.data;
    if (!tier_update_data) return;

    console.log(`
      Update tier hukuman untuk toko ${data.shop_id}:
      - Tier Lama: ${tier_update_data.old_tier}
      - Tier Baru: ${tier_update_data.new_tier}
      - Waktu: ${new Date(data.data.update_time * 1000).toLocaleString()}
    `);
  }
} 