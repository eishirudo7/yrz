/**
 * Database operations untuk keluhan dan perubahan_pesanan
 */
import { supabase } from '@/lib/supabase';

// ============================================================
// KELUHAN
// ============================================================

export async function fetchKeluhanByUserId(userId: number): Promise<any[]> {
    const { data, error } = await supabase
        .from('keluhan')
        .select('*')
        .eq('userid', userId);

    if (error) {
        throw new Error(`Error saat cek keluhan: ${error.message}`);
    }

    return data || [];
}

export async function fetchKeluhanByShopIds(shopIds: string[]): Promise<any[]> {
    const { data, error } = await supabase
        .from('keluhan')
        .select('*')
        .in('shop_id', shopIds)
        .order('create_at', { ascending: false })
        .limit(20);

    if (error) throw new Error(`Error fetching keluhan: ${error.message}`);
    return data || [];
}

export async function updateKeluhanStatus(id: number, statusKeluhan: string): Promise<void> {
    const { error } = await supabase
        .from('keluhan')
        .update({ status_keluhan: statusKeluhan })
        .eq('id', id);

    if (error) throw new Error(`Error updating keluhan: ${error.message}`);
}

export async function deleteKeluhan(id: number): Promise<void> {
    const { error } = await supabase
        .from('keluhan')
        .delete()
        .eq('id', id);

    if (error) throw new Error(`Error deleting keluhan: ${error.message}`);
}

// ============================================================
// PERUBAHAN PESANAN
// ============================================================

export async function fetchPerubahanPesananByUserId(userId: number): Promise<any[]> {
    const { data, error } = await supabase
        .from('perubahan_pesanan')
        .select('*')
        .eq('userid', userId);

    if (error) {
        throw new Error(`Error saat cek perubahan: ${error.message}`);
    }

    return data || [];
}

export async function fetchPerubahanPesananByShopIds(
    shopIds: string[],
    options: { page?: number; size?: number; status?: string } = {}
): Promise<{ data: any[]; total: number }> {
    const { page = 1, size = 21, status = 'semua' } = options;
    const offset = (page - 1) * size;

    let query = supabase
        .from('perubahan_pesanan')
        .select('*', { count: 'exact' })
        .in('shop_id', shopIds);

    if (status !== 'semua') {
        query = query.eq('status', status);
    }

    const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + size - 1);

    if (error) throw new Error(`Error fetching perubahan pesanan: ${error.message}`);
    return { data: data || [], total: count || 0 };
}

export async function updatePerubahanPesananStatus(id: number, status: string): Promise<void> {
    const { error } = await supabase
        .from('perubahan_pesanan')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) throw new Error(`Error updating perubahan pesanan: ${error.message}`);
}

export async function deletePerubahanPesanan(id: number): Promise<void> {
    const { error } = await supabase
        .from('perubahan_pesanan')
        .delete()
        .eq('id', id);

    if (error) throw new Error(`Error deleting perubahan pesanan: ${error.message}`);
}
