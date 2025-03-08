import { NextRequest, NextResponse } from 'next/server';
import { getShopPerformance, getShopPenalty } from '@/app/services/shopeeService';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const shopId = parseInt(searchParams.get('shop_id') || '');

        if (!shopId) {
            return NextResponse.json(
                { 
                    error: 'invalid_parameter',
                    message: 'Parameter shop_id diperlukan' 
                },
                { status: 400 }
            );
        }

        // Ambil data performa dan penalti toko secara paralel
        const [performance, penalty] = await Promise.all([
            getShopPerformance(shopId),
            getShopPenalty(shopId)
        ]);

        // Periksa jika salah satu request gagal
        if (!performance.success || !penalty.success) {
            return NextResponse.json(
                { 
                    error: performance.error || penalty.error,
                    message: performance.message || penalty.message 
                },
                { status: 400 }
            );
        }

        // Gabungkan data performa dan penalti
        return NextResponse.json({
            success: true,
            data: {
                performance: performance.data,
                penalty: penalty.data
            },
            request_id: performance.request_id
        });

    } catch (error) {
        console.error('Kesalahan saat mengambil data toko:', error);
        return NextResponse.json(
            { 
                error: 'internal_server_error',
                message: 'Terjadi kesalahan internal server' 
            },
            { status: 500 }
        );
    }
}