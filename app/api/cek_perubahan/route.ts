import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';


export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const user_id = searchParams.get('user_id');

        if (!user_id) {
            return NextResponse.json({ 
                error: 'Parameter user_id diperlukan' 
            }, { status: 400 });
        }

        // Cek keluhan
        const { data: keluhan, error: keluhanError } = await supabase
            .from('keluhan')
            .select('*')
            .eq('user_id', parseInt(user_id));

        if (keluhanError) {
            throw new Error(`Error saat cek keluhan: ${keluhanError.message}`);
        }

        // Cek perubahan pesanan
        const { data: perubahan, error: perubahanError } = await supabase
            .from('perubahan_pesanan')
            .select('*')
            .eq('user_id', parseInt(user_id));

        if (perubahanError) {
            throw new Error(`Error saat cek perubahan: ${perubahanError.message}`);
        }

        return NextResponse.json({
            ada_keluhan: keluhan && keluhan.length > 0,
            jumlah_keluhan: keluhan ? keluhan.length : 0,
            keluhan_detail: keluhan && keluhan.length > 0 ? keluhan : [],
            ada_perubahan: perubahan && perubahan.length > 0,
            jumlah_perubahan: perubahan ? perubahan.length : 0,
            perubahan_detail: perubahan && perubahan.length > 0 ? perubahan : []
        });

    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ 
            error: 'Terjadi kesalahan saat memproses permintaan' 
        }, { status: 500 });
    }
}
