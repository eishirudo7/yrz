/**
 * Shopee SDK Factory
 * Creates and caches ShopeeSDK instances per shop
 */

import { ShopeeSDK } from '@congminh1254/shopee-sdk';
import { SupabaseTokenStorage } from './tokenStorage';

const SHOPEE_PARTNER_ID = Number(process.env.SHOPEE_PARTNER_ID!);
const SHOPEE_PARTNER_KEY = String(process.env.SHOPEE_PARTNER_KEY!);

// Cache SDK instances per shopId
const sdkCache = new Map<number | 'global', ShopeeSDK>();

/**
 * Get a ShopeeSDK instance for a specific shop
 * Instances are cached per shopId to avoid re-creation
 * 
 * @param shopId - Shop ID (optional, creates a global instance if not provided)
 * @param options - Additional options for token storage
 */
export function getShopeeSDK(
    shopId?: number,
    options?: { userId?: string; shopName?: string }
): ShopeeSDK {
    const cacheKey = shopId ?? 'global';

    // If options are provided (userId/shopName), always create a fresh instance
    // so the SupabaseTokenStorage gets the correct metadata
    if (!options) {
        const cached = sdkCache.get(cacheKey);
        if (cached) return cached;
    }

    const tokenStorage = shopId
        ? new SupabaseTokenStorage(shopId, options)
        : undefined;

    const sdk = new ShopeeSDK(
        {
            partner_id: SHOPEE_PARTNER_ID,
            partner_key: SHOPEE_PARTNER_KEY,
            shop_id: shopId,
        },
        tokenStorage
    );

    // Only cache instances without special options
    if (!options) {
        sdkCache.set(cacheKey, sdk);
    }

    return sdk;
}

/**
 * Clear all cached SDK instances
 * Useful when config changes or for testing
 */
export function clearSDKCache(): void {
    sdkCache.clear();
}

// Re-export types for convenience
export type { AccessToken } from '@congminh1254/shopee-sdk/schemas/access-token';
export { SupabaseTokenStorage } from './tokenStorage';
