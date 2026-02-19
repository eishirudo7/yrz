/**
 * Shopee Service - Shop Operations
 */

import { supabase } from '@/lib/supabase';
import { shopeeApi } from '@/lib/shopeeConfig';
import { getValidAccessToken } from '@/app/services/tokenManager';
import { createClient } from '@/utils/supabase/server';

export async function getShopInfo(shopId: number): Promise<any> {
    try {
        if (!shopId) {
            throw new Error('ID Toko diperlukan');
        }

        const { data, error } = await supabase
            .from('shopee_tokens')
            .select('*')
            .eq('shop_id', shopId)
            .single();

        if (error) {
            console.error('Gagal mengambil informasi toko:', error);
            throw error;
        }

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

        const { data, error } = await supabase
            .from('shopee_tokens')
            .select('*')
            .eq('is_active', true)
            .eq('user_id', user.id);

        if (error) throw error;
        if (!data || data.length === 0) {
            return [];
        }

        return data;
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
        const redirectUrl = `https://yorozuya.me/api/callback`;
        const authUrl = shopeeApi.generateAuthUrl(redirectUrl);
        console.info(`URL otentikasi berhasil dibuat: ${authUrl}`);
        return authUrl;
    } catch (error) {
        console.error('Terjadi kesalahan saat membuat URL otentikasi:', error);
        throw new Error('Gagal membuat URL otentikasi');
    }
}

export function generateDeauthUrl(): string {
    const redirectUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/shops`;
    return shopeeApi.generateDeauthUrl(redirectUrl);
}

export async function getShopPerformance(shopId: number): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        const response = await shopeeApi.getShopPerformance(shopId, accessToken);

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
        const accessToken = await getValidAccessToken(shopId);
        const response = await shopeeApi.getShopPenalty(shopId, accessToken);

        if (response.error) {
            console.error(`Error saat mengambil penalti toko: ${JSON.stringify(response)}`);
            return {
                success: false,
                error: response.error,
                message: response.message || 'Gagal mengambil penalti toko',
                request_id: response.request_id
            };
        }

        return {
            success: true,
            data: response.response,
            request_id: response.request_id
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
        const accessToken = await getValidAccessToken(shopId);
        const response = await shopeeApi.getAdsDailyPerformance(shopId, accessToken, startDate, endDate);

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
        const accessToken = await getValidAccessToken(shopId);
        const currentConfig = await shopeeApi.getAppPushConfig();

        let blockedList = currentConfig.response?.blocked_shop_id_list || [];
        if (!blockedList.includes(shopId)) {
            blockedList.push(shopId);
        }

        const response = await shopeeApi.setAppPushConfig({
            blocked_shop_id_list: blockedList
        });

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
        const accessToken = await getValidAccessToken(shopId);
        const currentConfig = await shopeeApi.getAppPushConfig();

        let blockedList = currentConfig.response?.blocked_shop_id_list || [];
        blockedList = blockedList.filter((id: number) => id !== shopId);

        const response = await shopeeApi.setAppPushConfig({
            blocked_shop_id_list: blockedList
        });

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
