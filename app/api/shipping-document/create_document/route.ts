import { NextResponse } from 'next/server';
import { createShippingDocument, getTrackingNumber } from '@/app/services/shopeeService';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        // Cek query parameter
        const { searchParams } = new URL(request.url);
        const isGetTrackingOnly = searchParams.get('get_tracking') === 'true';

        const body = await request.json();
        const { shopId, order_sn, tracking_number } = body;

        // Validasi input
        if (!shopId || !order_sn) {
            return NextResponse.json({
                success: false,
                message: "Parameter shopId dan order_sn harus diisi"
            }, { status: 400 });
        }

        // Jika tracking number tidak ada, coba dapatkan
        if (!tracking_number) {
            console.log('Mencoba mendapatkan tracking number untuk:', { shopId, order_sn });
            const trackingResult = await getTrackingNumber(shopId, order_sn);
            console.log('Hasil getTrackingNumber:', JSON.stringify(trackingResult, null, 2));
            
            if (trackingResult.error || 
                (trackingResult.response && !trackingResult.response.tracking_number)) {
                console.error('Error saat mendapatkan tracking number:', trackingResult.error);
                return NextResponse.json({
                    success: false,
                    message: "Gagal mendapatkan tracking number",
                    error: trackingResult.error || "Tracking number tidak ditemukan",
                    details: trackingResult
                }, { status: 400 });
            }
            
            const finalTrackingNumber = trackingResult.response.tracking_number;
            
            // Update tracking number di database
            const { error: updateError } = await supabase
                .from('logistic')
                .update({ tracking_number: finalTrackingNumber })
                .eq('order_sn', order_sn);
                
            if (updateError) {
                console.error('Gagal mengupdate tracking number di database:', updateError);
            }

            // Jika hanya ingin mendapatkan tracking number, return di sini
            if (isGetTrackingOnly) {
                return NextResponse.json({
                    success: true,
                    data: { tracking_number: finalTrackingNumber }
                });
            }

            // Lanjutkan dengan pembuatan dokumen menggunakan tracking number yang baru didapat
            return await createDocument(shopId, order_sn, finalTrackingNumber);
        }

        // Jika hanya ingin mendapatkan tracking number dan sudah tersedia
        if (isGetTrackingOnly) {
            return NextResponse.json({
                success: true,
                data: { tracking_number }
            });
        }

        // Lanjutkan dengan pembuatan dokumen
        return await createDocument(shopId, order_sn, tracking_number);

    } catch (error) {
        console.error('Terjadi kesalahan:', error);
        return NextResponse.json({
            success: false,
            message: "Terjadi kesalahan internal server",
            error: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}

// Helper function untuk membuat dokumen
async function createDocument(shopId: number, order_sn: string, tracking_number: string) {
    const orderList = [{
        order_sn,
        tracking_number
    }];

    const result = await createShippingDocument(shopId, orderList);
    console.log('Respons dari createShippingDocument:', JSON.stringify(result, null, 2));

    if (result.error || (result.response?.error)) {
        return NextResponse.json({
            success: false,
            message: result.message || result.response?.message || "Gagal membuat dokumen pengiriman",
            error: result.error || result.response?.error,
            details: result.response?.result_list || result.response
        }, { status: 400 });
    }

    // Update status dokumen menjadi READY
    const { error: updateError } = await supabase
        .from('logistic')
        .update({ document_status: 'READY' })
        .eq('order_sn', order_sn);

    if (updateError) {
        console.error('Gagal mengupdate status dokumen:', updateError);
        // Tetap lanjutkan karena dokumen sudah berhasil dibuat
    }

    return NextResponse.json({
        success: true,
        data: result.response || result
    });
}
