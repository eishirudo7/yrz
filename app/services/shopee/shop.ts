/**
 * Shopee Service - Shop Operations
 * Migrated to use @congminh1254/shopee-sdk
 */

import { db } from '@/db';
import { shopeeTokens } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { shopeeApi } from '@/lib/shopeeConfig';
import { getValidAccessToken } from '@/app/services/tokenManager';
import { createClient } from '@/utils/supabase/server';
import { getShopeeSDK } from '@/lib/shopee-sdk';

export async function getShopInfo(shopId: number): Promise<any> {
    try {
        if (!shopId) {
            throw new Error('ID Toko diperlukan');
        }

        const [data] = await db.select({
            id: shopeeTokens.id,
            shop_id: shopeeTokens.shopId,
            shop_name: shopeeTokens.shopName,
            partner_id: shopeeTokens.partnerId,
            access_token: shopeeTokens.accessToken,
            refresh_token: shopeeTokens.refreshToken,
            refresh_count: shopeeTokens.refreshCount,
            is_active: shopeeTokens.isActive,
            user_id: shopeeTokens.userId,
            created_at: shopeeTokens.createdAt,
            updated_at: shopeeTokens.updatedAt
        })
            .from(shopeeTokens)
            .where(eq(shopeeTokens.shopId, shopId))
            .limit(1);

        if (!data) {
            throw new Error('Toko tidak ditemukan');
        }

        return data;
    } catch (error) {
        console.error('Gagal mendapatkan informasi toko:', error);
        throw new Error('Gagal mengambil informasi toko dari database');
    }
}

export async function getAllShops(): Promise<any[]> {
    try {
        const supabaseServer = await createClient();
        const { data: { user }, error: userError } = await supabaseServer.auth.getUser();

        if (userError || !user) {
            console.warn('Tidak ada user yang terautentikasi');
            return [];
        }

        const data = await db.select({
            id: shopeeTokens.id,
            shop_id: shopeeTokens.shopId,
            shop_name: shopeeTokens.shopName,
            partner_id: shopeeTokens.partnerId,
            access_token: shopeeTokens.accessToken,
            refresh_token: shopeeTokens.refreshToken,
            is_active: shopeeTokens.isActive,
            user_id: shopeeTokens.userId,
            created_at: shopeeTokens.createdAt,
            updated_at: shopeeTokens.updatedAt
        })
            .from(shopeeTokens)
            .where(and(
                eq(shopeeTokens.isActive, true),
                eq(shopeeTokens.userId, user.id),
            ));

        return data || [];
    } catch (error) {
        console.error('Gagal mengambil daftar toko:', error);
        throw new Error('Gagal mengambil daftar toko aktif dari database');
    }
}

export async function getRefreshCount(shopId: number): Promise<number> {
    try {
        const shopInfo = await getShopInfo(shopId);
        return shopInfo?.refresh_count || 0;
    } catch (error) {
        console.error('Gagal mendapatkan jumlah refresh:', error);
        return 0;
    }
}

export function generateAuthUrl(): string {
    try {
        const sdk = getShopeeSDK();
        const redirectUrl = `https://zavena.net/api/callback`;
        const authUrl = sdk.getAuthorizationUrl(redirectUrl);
        console.info(`URL otentikasi berhasil dibuat: ${authUrl}`);
        return authUrl;
    } catch (error) {
        console.error('Terjadi kesalahan saat membuat URL otentikasi:', error);
        throw new Error('Gagal membuat URL otentikasi');
    }
}

