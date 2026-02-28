import { getShopeeSDK } from '@/lib/shopee-sdk';
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
          const sdk = getShopeeSDK(shop.shop_id, {
            userId: shop.user_id,
            shopName: shop.shop_name,
          });

          // SDK handles: get old token → refresh → store new token (via SupabaseTokenStorage)
          const newToken = await sdk.refreshToken(shop.shop_id);

          if (!newToken) {
            throw new Error('Token refresh returned null');
          }
          // Redis is automatically updated by SupabaseTokenStorage.store() inside sdk.refreshToken()

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
