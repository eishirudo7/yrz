import { redis } from '@/app/services/redis';
import { refreshToken } from '@/app/services/tokenManager';

import { supabase } from '@/lib/supabase';



export async function refreshAllTokens() {
  console.log("Memulai proses refresh token");

  try {
    const { data: shops, error } = await supabase
      .from('shopee_tokens')
      .select('shop_id, refresh_token, shop_name, user_id');

    if (error) {
      console.error('Error fetching tokens:', error);
      return;
    }

    console.log(`Berhasil mengambil ${shops.length} toko dari database`);

    // Proses secara parallel dengan Promise.all
    const results = await Promise.all(
      shops.map(async (shop) => {
        try {
          const data = await refreshToken(shop.shop_id, shop.refresh_token, shop.shop_name, shop.user_id);
          await redis.hset(`shopee:token:${shop.shop_id}`, 'access_token', JSON.stringify(data.access_token));
          await redis.expire(`shopee:token:${shop.shop_id}`, 24 * 60 * 60);
          console.log(`Berhasil me-refresh token untuk shop_id: ${shop.shop_id}`);
          return { success: true, shop_id: shop.shop_id };
        } catch (error) {
          console.error(`Gagal me-refresh token untuk shop_id ${shop.shop_id}:`, error);
          return { success: false, shop_id: shop.shop_id };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Proses refresh selesai. Berhasil: ${successCount}, Gagal: ${failCount}`);

    if (failCount > 0) {
      console.warn(`Terdapat ${failCount} kegagalan dalam refresh token. Silakan periksa log.`);
    }
  } catch (error) {
    console.error('Gagal me-refresh token:', error);
  }
}