export function generateDeauthUrl(): string {
    // SDK belum support deauth URL — tetap pakai legacy method
    const redirectUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/shops`;
    return shopeeApi.generateDeauthUrl(redirectUrl);
}

export async function getShopPerformance(shopId: number): Promise<any> {
    try {
        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);
        const response: any = await sdk.accountHealth.getShopPerformance();

        if (response.error) {
            console.error(`Error saat mengambil performa toko: ${JSON.stringify(response)}`);
            return {
                success: false,
                error: response.error,
                message: response.message || 'Gagal mengambil performa toko',
                request_id: response.request_id
            };
        }

        return {
            success: true,
            data: response.response,
            request_id: response.request_id
        };
    } catch (error) {
        console.error('Gagal mengambil performa toko:', error);
        return {
            success: false,
            error: "fetch_failed",
            message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
        };
    }
}

export async function getShopPenalty(shopId: number): Promise<any> {
    try {
        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);

        // Use new APIs: getPenaltyPointHistory + getPunishmentHistory
        const [penaltyHistory, punishmentHistory] = await Promise.all([
            sdk.accountHealth.getPenaltyPointHistory({ page_size: 100 }),
            sdk.accountHealth.getPunishmentHistory({ punishment_status: 1, page_size: 50 })
        ]);

        // Aggregate penalty points by violation type
        const penaltyList = penaltyHistory.response?.penalty_point_list || [];
        const totalPoints = penaltyList.reduce((sum: number, r: any) => sum + (r.latest_point_num || 0), 0);

        // Map ongoing punishments to match old format
        const punishmentList = punishmentHistory.response?.punishment_list || [];
        const ongoingPunishment = punishmentList.map((p: any) => ({
            punishment_name: `type_${p.punishment_type}`,
            punishment_tier: p.reason || 0,
            days_left: Math.max(0, Math.ceil((p.end_time - Date.now() / 1000) / 86400))
        }));

        return {
            success: true,
            data: {
                penalty_points: {
                    overall_penalty_points: totalPoints,
                    non_fulfillment_rate: 0,
                    late_shipment_rate: 0,
                    listing_violations: 0,
                    opfr_violations: 0,
                    others: 0
                },
                ongoing_punishment: ongoingPunishment
            }
        };
    } catch (error) {
        console.error('Gagal mengambil penalti toko:', error);
        return {
            success: false,
            error: "fetch_failed",
            message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
        };
    }
}

export async function getAdsDailyPerformance(shopId: number, startDate: string, endDate: string): Promise<any> {
    try {
        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);
        const response: any = await sdk.ads.getAllCpcAdsDailyPerformance({
            start_date: startDate,
            end_date: endDate,
        } as any);

        if (response.error) {
            console.error(`Error saat mendapatkan data performa iklan harian: ${JSON.stringify(response)}`);
            return response;
        }

        return response.response;
    } catch (error) {
        console.error(`Terjadi kesalahan saat mengambil data performa iklan harian: ${error}`);
        return {
            error: "internal_server_error",
            message: `Terjadi kesalahan internal: ${error}`,
            request_id: ''
        };
    }
}

export async function blockShopWebhook(shopId: number): Promise<any> {
    try {
        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK();
        const currentConfig: any = await sdk.push.getAppPushConfig();

        let blockedList = currentConfig.blocked_shop_id_list || [];
        if (!blockedList.includes(shopId)) {
            blockedList.push(shopId);
        }

        const response: any = await sdk.push.setAppPushConfig({
            blocked_shop_id_list: blockedList
        } as any);

        if (response.error) {
            return {
                success: false,
                error: response.error,
                message: response.message || 'Gagal memblokir webhook toko'
            };
        }

        return {
            success: true,
            message: `Webhook untuk toko ${shopId} berhasil diblokir`
        };
    } catch (error) {
        console.error('Error blocking shop webhook:', error);
        return {
            success: false,
            error: "internal_error",
            message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
        };
    }
}

export async function unblockShopWebhook(shopId: number): Promise<any> {
    try {
        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK();
        const currentConfig: any = await sdk.push.getAppPushConfig();

        let blockedList = currentConfig.blocked_shop_id_list || [];
        blockedList = blockedList.filter((id: number) => id !== shopId);

        const response: any = await sdk.push.setAppPushConfig({
            blocked_shop_id_list: blockedList
        } as any);

        if (response.error) {
            return {
                success: false,
                error: response.error,
                message: response.message || 'Gagal membuka blokir webhook toko'
            };
        }

        return {
            success: true,
            message: `Webhook untuk toko ${shopId} berhasil dibuka blokirnya`
        };
    } catch (error) {
        console.error('Error unblocking shop webhook:', error);
        return {
            success: false,
            error: "internal_error",
            message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
        };
    }
}
