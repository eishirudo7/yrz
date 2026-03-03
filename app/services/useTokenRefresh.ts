import { getShopeeSDK } from '@/lib/shopee-sdk';
import { db } from '@/db';
import { shopeeTokens } from '@/db/schema';

export async function refreshAllTokens() {
  console.log("Memulai proses refresh token");

  try {
    const shops = await db.select({
      shopId: shopeeTokens.shopId,
      refreshToken: shopeeTokens.refreshToken,
      shopName: shopeeTokens.shopName,
      userId: shopeeTokens.userId,
    }).from(shopeeTokens);

    console.log(`Berhasil mengambil ${shops.length} toko dari database`);

    // Proses secara parallel dengan Promise.all
    const results = await Promise.all(
      shops.map(async (shop) => {
        try {
          const sdk = getShopeeSDK(shop.shopId, {
            userId: shop.userId || undefined,
            shopName: shop.shopName,
          });

          // SDK handles: get old token → refresh → store new token (via SupabaseTokenStorage)
          const newToken = await sdk.refreshToken(shop.shopId);

          if (!newToken) {
            throw new Error('Token refresh returned null');
          }
          // Redis is automatically updated by SupabaseTokenStorage.store() inside sdk.refreshToken()

          console.log(`Berhasil me-refresh token untuk shop_id: ${shop.shopId}`);
          return { success: true, shop_id: shop.shopId };
        } catch (error) {
          console.error(`Gagal me-refresh token untuk shop_id ${shop.shopId}:`, error);
          return { success: false, shop_id: shop.shopId };
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
