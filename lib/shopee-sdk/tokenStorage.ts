/**
 * Drizzle + Redis Token Storage Adapter
 * Implements the SDK's TokenStorage interface using Drizzle ORM + Redis infrastructure
 */

import type { TokenStorage } from '@congminh1254/shopee-sdk/storage/token-storage.interface';
import type { AccessToken } from '@congminh1254/shopee-sdk/schemas/access-token';
import { db } from '@/db';
import { shopeeTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';
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

    /** Simpan token ke PostgreSQL + Redis */
    async store(token: AccessToken): Promise<void> {
        try {
            // Ambil status is_active yang ada
            const [existingData] = await db.select({
                isActive: shopeeTokens.isActive,
                shopName: shopeeTokens.shopName,
                userId: shopeeTokens.userId,
            })
                .from(shopeeTokens)
                .where(eq(shopeeTokens.shopId, this.shopId))
                .limit(1);

            const now = new Date();
            const expiredAt = token.expired_at
                ? new Date(token.expired_at)
                : new Date(now.getTime() + token.expire_in * 1000);

            // Determine userId and shopName
            const userId = this.userId || existingData?.userId || undefined;
            const shopName = this.shopName || existingData?.shopName || `Shop ${this.shopId}`;

            const data = {
                partnerId: SHOPEE_PARTNER_ID,
                shopId: this.shopId,
                shopName: shopName,
                accessToken: token.access_token,
                refreshToken: token.refresh_token,
                accessTokenExpiry: expiredAt,
                refreshTokenExpiry: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
                authorizationExpiry: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
                lastRefreshAttempt: now,
                isActive: existingData?.isActive ?? true,
                updatedAt: now,
                userId: userId || null,
            };

            await db.insert(shopeeTokens)
                .values(data)
                .onConflictDoUpdate({
                    target: shopeeTokens.shopId,
                    set: data,
                });

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

    /** Ambil token dari Redis (cache), fallback ke PostgreSQL */
    async get(): Promise<AccessToken | null> {
        try {
            // Coba Redis dulu
            const redisData = await redis.hgetall(`shopee:token:${this.shopId}`);

            if (redisData && redisData.access_token) {
                const redisExpiry = redisData.access_token_expiry
                    ? new Date(redisData.access_token_expiry).getTime()
                    : 0;

                if (redisExpiry > Date.now()) {
                    // Redis cache valid — ambil refresh_token dari DB (source of truth)
                    const [dbData] = await db.select({ refreshToken: shopeeTokens.refreshToken })
                        .from(shopeeTokens)
                        .where(eq(shopeeTokens.shopId, this.shopId))
                        .limit(1);

                    return {
                        access_token: redisData.access_token,
                        refresh_token: dbData?.refreshToken || '',
                        expire_in: Math.floor((redisExpiry - Date.now()) / 1000),
                        expired_at: redisExpiry,
                        shop_id: this.shopId,
                        request_id: '',
                        error: '',
                        message: '',
                    };
                }

                // Redis data sudah stale/expired → hapus dan fallback ke DB
                console.log(`[TokenStorage] Redis data stale untuk shop ${this.shopId}, fallback ke DB`);
                await redis.del(`shopee:token:${this.shopId}`);
            }

            // Fallback ke PostgreSQL (source of truth)
            const [data] = await db.select({
                accessToken: shopeeTokens.accessToken,
                refreshToken: shopeeTokens.refreshToken,
                accessTokenExpiry: shopeeTokens.accessTokenExpiry,
            })
                .from(shopeeTokens)
                .where(eq(shopeeTokens.shopId, this.shopId))
                .limit(1);

            if (!data) {
                return null;
            }

            const expiredAt = data.accessTokenExpiry
                ? new Date(data.accessTokenExpiry).getTime()
                : undefined;

            return {
                access_token: data.accessToken,
                refresh_token: data.refreshToken,
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

    /** Hapus token dari Redis dan PostgreSQL */
    async clear(): Promise<void> {
        await redis.del(`shopee:token:${this.shopId}`);
        await db.delete(shopeeTokens)
            .where(eq(shopeeTokens.shopId, this.shopId));
    }
}
