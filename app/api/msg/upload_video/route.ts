import { NextRequest, NextResponse } from 'next/server';
import { uploadChatVideo } from '@/app/services/shopeeService';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const shopId = parseInt(formData.get('shopId') as string || '', 10);

        if (!file) {
            return NextResponse.json({ success: false, error: 'File tidak ditemukan' }, { status: 400 });
        }

        if (!shopId || isNaN(shopId)) {
            return NextResponse.json({ success: false, error: 'shopId tidak valid' }, { status: 400 });
        }

        // Validasi tipe file
        const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-m4v'];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { success: false, error: 'Tipe file tidak didukung. Gunakan MP4/MOV.' },
                { status: 400 }
            );
        }

        // Validasi ukuran (maks 30MB)
        if (file.size > 30 * 1024 * 1024) {
            return NextResponse.json(
                { success: false, error: 'Ukuran file video melebihi batas 30MB.' },
                { status: 400 }
            );
        }

        const result = await uploadChatVideo(shopId, file);

        return NextResponse.json({
            success: true,
            vid: result.vid,
        });
    } catch (error) {
        console.error('[upload_video] Error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Gagal mengupload video' },
            { status: 500 }
        );
    }
}
