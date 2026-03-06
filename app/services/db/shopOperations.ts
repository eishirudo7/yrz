/**
 * Database operations untuk shopee_tokens dan items
 */
import { supabase } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

// ============================================================
// SHOP / TOKEN OPERATIONS
// ============================================================

export async function getShopInfoFromDB(shopId: number): Promise<any> {
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

export async function getAllShopsFromDB(): Promise<any[]> {
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
        if (!data || data.length === 0) return [];

        return data;
    } catch (error) {
        console.error('Gagal mengambil daftar toko:', error);
        throw new Error('Gagal mengambil daftar toko aktif dari database');
    }
}

export async function updateShopName(shopId: number, shopName: string): Promise<void> {
    await supabase
        .from('shopee_tokens')
        .update({ shop_name: shopName })
        .eq('shop_id', shopId);
}

export async function getShopNameFromDB(shopId: number): Promise<string | null> {
    try {
        const { data } = await supabase
            .from('shopee_tokens')
            .select('shop_name')
            .eq('shop_id', shopId)
            .single();

        return data?.shop_name || null;
    } catch (error) {
        console.error(`Error fetching shop name for ${shopId}:`, error);
        return null;
    }
}

export async function getUserIdByShopId(shopId: number): Promise<string | null> {
    try {
        const supabaseClient = await createClient();
        const { data, error } = await supabaseClient
            .from('shopee_tokens')
            .select('user_id')
            .eq('shop_id', shopId)
            .eq('is_active', true)
            .single();

        if (error || !data) {
            console.warn(`Tidak menemukan user_id untuk shop_id ${shopId}`);
            return null;
        }

        return data.user_id;
    } catch (error) {
        console.error('Error mendapatkan user_id dari shop_id:', error);
        return null;
    }
}

// ============================================================
// ITEMS OPERATIONS
// ============================================================

export async function getItemsBySku(itemIds: string[], shopId?: string | null): Promise<any[]> {
    try {
        let query = supabase
            .from('items')
            .select('item_id, item_sku, item_name, image')
            .in('item_id', itemIds);

        if (shopId) {
            query = query.eq('shop_id', shopId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Gagal mengambil data items:', error);
            throw error;
        }

        return data || [];
    } catch (error) {
        console.error('Error fetching items:', error);
        throw error;
    }
}
