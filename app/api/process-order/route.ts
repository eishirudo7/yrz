import { NextResponse } from 'next/server';
import { processReadyToShipOrders } from '@/app/services/shopeeService';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { shopId, orderSn, shippingMethod = 'dropoff' } = body;

        // Validasi input
        if (!shopId || !orderSn) {
            return NextResponse.json(
                { 
                    success: false, 
                    message: 'shopId dan orderSn harus diisi' 
                }, 
                { status: 400 }
            );
        }

        const result = await processReadyToShipOrders(shopId, orderSn, shippingMethod);

        if (!result.success) {
            return NextResponse.json(
                { 
                    success: false, 
                    error: result.error,
                    message: result.message,
                    request_id: result.request_id 
                }, 
                { status: 400 }
            );
        }

        return NextResponse.json(result);

    } catch (error) {
        console.error('Terjadi kesalahan saat memproses pesanan:', error);
        return NextResponse.json(
            { 
                success: false, 
                message: 'Terjadi kesalahan internal server' 
            }, 
            { status: 500 }
        );
    }
} 