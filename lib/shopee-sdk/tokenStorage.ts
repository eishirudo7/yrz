/**
 * Supabase + Redis Token Storage Adapter
 * Implements the SDK's TokenStorage interface using existing Supabase + Redis infrastructure
 */

import type { TokenStorage } from '@congminh1254/shopee-sdk/storage/token-storage.interface';
import type { AccessToken } from '@congminh1254/shopee-sdk/schemas/access-token';
import { supabase } from '@/lib/supabase';
import { redis } from '@/app/services/redis';


const SHOPEE_PARTNER_ID = Number(process.env.SHOPEE_PARTNER_ID!);

export class SupabaseTokenStorage implements TokenStorage {
    private shopId: number;
    private userId?: string;
    private shopName?: string;

    constructor(shopId: number, options?: { userId?: string; shopName?: string }) {
        this.shopId = shopId;
        this.userId = options?.userId;
        this.shopName = options?.shopName;
    }

    /** Simpan token ke Supabase + Redis (format sama dengan tokenManager lama) */
    async store(token: AccessToken): Promise<void> {
        try {
            // Ambil status is_active yang ada
            const { data: existingData } = await supabase
                .from('shopee_tokens')
                .select('is_active, shop_name, user_id')
                .eq('shop_id', this.shopId)
                .single();

            const now = new Date();
            const expiredAt = token.expired_at
                ? new Date(token.expired_at)
                : new Date(now.getTime() + token.expire_in * 1000);

            const data: Record<string, any> = {
                partner_id: SHOPEE_PARTNER_ID,
                shop_id: this.shopId,
                access_token: token.access_token,
                refresh_token: token.refresh_token,
                access_token_expiry: expiredAt.toISOString(),
                refresh_token_expiry: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                authorization_expiry: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                last_refresh_attempt: now.toISOString(),
                is_active: existingData?.is_active ?? true,
                updated_at: now.toISOString(),
            };

            // Preserve existing user_id/shop_name, override if explicitly set
            if (this.userId) {
                data.user_id = this.userId;
            } else if (existingData?.user_id) {
                data.user_id = existingData.user_id;
            }

            if (this.shopName) {
                data.shop_name = this.shopName;
            } else if (existingData?.shop_name) {
                data.shop_name = existingData.shop_name;
            }

            const { error } = await supabase
                .from('shopee_tokens')
                .upsert(data, { onConflict: 'shop_id' });

            if (error) {
                console.error('Gagal menyimpan token ke database:', error);
                throw new Error('Gagal menyimpan token ke database');
            }

            // Simpan ke Redis (hanya access_token + expiry sebagai cache)
            await redis.hmset(`shopee:token:${this.shopId}`, {
                access_token: token.access_token,
                access_token_expiry: expiredAt.toISOString(),
            });
            await redis.expire(`shopee:token:${this.shopId}`, 24 * 60 * 60);

        } catch (error) {
            console.error('Terjadi kesalahan saat menyimpan token:', error);
            throw error;
        }
    }

    /** Ambil token dari Redis (cache), fallback ke Supabase */
    async get(): Promise<AccessToken | null> {
        try {
            // Coba Redis dulu
            const redisData = await redis.hgetall(`shopee:token:${this.shopId}`);

            if (redisData && redisData.access_token) {
                // Cek apakah data Redis masih valid (belum expired)
                const redisExpiry = redisData.access_token_expiry
                    ? new Date(redisData.access_token_expiry).getTime()
                    : 0;

                if (redisExpiry > Date.now()) {
                    // Redis cache valid — ambil refresh_token dari Supabase (source of truth)
                    const { data: dbData } = await supabase
                        .from('shopee_tokens')
                        .select('refresh_token')
                        .eq('shop_id', this.shopId)
                        .single();

                    return {
                        access_token: redisData.access_token,
                        refresh_token: dbData?.refresh_token || '',
                        expire_in: Math.floor((redisExpiry - Date.now()) / 1000),
                        expired_at: redisExpiry,
                        shop_id: this.shopId,
                        request_id: '',
                        error: '',
                        message: '',
                    };
                }

                // Redis data sudah stale/expired → hapus dan fallback ke Supabase
                console.log(`[TokenStorage] Redis data stale untuk shop ${this.shopId}, fallback ke Supabase`);
                await redis.del(`shopee:token:${this.shopId}`);
            }

            // Fallback ke Supabase (source of truth)
            const { data, error } = await supabase
                .from('shopee_tokens')
                .select('access_token, refresh_token, access_token_expiry')
                .eq('shop_id', this.shopId)
                .single();

            if (error || !data) {
                return null;
            }

            const expiredAt = data.access_token_expiry
                ? new Date(data.access_token_expiry).getTime()
                : undefined;

            return {
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                expire_in: expiredAt
                    ? Math.floor((expiredAt - Date.now()) / 1000)
                    : 14400,
                expired_at: expiredAt,
                shop_id: this.shopId,
                request_id: '',
                error: '',
                message: '',
            };
        } catch (error) {
            console.error(`Gagal mengambil token untuk shop ${this.shopId}:`, error);
            return null;
        }
    }

    /** Hapus token dari Redis dan Supabase */
    async clear(): Promise<void> {
        await redis.del(`shopee:token:${this.shopId}`);
        await supabase
            .from('shopee_tokens')
            .delete()
            .eq('shop_id', this.shopId);
    }
}
