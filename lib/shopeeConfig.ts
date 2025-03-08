import { ShopeeAPI } from '@/lib/shopeeApi';

export const SHOPEE_PARTNER_ID = Number(process.env.SHOPEE_PARTNER_ID!);
export const SHOPEE_PARTNER_KEY = String(process.env.SHOPEE_PARTNER_KEY!);
export const shopeeApi = new ShopeeAPI(SHOPEE_PARTNER_ID, SHOPEE_PARTNER_KEY);