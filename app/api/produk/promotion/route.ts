import { NextRequest, NextResponse } from 'next/server';
import { getItemPromotion } from '@/app/services/shopeeService';

export async function GET(request: NextRequest) {
    try {
        // Dapatkan parameter dari query string
        const searchParams = request.nextUrl.searchParams;
        const shopId = searchParams.get('shop_id');
        const itemIds = searchParams.get('item_ids');

        // Validasi parameter yang diperlukan
        if (!shopId || !itemIds) {
            return NextResponse.json(
                { error: 'bad_request', message: 'Parameter shop_id dan item_ids diperlukan' },
                { status: 400 }
            );
        }

        // Konversi dan validasi shop_id
        const shopIdNum = parseInt(shopId);
        if (isNaN(shopIdNum) || shopIdNum <= 0) {
            return NextResponse.json(
                { error: 'bad_request', message: 'Format shop_id tidak valid' },
                { status: 400 }
            );
        }

        // Konversi dan validasi item_ids
        const itemIdList = itemIds.split(',').map(id => parseInt(id.trim()));
        if (itemIdList.some(id => isNaN(id) || id <= 0)) {
            return NextResponse.json(
                { error: 'bad_request', message: 'Format item_ids tidak valid' },
                { status: 400 }
            );
        }

        const result = await getItemPromotion(shopIdNum, itemIdList);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error, message: result.message },
                { status: 400 }
            );
        }

        return NextResponse.json(result);

    } catch (error) {
        console.error('Kesalahan saat mengambil informasi promosi:', error);
        return NextResponse.json(
            { 
                error: 'internal_server_error', 
                message: error instanceof Error ? error.message : 'Terjadi kesalahan internal server' 
            },
            { status: 500 }
        );
    }
} 