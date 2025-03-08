import { supabase } from '@/lib/supabase';
import { SHOPEE_PARTNER_ID,shopeeApi } from '@/lib/shopeeConfig';
import { redis } from '@/app/services/redis';
import jsonStableStringify from 'json-stable-stringify';

export async function getTokens(code: string, shopId: number): Promise<{ tokens: any, shopName: string }> {
    try {
        const tokens = await shopeeApi.getTokens(code, shopId);
        const shopName = await getShopName(shopId, tokens.access_token);
        await saveTokens(shopId, tokens, shopName);
        return { tokens, shopName };
    } catch (error) {
        console.error('Gagal mendapatkan token:', error);
        throw new Error('Gagal mendapatkan token dari Shopee API');
    }
}

async function getShopName(shopId: number, accessToken: string): Promise<string> {
    try {
        const response = await shopeeApi.getShopInfo(shopId, accessToken);
        return response.shop_name || 'Nama Toko Tidak Tersedia';
    } catch (error) {
        console.error('Gagal mendapatkan nama toko:', error);
        return "Toko Tidak Dikenali";
    }
}

export async function saveTokens(shopId: number, tokens: any, shopName?: string): Promise<void> {
    try {
        // Ambil status is_active yang ada
        const { data: existingData } = await supabase
            .from('shopee_tokens')
            .select('is_active')
            .eq('shop_id', shopId)
            .single();

        const now = new Date();
        const data: any = {
            partner_id: SHOPEE_PARTNER_ID,
            shop_id: shopId,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            access_token_expiry: new Date(now.getTime() + tokens.expire_in * 1000).toISOString(),
            refresh_token_expiry: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            authorization_expiry: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            last_refresh_attempt: now.toISOString(),
            is_active: existingData ? existingData.is_active : true, // Gunakan status yang ada atau true jika baru
            updated_at: now.toISOString()
        };

        // Gunakan fungsi getShopName untuk mendapatkan nama toko
        if (!shopName) {
            shopName = await getShopName(shopId, tokens.access_token);
        }
        data.shop_name = shopName;

        const { error } = await supabase
            .from('shopee_tokens')
            .upsert(data, { onConflict: 'shop_id' });
            

        if (error) {
            console.error('Gagal menyimpan token ke database:', error);
            throw new Error('Gagal menyimpan token ke database');
        }

        // Simpan token ke Redis jika penyimpanan ke database berhasil
        await redis.hmset(`shopee:token:${shopId}`, Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, jsonStableStringify(v)])
        ));
        await redis.expire(`shopee:token:${shopId}`, 24 * 60 * 60); // Expire setelah 1 hari

    } catch (error) {
        console.error('Terjadi kesalahan saat menyimpan token:', error);
        throw new Error('Gagal menyimpan token');
    }
}

export async function refreshToken(shopId: number, refreshToken: string, shopName?: string): Promise<any> {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const newTokens = await shopeeApi.refreshAccessToken(refreshToken, shopId);
            
            await saveTokens(shopId, newTokens, shopName);
            
            return newTokens;

        } catch (error) {
            if (attempt === 3) throw error;
            await new Promise(resolve => setTimeout(resolve, 2000)); // Tunggu 2 detik sebelum mencoba lagi
        }
    }
}

export async function getValidAccessToken(shopId: number): Promise<string> {
    try {
        // Langsung gunakan Redis client
        const redisData = await redis.hgetall(`shopee:token:${shopId}`);
        
        if (redisData && redisData.access_token) {
            // Parse token karena tersimpan sebagai string JSON
            const accessToken = JSON.parse(redisData.access_token);
            return accessToken;
        }
        
        // Jika tidak ada di Redis, ambil dari database
        const { data, error } = await supabase
            .from('shopee_tokens')
            .select('access_token')
            .eq('shop_id', shopId)
            .single();
        
        if (error) throw error;
        
        if (data && data.access_token) {
            return data.access_token;
        }
        
        throw new Error('Token tidak ditemukan');
    } catch (error) {
        console.error('Gagal mendapatkan access token untuk toko', shopId, error);
        throw new Error(`Gagal mendapatkan access token untuk toko ${shopId}`);
    }
}
