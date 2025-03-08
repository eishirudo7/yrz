import { NextRequest, NextResponse } from 'next/server';
import { downloadShippingDocument, createShippingDocument, getTrackingNumber as getShopeeTrackingNumber } from '@/app/services/shopeeService';
import { mergePDFs } from '@/app/utils/pdfUtils';

const BATCH_SIZE = 50; // Batasan dari Shopee API

// Definisikan interface untuk order list
interface OrderItem {
  order_sn: string;
  shipping_document_type: string;
  shipping_carrier: string | null;
}



export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const shopId = parseInt(searchParams.get('shopId') || '0');
    const orderSns = searchParams.get('orderSns')?.split(',') || [];
    const carrier = searchParams.get('carrier');

    if (!shopId || orderSns.length === 0) {
      return new NextResponse('Parameter tidak valid', { status: 400 });
    }

    const pdfBlobs: Buffer[] = [];
    let remainingOrders = [...orderSns];
    const failedOrders: string[] = []; // Tambahkan array untuk menyimpan order yang gagal
    
    while (remainingOrders.length > 0) {
      const currentBatch = remainingOrders.slice(0, BATCH_SIZE);
      const orderList: OrderItem[] = currentBatch.map(orderSn => ({
        order_sn: orderSn,
        shipping_document_type: "THERMAL_AIR_WAYBILL",
        shipping_carrier: carrier
      }));

      try {
        const response = await downloadShippingDocument(shopId, orderList);
        
        if (response instanceof Buffer) {
          pdfBlobs.push(response);
          remainingOrders = remainingOrders.filter(sn => !currentBatch.includes(sn));
        } else if (response.error === 'logistics.package_print_failed' || response.error === 'logistics.shipping_document_should_print_first' || response.error === 'logistics.package_print_failed') {
          const failedOrderMatch = response.message.match(/order_sn: (\w+) print failed/);
          if (failedOrderMatch) {
            const failedOrderSn = failedOrderMatch[1];
            
            try {
              // Dapatkan tracking number terlebih dahulu
              const trackingResponse = await getShopeeTrackingNumber(shopId, failedOrderSn);
              const trackingNumber = trackingResponse?.response?.tracking_number;

              // Buat dokumen dengan tracking number
              const createResponse = await createShippingDocument(shopId, [{
                order_sn: failedOrderSn,
                tracking_number: trackingNumber || undefined
              }]);
              
              // Periksa status dari result_list
              const orderResult = createResponse.response?.result_list?.[0];
              
              if (createResponse.error || !orderResult || orderResult.status === "FAILED") {
                console.error('Gagal membuat dokumen:', orderResult?.fail_message || createResponse.message);
                failedOrders.push(failedOrderSn);
                remainingOrders = remainingOrders.filter(sn => sn !== failedOrderSn);
              } else if (orderResult.status === "SUCCESS") {
                // Tunggu sebentar sebelum mencoba download ulang
                await new Promise(resolve => setTimeout(resolve, 2000));
                // Tambahkan kembali order ke remainingOrders untuk dicoba download ulang
                remainingOrders = [...remainingOrders, failedOrderSn];
              }
            } catch (createError) {
              console.error('Error saat membuat dokumen baru:', createError);
              failedOrders.push(failedOrderSn);
              remainingOrders = remainingOrders.filter(sn => sn !== failedOrderSn);
            }
            
            const remainingBatchOrders = currentBatch.filter(sn => sn !== failedOrderSn);
            if (remainingBatchOrders.length > 0) {
              remainingOrders = [...remainingBatchOrders, ...remainingOrders.filter(sn => !currentBatch.includes(sn))];
            }
          }
        }
      } catch (error) {
        console.error('Error saat memproses batch:', error);
        currentBatch.forEach(sn => failedOrders.push(sn)); // Tambahkan semua order dalam batch yang error
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Periksa hasil akhir
    if (pdfBlobs.length === 0) {
      return NextResponse.json({
        error: "no_documents",
        message: "Tidak ada dokumen yang berhasil diproses",
        failedOrders // Sertakan failedOrders dalam response
      }, { status: 404 });
    }

    // Buat response dengan header yang menyertakan informasi failedOrders
    const headers = {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="shipping-labels-${Date.now()}.pdf"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Failed-Orders': JSON.stringify(failedOrders) // Tambahkan failed orders ke header
    };

    if (pdfBlobs.length === 1) {
      return new NextResponse(pdfBlobs[0], { status: 200, headers });
    }

    const pdfBlobArray = pdfBlobs.map(buffer => new Blob([buffer], { type: 'application/pdf' }));
    const mergedPDF = await mergePDFs(pdfBlobArray);
    
    return new NextResponse(mergedPDF, { status: 200, headers });

  } catch (error) {
    console.error('Error saat mengambil PDF:', error);
    return NextResponse.json(
      { error: "internal_server_error", message: "Terjadi kesalahan internal server" },
      { status: 500 }
    );
  }
} 