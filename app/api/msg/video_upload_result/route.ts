import { NextRequest, NextResponse } from 'next/server';
import { getChatVideoUploadResult } from '@/app/services/shopeeService';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const vid = searchParams.get('vid');
        const shopId = searchParams.get('shopId');

        if (!vid) {
            return NextResponse.json({ success: false, error: 'vid tidak ditemukan' }, { status: 400 });
        }

        if (!shopId || isNaN(parseInt(shopId, 10))) {
            return NextResponse.json({ success: false, error: 'shopId tidak valid' }, { status: 400 });
        }

        const result = await getChatVideoUploadResult(parseInt(shopId, 10), vid);

        return NextResponse.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('[video_upload_result] Error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Gagal mendapatkan status upload video' },
            { status: 500 }
        );
    }
}
