/**
 * Database operations untuk keluhan dan perubahan_pesanan
 */
import { supabase } from '@/lib/supabase';

// ============================================================
// KELUHAN & PERUBAHAN PESANAN
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
