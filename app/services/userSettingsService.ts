import { redis } from '@/app/services/redis';
import { createClient } from '@/utils/supabase/server';

export interface Shop {
  shop_id: number;
  shop_name: string;
  status_chat: boolean;
  status_ship: boolean;
}

export interface Subscription {
  id: string;
  status: string;
  start_date: string;
  end_date: string;
  plan: {
    id: string;
    name: string;
    features: {
      feature_chat_ai: boolean;
      feature_flashsale: boolean;
      feature_bulk_actions: boolean;
    };
    max_shops: number;
  };
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
  in_cancel_msg?: string | null;
  in_cancel_status?: boolean;
  
  // Informasi langganan
  subscription?: Subscription;
  
  // Daftar toko pengguna
  shops: Shop[];
  
  // User ID
  user_id?: string;
}

export class UserSettingsService {
  private static getSettingsKey(userId: string): string {
    return `user_settings:${userId}`;
  }
  
  private static getShopToUserKey(shopId: number): string {
    return `shop_to_user:${shopId}`;
  }
  
  private static getShopTokenKey(shopId: number): string {
    return `shopee:token:${shopId}`;
  }
  
  /**
   * Mendapatkan pengaturan user dari Redis
   */
  static async getUserSettings(userId: string): Promise<UserSettings> {
    try {
      const data = await redis.get(this.getSettingsKey(userId));
      if (!data) {
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
   * Mendapatkan informasi toko dari Redis
   */
  static async getShopInfo(shopId: number): Promise<any> {
    try {
      const data = await redis.get(this.getShopTokenKey(shopId));
      if (!data) {
        return null;
      }
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error getting shop info for ${shopId}:`, error);
      return null;
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
      
      // Update shop_to_user mapping for each shop
      for (const shop of settings.shops) {
        if (shop.shop_id) {
          await redis.set(this.getShopToUserKey(shop.shop_id), userId);
        }
      }
      
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
   * Mendapatkan pengaturan toko berdasarkan shop_id dan user_id
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
   * Mendapatkan pengaturan toko hanya berdasarkan shop_id
   * Useful untuk webhook handlers yang tidak memiliki user_id
   */
  static async getShopSettingsByShopId(shopId: number): Promise<{shop: Shop | null, userId: string | null}> {
    try {
      // Dapatkan user_id dari shopId
      const userId = await this.getUserIdFromShopId(shopId);
      if (!userId) {
        return { shop: null, userId: null };
      }
      
      const shop = await this.getShopSettings(userId, shopId);
      return { shop, userId };
    } catch (error) {
      console.error(`Error getting shop settings for shop ${shopId}:`, error);
      return { shop: null, userId: null };
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
          status_ship: shopSettings.status_ship || false
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
   * Mendapatkan daftar toko premium dari pengguna tertentu
   */
  static async getPremiumShops(userId: string): Promise<Shop[]> {
    try {
      const settings = await this.getUserSettings(userId);
      const isPremium = settings.subscription?.plan?.name === 'Admin';
      
      if (!isPremium) {
        return [];
      }
      
      return settings.shops;
    } catch (error) {
      console.error(`Error getting premium shops for ${userId}:`, error);
      return [];
    }
  }
  
  /**
   * Mendapatkan userId berdasarkan shopId dari Redis atau database
   */
  static async getUserIdFromShopId(shopId: number): Promise<string | null> {
    try {
      // Coba dapatkan dari Redis terlebih dahulu
      const userId = await redis.get(this.getShopToUserKey(shopId));
      if (userId) return userId;
      
      // Jika tidak ada di Redis, cari di database
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('shopee_tokens')
        .select('user_id')
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .single();
      
      if (error || !data) {
        console.warn(`Tidak menemukan user_id untuk shop_id ${shopId}`);
        return null;
      }
      
      // Simpan ke Redis untuk digunakan selanjutnya
      await redis.set(this.getShopToUserKey(shopId), data.user_id);
      
      return data.user_id;
    } catch (error) {
      console.error('Error mendapatkan user_id dari shop_id:', error);
      return null;
    }
  }
  
  /**
   * Hapus data pengaturan dari Redis (untuk logout)
   */
  static async clearUserSettings(userId: string): Promise<boolean> {
    try {
      await redis.del(this.getSettingsKey(userId));
      return true;
    } catch (error) {
      console.error(`Error clearing user settings for ${userId}:`, error);
      return false;
    }
  }
}