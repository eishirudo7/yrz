import { NextResponse } from 'next/server';
import { getShopInfo } from '@/app/services/shopeeService';
import { shopeeApi } from '@/lib/shopeeConfig';

interface TokenCheckResult {
    shop_id: number;
    is_active: boolean;
    message: string;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { shop_ids } = body;

        if (!shop_ids || !Array.isArray(shop_ids)) {
            return NextResponse.json({
                success: false,
                message: 'shop_ids harus berupa array'
            }, { status: 400 });
        }

        // Cek setiap shop_id secara paralel
        const checkPromises = shop_ids.map(async (shop_id: number) => {
            try {
                const shopInfo = await getShopInfo(shop_id);
                
                // Coba menggunakan token untuk memastikan masih valid
                const testResponse = await shopeeApi.getShopInfo(
                    shop_id,
                    shopInfo.access_token
                );

                const isActive = !testResponse.error;

                return {
                    shop_id,
                    is_active: isActive,
                    message: isActive ? 'Token aktif' : 'Token tidak valid'
                };
            } catch (error) {
                return {
                    shop_id,
                    is_active: false,
                    message: error instanceof Error ? error.message : 'Terjadi kesalahan saat pengecekan token'
                };
            }
        });

        const results = await Promise.all(checkPromises);

        return NextResponse.json({
            success: true,
            data: results
        });

    } catch (error) {
        console.error('Gagal melakukan pengecekan token:', error);
        return NextResponse.json({
            success: false,
            message: 'Terjadi kesalahan internal server'
        }, { status: 500 });
    }
}
