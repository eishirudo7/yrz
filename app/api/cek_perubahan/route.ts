import { db } from '@/db';
import { keluhan, perubahanPesanan } from '@/db/schema';
import { eq } from 'drizzle-orm';
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

        const userId = parseInt(user_id);

        // Cek keluhan
        const keluhanData = await db.select()
            .from(keluhan)
            .where(eq(keluhan.userid, userId));

        // Cek perubahan pesanan
        const perubahanData = await db.select()
            .from(perubahanPesanan)
            .where(eq(perubahanPesanan.userid, userId));

        return NextResponse.json({
            ada_keluhan: keluhanData.length > 0,
            jumlah_keluhan: keluhanData.length,
            keluhan_detail: keluhanData,
            ada_perubahan: perubahanData.length > 0,
            jumlah_perubahan: perubahanData.length,
            perubahan_detail: perubahanData,
        });

    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({
            error: 'Terjadi kesalahan saat memproses permintaan'
        }, { status: 500 });
    }
}
