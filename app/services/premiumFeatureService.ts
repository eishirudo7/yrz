import { prosesOrder } from '@/app/services/prosesOrder';
import { withRetry } from '@/app/services/databaseOperations';
import { UserSettingsService, Shop } from '@/app/services/userSettingsService';

/**
 * Service untuk mengelola fitur-fitur premium dalam aplikasi
 * 
 * PremiumFeatureService bertanggung jawab untuk:
 * 1. Memverifikasi apakah pengguna memiliki paket premium
 * 2. Mengelola fitur auto-ship (hanya untuk pengguna premium)
 * 3. Mengelola fitur auto-chat (hanya untuk pengguna premium)
 */
export class PremiumFeatureService {
  /**
   * Memeriksa apakah toko memiliki paket premium
   * 
   * @param userId - ID pengguna pemilik toko
   * @param shopId - ID toko yang akan diperiksa
   * @returns Boolean yang menunjukkan apakah toko memiliki paket premium
   */
  static async isPremiumShop(userId: string, shopId: number): Promise<boolean> {
    try {
      const shop = await UserSettingsService.getShopSettings(userId, shopId);
      
      // Cek apakah shop memiliki premium_plan premium atau lebih tinggi
      return shop?.premium_plan === 'premium' || shop?.premium_plan === 'enterprise';
    } catch (error) {
      console.error('Error checking premium status:', error);
      return false;
    }
  }

  /**
   * Menangani auto-ship untuk toko premium
   * Hanya berjalan jika toko memiliki paket premium dan status_ship diaktifkan
   * 
   * @param userId - ID pengguna pemilik toko
   * @param shopId - ID toko
   * @param orderSn - Nomor pesanan
   * @returns Boolean yang menunjukkan keberhasilan proses
   */
  static async handleAutoShip(userId: string, shopId: number, orderSn: string): Promise<boolean> {
    try {
      // Verifikasi status premium
      const isPremium = await this.isPremiumShop(userId, shopId);
      if (!isPremium) {
        console.log(`Toko ${shopId} bukan premium user, auto-ship tidak dijalankan`);
        return false;
      }

      // Cek status auto-ship untuk toko
      const shop = await UserSettingsService.getShopSettings(userId, shopId);
      
      if (!shop) {
        return false;
      }
      
      if (shop.status_ship) {
        // Jalankan auto-ship untuk toko premium
        const result = await withRetry(
          () => prosesOrder(shopId, orderSn),
          3,
          2000
        );
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error handling auto-ship for shop ${shopId}:`, error);
      return false;
    }
  }

  /**
   * Menangani auto-chat untuk toko premium
   * Hanya berjalan jika toko memiliki paket premium dan status_chat diaktifkan
   * 
   * Mengirim pesan ke pembeli saat status pesanan IN_CANCEL
   * 
   * @param userId - ID pengguna pemilik toko
   * @param shopId - ID toko
   * @param orderSn - Nomor pesanan
   * @param buyerUserId - ID pengguna pembeli
   * @param buyerUsername - Nama pengguna pembeli
   * @returns Boolean yang menunjukkan keberhasilan proses
   */
  static async handleAutoChat(
    userId: string,
    shopId: number, 
    orderSn: string, 
    buyerUserId: string, 
    buyerUsername: string
  ): Promise<boolean> {
    try {
      // Verifikasi status premium
      const isPremium = await this.isPremiumShop(userId, shopId);
      if (!isPremium) {
        console.log(`Toko ${shopId} bukan premium user, auto-chat tidak dijalankan`);
        return false;
      }

      // Cek status auto-chat untuk toko
      const shop = await UserSettingsService.getShopSettings(userId, shopId);
      
      if (!shop) {
        return false;
      }
      
      if (shop.status_chat) {
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

        // Kirim pesan kedua dengan teks informasi
        const message = `Halo ${buyerUsername},\n\nMohon maaf, pesanan dengan nomor ${orderSn} sudah kami kemas, jika kakak ingin mengubah warna atau ukuran, silakan tulis permintaan kakak di sini.\n\nDitunggu ya kak responnya.`;
        console.log('Memulai pengiriman pesan kedua ke pembeli');
        const textResponse = await fetch(`${API_BASE_URL}/api/msg/send_message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            toId: buyerUserId,
            messageType: 'text',
            content: message,
            shopId: shopId
          })
        });

        if (!textResponse.ok) {
          throw new Error(`Gagal mengirim pesan teks ke pembeli ${buyerUsername}`);
        }

        console.log(`Pesan pembatalan berhasil dikirim ke pembeli untuk order ${orderSn}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error handling auto-chat for shop ${shopId}:`, error);
      return false;
    }
  }

  /**
   * Dapatkan informasi toko berdasarkan shopId dari pengguna tertentu
   * 
   * Method ini digunakan untuk mendapatkan data umum toko seperti nama
   * tanpa perlu mengecek status premium
   * 
   * @param userId - ID pengguna pemilik toko
   * @param shopId - ID toko
   * @returns Object dengan informasi toko atau null jika tidak ditemukan
   */
  static async getShopInfo(userId: string, shopId: number): Promise<{ shopName: string } | null> {
    try {
      const shop = await UserSettingsService.getShopSettings(userId, shopId);
      
      if (!shop) return null;
      
      return {
        shopName: shop.shop_name
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
    return UserSettingsService.getPremiumShops(userId);
  }
} 