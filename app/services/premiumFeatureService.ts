import { withRetry } from '@/app/services/databaseOperations';
import { UserSettingsService, Shop } from '@/app/services/userSettingsService';
import { processReadyToShipOrders } from "@/app/services/shopeeService";

export async function prosesOrder(shopId: number, orderSn: string, shippingMethod: string = 'dropoff', interval: number = 5): Promise<any> {
    // Menambahkan delay sesuai interval dalam detik
    await new Promise(resolve => setTimeout(resolve, interval * 1000));
    
    const shipResult = await processReadyToShipOrders(shopId, orderSn, shippingMethod);
    
    return shipResult;
}

/**
 * Service untuk mengelola fitur-fitur premium dalam aplikasi
 * 
 * PremiumFeatureService bertanggung jawab untuk:
 * 1. Memverifikasi apakah pengguna memiliki paket premium
 * 2. Mengelola fitur auto-ship (hanya untuk pengguna premium)
 * 3. Mengelola fitur auto-cancel-chat (hanya untuk pengguna premium)
 */
export class PremiumFeatureService {
  /**
   * Memproses template string dengan mengganti variabel
   * @param template Template string yang akan diproses
   * @param variables Objek berisi variabel yang akan diganti
   * @returns String yang sudah diproses
   */
  private static processTemplate(template: string, variables: Record<string, string>): string {
    return template.replace(/\${(\w+)}/g, (match, key) => {
      return variables[key] || match;
    });
  }

  /**
   * Memeriksa apakah toko memiliki paket premium hanya dengan shopId
   * 
   * @param shopId - ID toko yang akan diperiksa
   * @returns Boolean yang menunjukkan apakah toko memiliki paket premium
   */
  static async isPremiumShopByShopId(shopId: number): Promise<boolean> {
    try {
      // Dapatkan pengaturan toko dari shopId
      const { shop, userId } = await UserSettingsService.getShopSettingsByShopId(shopId);
      
      if (!shop || !userId) {
        console.warn(`Tidak menemukan pengaturan untuk toko ${shopId}`);
        return false;
      }

      // Dapatkan pengaturan user untuk mengecek subscription
      const userSettings = await UserSettingsService.getUserSettings(userId);
      
      // Cek apakah user memiliki subscription dan plan name adalah 'Admin'
      const isPremium = userSettings.subscription?.plan?.name === 'Admin';
      
      return isPremium;
    } catch (error) {
      console.error(`Error checking premium status for shop ${shopId}:`, error);
      return false;
    }
  }

  /**
   * Menangani auto-ship untuk toko premium
   * Hanya berjalan jika toko memiliki paket premium dan status_ship diaktifkan
   * 
   * @param shopId - ID toko
   * @param orderSn - Nomor pesanan
   * @returns Boolean yang menunjukkan keberhasilan proses
   */
  static async handleAutoShip(shopId: number, orderSn: string): Promise<boolean> {
    try {
      // Dapatkan pengaturan toko dan userId dari shopId
      const { shop, userId } = await UserSettingsService.getShopSettingsByShopId(shopId);
      
      if (!shop || !userId) {
        console.warn(`Tidak menemukan pengaturan atau user untuk toko ${shopId}`);
        return false;
      }
      
      // Dapatkan pengaturan user untuk mengecek subscription
      const userSettings = await UserSettingsService.getUserSettings(userId);
      
      // Verifikasi status premium berdasarkan plan name
      const isPremium = userSettings.subscription?.plan?.name === 'Admin';
      if (!isPremium) {
        console.log(`Toko ${shopId} bukan premium user, auto-ship tidak dijalankan`);
        return false;
      }
      
      // Cek status auto-ship dari pengaturan toko
      if (!shop.status_ship) {
        console.log(`Auto-ship tidak aktif untuk toko ${shopId}`);
        return false;
      }
      
      // Jalankan auto-ship untuk toko premium dengan interval dalam detik
      const result = await withRetry(
        () => prosesOrder(shopId, orderSn, 'dropoff', userSettings.auto_ship_interval),
        3,
        2000
      );
      
      console.log(`Auto-ship berhasil dijalankan untuk toko ${shopId}, pesanan ${orderSn} dengan interval ${userSettings.auto_ship_interval} detik`);
      return true;
    } catch (error) {
      console.error(`Error handling auto-ship for shop ${shopId}:`, error);
      return false;
    }
  }

