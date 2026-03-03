/**
 * Token Manager — migrated to use @congminh1254/shopee-sdk
 * 
 * Changes from legacy:
 * - Uses SDK's authenticateWithCode() and refreshToken() instead of manual API calls
 * - Token storage is handled by SupabaseTokenStorage (same Supabase+Redis backend)
 * - getValidAccessToken() now auto-refreshes expired tokens (no more cron dependency)
 */

import { getShopeeSDK } from '@/lib/shopee-sdk';
import { SupabaseTokenStorage } from '@/lib/shopee-sdk/tokenStorage';
import { db } from '@/db';
import { shopeeTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Get initial tokens using authorization code (OAuth callback)
 */
export async function getTokens(code: string, shopId: number, userId?: string): Promise<{ tokens: any; shopName: string }> {
    try {
        // Create SDK with userId so SupabaseTokenStorage saves it
        const sdk = getShopeeSDK(shopId, { userId });

        // SDK handles: getAccessToken → store in SupabaseTokenStorage
        const token = await sdk.authenticateWithCode(code, shopId);

        if (!token) {
            throw new Error('Gagal mendapatkan token dari Shopee API');
        }

        // Fetch shop name via SDK (token is already stored at this point)
        let shopName = 'Nama Toko Tidak Tersedia';
        try {
            const shopInfo: any = await sdk.shop.getShopInfo();
            shopName = shopInfo?.shop_name || 'Nama Toko Tidak Tersedia';
        } catch {
            console.error('Gagal mendapatkan nama toko');
        }

        // Update shop_name in database (SupabaseTokenStorage.store already saved the token)
        await db.update(shopeeTokens)
            .set({ shopName: shopName })
            .where(eq(shopeeTokens.shopId, shopId));

        return { tokens: token, shopName };
    } catch (error) {
        console.error('Gagal mendapatkan token:', error);
        throw new Error('Gagal mendapatkan token dari Shopee API');
    }
}

/**
 * Refresh access token for a shop
 */
export async function refreshToken(shopId: number, refreshTokenValue?: string, shopName?: string, userId?: string): Promise<any> {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const sdk = getShopeeSDK(shopId, { userId, shopName });

            // SDK handles: get old token → refresh → store new token
            const newToken = await sdk.refreshToken(shopId);

            if (!newToken) {
                throw new Error('Gagal me-refresh token');
            }

            return newToken;
        } catch (error) {
            if (attempt === 3) throw error;
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

/**
 * Get a valid access token, auto-refreshing if expired or about to expire
 * 
 * This replaces the old cron-based refresh approach:
 * - Checks token expiry with 5-minute buffer
 * - Auto-refreshes if needed
 * - Returns a valid access_token string
 */
export async function getValidAccessToken(shopId: number): Promise<string> {
    try {
        const sdk = getShopeeSDK(shopId);
        const token = await sdk.getAuthToken();

        if (!token) {
            throw new Error('Token tidak ditemukan');
        }

        // Check if token is expired or about to expire (within 5 minutes)
        const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 menit
        const now = Date.now();

        if (token.expired_at && now >= token.expired_at - EXPIRY_BUFFER_MS) {
            console.log(`Token untuk shop ${shopId} hampir/sudah expired, auto-refresh...`);

            const newToken = await sdk.refreshToken(shopId);
            if (newToken) {
                return newToken.access_token;
            }

            // If refresh failed but old token not yet fully expired, use it
            if (now < token.expired_at) {
                return token.access_token;
            }

            throw new Error('Gagal me-refresh token yang sudah expired');
        }

        return token.access_token;
    } catch (error) {
        console.error('Gagal mendapatkan access token untuk toko', shopId, error);
        throw new Error(`Gagal mendapatkan access token untuk toko ${shopId}`);
    }
}
