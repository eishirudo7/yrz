import { NextRequest, NextResponse } from 'next/server';
import { uploadChatImage } from '@/app/services/shopeeService';

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
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { success: false, error: 'Tipe file tidak didukung. Gunakan JPG, PNG, atau GIF.' },
                { status: 400 }
            );
        }

        // Validasi ukuran (maks 10MB)
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json(
                { success: false, error: 'Ukuran file melebihi batas 10MB.' },
                { status: 400 }
            );
        }

        const result = await uploadChatImage(shopId, file);

        return NextResponse.json({
            success: true,
            url: result.url,
            thumbnail: result.thumbnail,
        });
    } catch (error) {
        console.error('[upload_image] Error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Gagal mengupload gambar' },
            { status: 500 }
        );
    }
}
