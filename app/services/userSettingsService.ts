import { redis } from '@/app/services/redis';

export interface Shop {
  shop_id: number;
  shop_name: string;
  status_chat: boolean;
  status_ship: boolean;
  premium_plan: string; // 'free', 'basic', 'premium', 'enterprise'
}

export interface UserSettings {
  // Pengaturan OpenAI
  openai_api?: string;
  openai_model?: string;
  openai_temperature?: number;
  openai_prompt?: string;
  
  // Pengaturan Auto Ship
  auto_ship?: boolean;
  auto_ship_interval?: number;
  
  // Daftar toko pengguna
  shops: Shop[];
}

export class UserSettingsService {
  private static getSettingsKey(userId: string): string {
    return `user_settings:${userId}`;
  }
  
  /**
   * Mendapatkan pengaturan user dari Redis
   */
  static async getUserSettings(userId: string): Promise<UserSettings> {
    try {
      const data = await redis.get(this.getSettingsKey(userId));
      if (!data) {
        // Jika tidak ada data, kembalikan objek kosong
        return {
          shops: []
        };
      }
      
      const parsedData = JSON.parse(data) as UserSettings;
      
      // Pastikan shops selalu ada
      if (!parsedData.shops) {
        parsedData.shops = [];
      }
      
      return parsedData;
    } catch (error) {
      console.error(`Error getting user settings for ${userId}:`, error);
      return {
        shops: []
      };
    }
  }
  
  /**
   * Menyimpan pengaturan user ke Redis
   */
  static async saveUserSettings(userId: string, settings: UserSettings): Promise<boolean> {
    try {
      // Pastikan shops selalu ada
      if (!settings.shops) {
        settings.shops = [];
      }
      
      await redis.set(this.getSettingsKey(userId), JSON.stringify(settings));
      return true;
    } catch (error) {
      console.error(`Error saving user settings for ${userId}:`, error);
      return false;
    }
  }
  
  /**
   * Update sebagian pengaturan user
   */
  static async updateUserSettings(userId: string, partialSettings: Partial<UserSettings>): Promise<boolean> {
    try {
      const currentSettings = await this.getUserSettings(userId);
      const updatedSettings = { ...currentSettings, ...partialSettings };
      return await this.saveUserSettings(userId, updatedSettings);
    } catch (error) {
      console.error(`Error updating user settings for ${userId}:`, error);
      return false;
    }
  }
  
  /**
   * Mendapatkan pengaturan toko berdasarkan shop_id
   */
  static async getShopSettings(userId: string, shopId: number): Promise<Shop | null> {
    try {
      const settings = await this.getUserSettings(userId);
      return settings.shops.find(shop => shop.shop_id === shopId) || null;
    } catch (error) {
      console.error(`Error getting shop settings for shop ${shopId}:`, error);
      return null;
    }
  }
  
  /**
   * Mengupdate pengaturan untuk satu toko
   */
  static async updateShopSettings(userId: string, shopId: number, shopSettings: Partial<Shop>): Promise<boolean> {
    try {
      const settings = await this.getUserSettings(userId);
      const shopIndex = settings.shops.findIndex(shop => shop.shop_id === shopId);
      
      if (shopIndex === -1) {
        // Toko belum ada, tambahkan sebagai toko baru
        settings.shops.push({
          shop_id: shopId,
          shop_name: shopSettings.shop_name || `Toko ${shopId}`,
          status_chat: shopSettings.status_chat || false,
          status_ship: shopSettings.status_ship || false,
          premium_plan: shopSettings.premium_plan || 'free'
        });
      } else {
        // Update toko yang sudah ada
        settings.shops[shopIndex] = {
          ...settings.shops[shopIndex],
          ...shopSettings
        };
      }
      
      return await this.saveUserSettings(userId, settings);
    } catch (error) {
      console.error(`Error updating shop settings for shop ${shopId}:`, error);
      return false;
    }
  }
  
  /**
   * Mendapatkan daftar toko berdasarkan status premium 
   */
  static async getPremiumShops(userId: string): Promise<Shop[]> {
    try {
      const settings = await this.getUserSettings(userId);
      return settings.shops.filter(
        shop => shop.premium_plan === 'premium' || shop.premium_plan === 'enterprise'
      );
    } catch (error) {
      console.error(`Error getting premium shops for ${userId}:`, error);
      return [];
    }
  }
  
  /**
   * Migrasi dari format lama (auto_ship) ke format baru
   * Hanya untuk keperluan migrasi satu kali
   */
  static async migrateFromOldFormat(userId: string): Promise<boolean> {
    try {
      // Ambil data dari format lama
      const oldAutoShipData = await redis.get('auto_ship');
      const oldSettingsData = await redis.get('settings');
      
      if (!oldAutoShipData && !oldSettingsData) {
        return false; // Tidak ada data untuk dimigrasi
      }
      
      // Inisialisasi objek pengaturan baru
      const newSettings: UserSettings = {
        shops: []
      };
      
      // Migrasi pengaturan umum
      if (oldSettingsData) {
        const oldSettings = JSON.parse(oldSettingsData);
        
        if (Array.isArray(oldSettings)) {
          const settingsObj = oldSettings[0];
          
          newSettings.openai_api = settingsObj.openai_api;
          newSettings.openai_model = settingsObj.openai_model;
          newSettings.openai_temperature = settingsObj.openai_temperature;
          newSettings.openai_prompt = settingsObj.openai_prompt;
          newSettings.auto_ship = settingsObj.auto_ship;
          newSettings.auto_ship_interval = settingsObj.auto_ship_interval;
        } else {
          newSettings.openai_api = oldSettings.openai_api;
          newSettings.openai_model = oldSettings.openai_model;
          newSettings.openai_temperature = oldSettings.openai_temperature;
          newSettings.openai_prompt = oldSettings.openai_prompt;
          newSettings.auto_ship = oldSettings.auto_ship;
          newSettings.auto_ship_interval = oldSettings.auto_ship_interval;
        }
      }
      
      // Migrasi data toko
      if (oldAutoShipData) {
        const oldShops = JSON.parse(oldAutoShipData);
        
        if (Array.isArray(oldShops)) {
          newSettings.shops = oldShops.map((shop: any) => ({
            shop_id: shop.shop_id,
            shop_name: shop.shop_name,
            status_chat: shop.status_chat || false,
            status_ship: shop.status_ship || false,
            premium_plan: shop.premium_plan || 'free'
          }));
        }
      }
      
      // Simpan ke format baru
      await this.saveUserSettings(userId, newSettings);
      return true;
    } catch (error) {
      console.error(`Error migrating settings for ${userId}:`, error);
      return false;
    }
  }
} 