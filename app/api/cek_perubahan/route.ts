import { NextResponse } from 'next/server';
import { fetchKeluhanByUserId, fetchPerubahanPesananByUserId } from '@/app/services/databaseOperations';


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

        const [keluhan, perubahan] = await Promise.all([
            fetchKeluhanByUserId(userId),
            fetchPerubahanPesananByUserId(userId)
        ]);

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
