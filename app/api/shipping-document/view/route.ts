import { NextRequest, NextResponse } from 'next/server';
import { downloadShippingDocument, createShippingDocument, getTrackingNumber as getShopeeTrackingNumber } from '@/app/services/shopeeService';
import { mergePDFs } from '@/utils/pdfUtils';

const BATCH_SIZE = 50; // Batasan dari Shopee API
const BATCH_DELAY = 300; // Turunkan delay antar batch



export async function GET(req: NextRequest) {
  try {
    // 1. Validasi di awal lebih detail
    const searchParams = req.nextUrl.searchParams;
    const shopId = parseInt(searchParams.get('shopId') || '0');
    const orderSns = searchParams.get('orderSns')?.split(',').filter(Boolean) || [];
    const carrier = searchParams.get('carrier');

    if (!shopId || orderSns.length === 0) {
      return NextResponse.json({
        error: "invalid_parameters",
        message: "Parameter shopId dan orderSns harus diisi"
      }, { status: 400 });
    }

    // 2. Batasi jumlah maksimum order yang bisa diproses
    const MAX_ORDERS = 2000;
    if (orderSns.length > MAX_ORDERS) {
      return NextResponse.json({
        error: "too_many_orders",
        message: `Maksimal ${MAX_ORDERS} order dalam satu request`
      }, { status: 400 });
    }

    const pdfBlobs: Buffer[] = [];
    const failedOrders: string[] = [];

    // Bagi orders menjadi batches
    const batches = [];
    for (let i = 0; i < orderSns.length; i += BATCH_SIZE) {
      batches.push(orderSns.slice(i, i + BATCH_SIZE));
    }

    // Proses batches secara parallel dengan rate limiting
    await Promise.all(
      batches.map(async (batch, index) => {
        // Rate limiting dengan delay yang lebih pendek
        await new Promise(resolve => setTimeout(resolve, index * BATCH_DELAY));

        const orderList = batch.map(orderSn => ({
          order_sn: orderSn,
          shipping_document_type: "THERMAL_AIR_WAYBILL",
          shipping_carrier: carrier
        }));

        try {
          const response = await downloadShippingDocument(shopId, orderList);

          if (response instanceof Buffer) {
            pdfBlobs.push(response);
            return;
          }

          if (response.error) {
            const failedOrderMatch = response.message.match(/order_sn: (\w+) print failed/);
            if (failedOrderMatch) {
              const failedOrderSn = failedOrderMatch[1];

              // Retry dengan tracking number
              try {
                const trackingResponse = await getShopeeTrackingNumber(shopId, failedOrderSn);
                if (trackingResponse?.response?.tracking_number) {
                  const createResponse = await createShippingDocument(shopId, [{
                    order_sn: failedOrderSn,
                    tracking_number: trackingResponse.response.tracking_number
                  }]);

                  if (createResponse.response?.result_list?.[0]?.status === "SUCCESS") {
                    // Tunggu sebentar lalu coba download lagi
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    const retryResponse = await downloadShippingDocument(shopId, [{
                      order_sn: failedOrderSn,
                      shipping_document_type: "THERMAL_AIR_WAYBILL"
                    }]);

                    if (retryResponse instanceof Buffer) {
                      pdfBlobs.push(retryResponse);
                      return;
                    }
                  }
                }
              } catch (retryError) {
                console.error('Retry failed:', retryError);
              }

              failedOrders.push(failedOrderSn);
            }
          }
        } catch (error) {
          console.error('Batch processing error:', error);
          failedOrders.push(...batch);
        }
      })
    );

    // 8. Handle hasil dengan lebih baik
    if (pdfBlobs.length === 0) {
      return NextResponse.json({
        error: "no_documents",
        message: "Tidak ada dokumen yang berhasil diproses",
        failedOrders
      }, {
        status: 404,
        headers: { 'X-Failed-Orders': JSON.stringify(failedOrders) }
      });
    }

    // 9. Optimize PDF merging
    let responseBody: Blob;

    if (pdfBlobs.length === 1) {
      responseBody = new Blob([new Uint8Array(pdfBlobs[0])], { type: 'application/pdf' });
    } else {
      // Convert Buffers to Blobs using Uint8Array (compatible with both Node and Browser)
      const blobsForMerge = pdfBlobs.map(buffer =>
        new Blob([new Uint8Array(buffer)], { type: 'application/pdf' })
      );
      responseBody = await mergePDFs(blobsForMerge);
    }

    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="shipping-labels-${Date.now()}.pdf"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Failed-Orders': JSON.stringify(failedOrders)
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({
      error: "internal_server_error",
      message: error instanceof Error ? error.message : "Terjadi kesalahan internal server"
    }, { status: 500 });
  }
} 