  /**
   * Menangani pengiriman pesan otomatis untuk berbagai status order
   * 
   * @param shopId - ID toko
   * @param orderSn - Nomor pesanan
   * @param buyerUserId - ID pengguna pembeli
   * @param buyerUsername - Nama pengguna pembeli
   * @param statusType - Tipe status ('cancel' | 'return')
   * @returns Boolean yang menunjukkan keberhasilan proses
   */
  private static async handleAutoChat(
    shopId: number, 
    orderSn: string, 
    buyerUserId: string, 
    buyerUsername: string,
    statusType: 'cancel' | 'return'
  ): Promise<boolean> {
    try {
      // Dapatkan pengaturan toko dan userId dari shopId
      const { shop, userId } = await UserSettingsService.getShopSettingsByShopId(shopId);
      
      if (!shop || !userId) {
        console.warn(`Tidak menemukan pengaturan atau user untuk toko ${shopId}`);
        return false;
      }
      
      // Dapatkan pengaturan user untuk mengecek subscription
      const userSettings = await UserSettingsService.getUserSettings(userId);
      
      // Verifikasi status premium berdasarkan plan name
      const isPremium = userSettings.subscription?.plan?.name === 'Admin';
      if (!isPremium) {
        console.log(`Toko ${shopId} bukan premium user, auto-chat tidak dijalankan`);
        return false;
      }
      
      // Cek status auto-chat dari pengaturan toko
      if (statusType === 'cancel' && !userSettings.in_cancel_status) {
        console.log(`Auto-chat cancel tidak aktif untuk toko ${shopId}`);
        return false;
      }
      if (statusType === 'return' && !userSettings.in_return_status) {
        console.log(`Auto-chat return tidak aktif untuk toko ${shopId}`);
        return false;
      }

      // Cek status_chat hanya jika status cancel/return aktif
      if (!shop.status_chat) {
        console.log(`Auto-chat tidak aktif untuk toko ${shopId}`);
        return false;
      }

      const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:10000';

      // Kirim pesan pertama dengan tipe 'order'
      console.log('Memulai pengiriman pesan pertama ke pembeli');
      const orderResponse = await fetch(`${API_BASE_URL}/api/msg/send_message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          toId: buyerUserId,
          messageType: 'order',
          content: {
            order_sn: orderSn
          },
          shopId: shopId
        })
      });

      if (!orderResponse.ok) {
        throw new Error(`Gagal mengirim pesan order ke pembeli ${buyerUsername}`);
      }

      // Tunggu sebentar sebelum mengirim pesan kedua
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Ambil template pesan berdasarkan status
      let template: string;
      if (statusType === 'cancel') {
        template = userSettings.in_cancel_msg || 
          `Halo ${buyerUsername},\\n\\nMohon maaf, pesanan dengan nomor ${orderSn} sudah kami kemas, jika kakak ingin mengubah warna atau ukuran, silakan tulis permintaan kakak di sini.\\n\\nDitunggu ya kak responnya.`;
      } else {
        template = userSettings.in_return_msg || 
          `Halo ${buyerUsername},\\n\\nPengembalian pesanan ${orderSn} harus dengan alasan yang jelas ya kak, jika terkesan tidak jelas atau mempermainkan seller maka akan kami banding juga ke shopee \\n\\nTerima kasih..`;
      }

      // Proses template dengan variabel
      const processedMessage = this.processTemplate(template, {
        buyerUsername,
        orderSn
      }).replace(/\\n/g, '\n');

      // Kirim pesan kedua dengan teks informasi
      console.log('Memulai pengiriman pesan kedua ke pembeli');
      const textResponse = await fetch(`${API_BASE_URL}/api/msg/send_message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          toId: buyerUserId,
          messageType: 'text',
          content: processedMessage,
          shopId: shopId
        })
      });

      if (!textResponse.ok) {
        throw new Error(`Gagal mengirim pesan teks ke pembeli ${buyerUsername}`);
      }

      console.log(`Pesan ${statusType} berhasil dikirim ke pembeli untuk order ${orderSn}`);
      return true;
    } catch (error) {
      console.error(`Error handling auto-chat for shop ${shopId}:`, error);
      return false;
    }
  }

  /**
   * Menangani auto-cancel-chat untuk toko premium
   */
  static async handleChatCancel(
    shopId: number, 
    orderSn: string, 
    buyerUserId: string, 
    buyerUsername: string
  ): Promise<boolean> {
    return this.handleAutoChat(shopId, orderSn, buyerUserId, buyerUsername, 'cancel');
  }

  /**
   * Menangani auto-chat untuk return order
   */
  static async handleChatReturn(
    shopId: number, 
    orderSn: string, 
    buyerUserId: string, 
    buyerUsername: string
  ): Promise<boolean> {
    return this.handleAutoChat(shopId, orderSn, buyerUserId, buyerUsername, 'return');
  }

  /**
   * Dapatkan informasi toko berdasarkan shopId dari pengguna tertentu
   * 
   * @param shopId - ID toko
   * @returns Object dengan informasi toko atau null jika tidak ditemukan
   */
  static async getShopInfo(shopId: number): Promise<{ shopName: string, userId: string } | null> {
    try {
      const { shop, userId } = await UserSettingsService.getShopSettingsByShopId(shopId);
      
      if (!shop || !userId) return null;
      
      return {
        shopName: shop.shop_name,
        userId: userId
      };
    } catch (error) {
      console.error(`Error getting shop info for shop ${shopId}:`, error);
      return null;
    }
  }
  
  /**
   * Mendapatkan daftar toko premium dari pengguna tertentu
   * 
   * @param userId - ID pengguna
   * @returns Array toko yang memiliki paket premium
   */
  static async getPremiumShops(userId: string): Promise<Shop[]> {
    try {
      const userSettings = await UserSettingsService.getUserSettings(userId);
      const isPremium = userSettings.subscription?.plan?.name === 'Admin';
      
      if (!isPremium) {
        return [];
      }
      
      return userSettings.shops;
    } catch (error) {
      console.error(`Error getting premium shops for ${userId}:`, error);
      return [];
    }
  }
} 