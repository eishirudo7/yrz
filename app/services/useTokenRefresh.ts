import { redis } from '@/app/services/redis';
import { refreshToken } from '@/app/services/tokenManager';

import { supabase } from '@/lib/supabase';



export async function refreshAllTokens() {
  console.log("Memulai proses refresh token");

  try {
    const { data: shops, error } = await supabase
      .from('shopee_tokens')
      .select('shop_id, refresh_token, shop_name')

    if (error) {
      console.error('Error fetching tokens:', error);
      return;
    }

    console.log(`Berhasil mengambil ${shops.length} toko dari database`);

    let successCount = 0;
    let failCount = 0;

    for (const shop of shops) {
      try {
        const data = await refreshToken(shop.shop_id, shop.refresh_token, shop.shop_name);
        await redis.hset(`shopee:token:${shop.shop_id}`, 'access_token', JSON.stringify(data.access_token));
        await redis.expire(`shopee:token:${shop.shop_id}`, 24 * 60 * 60); // Expire setelah 1 hari
        console.log(`Berhasil me-refresh token untuk shop_id: ${shop.shop_id}, token baru: ${data.access_token}`);
        successCount++;
      } catch (refreshError) {
        console.error(`Gagal me-refresh token untuk shop_id ${shop.shop_id}:`, refreshError);
        failCount++;
      }
    }

    console.log(`Proses refresh selesai. Berhasil: ${successCount}, Gagal: ${failCount}`);

    if (failCount > 0) {
      console.warn(`Terdapat ${failCount} kegagalan dalam refresh token. Silakan periksa log.`);
    }
  } catch (error) {
    console.error('Gagal me-refresh token:', error);
  }
}

