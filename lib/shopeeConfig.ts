import { ShopeeAPI } from '@/lib/shopee';
import { getShopeeSDK } from '@/lib/shopee-sdk';

export const SHOPEE_PARTNER_ID = Number(process.env.SHOPEE_PARTNER_ID!);
export const SHOPEE_PARTNER_KEY = String(process.env.SHOPEE_PARTNER_KEY!);

// Legacy API instance — masih dipakai oleh service lain (orders, products, dll.)
export const shopeeApi = new ShopeeAPI(SHOPEE_PARTNER_ID, SHOPEE_PARTNER_KEY);

// SDK factory — dipakai untuk auth & token management (dan semua migrasi berikutnya)
export { getShopeeSDK };