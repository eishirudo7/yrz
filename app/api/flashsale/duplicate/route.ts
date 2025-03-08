import { NextRequest, NextResponse } from 'next/server';
import { getShopFlashSaleItems } from '@/app/services/shopeeFlashSaleService';

interface FlashSaleItem {
  item_id: number;
  item_name: string;
  image: string;
  status: number;
}

interface FlashSaleModel {
  model_id: number;
  model_name: string;
  item_id: number;
  original_price: number;
  input_promotion_price: number;
  campaign_stock: number;
  status: number;
}

interface DuplicationProgress {
  flash_sale_id: number;
  timeslot_id: number;
  total_items: number;
  successful_items: number;
  status: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== Start Flash Sale Duplication ===');
    
    const body = await request.json();
    const { shop_id, flash_sale_id, timeslot_ids } = body;
    
    console.log('Request payload:', {
      shop_id,
      flash_sale_id, 
      timeslot_ids,
      url: request.url
    });

    // Validasi input
    if (!shop_id || !flash_sale_id || !timeslot_ids || !Array.isArray(timeslot_ids)) {
      console.error('Validation failed:', { shop_id, flash_sale_id, timeslot_ids });
      return NextResponse.json(
        { 
          success: false,
          message: 'Parameter shop_id, flash_sale_id, dan timeslot_ids diperlukan' 
        },
        { status: 400 }
      );
    }

    // Ambil detail flash sale yang akan diduplikasi
    console.log('Fetching flash sale details for:', { shop_id, flash_sale_id });
    const detailResponse = await getShopFlashSaleItems(shop_id, flash_sale_id);
    
    if (!detailResponse.success) {
      console.error('Failed to fetch flash sale details:', detailResponse);
      return NextResponse.json({
        success: false,
        message: 'Gagal mengambil detail flash sale'
      }, { status: 400 });
    }

    console.log('Flash sale details retrieved:', {
      itemCount: detailResponse.data?.items?.length,
      modelCount: detailResponse.data?.models?.length
    });

    const duplicatedFlashSales = [];
    const failedDuplications = [];

    // Setup stream
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    console.log('Stream setup completed');

    // Kirim response awal
    const response = new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

    // Proses duplikasi
    (async () => {
      try {
        for (let i = 0; i < timeslot_ids.length; i++) {
          const timeslot_id = timeslot_ids[i];
          
          // 1. Kirim status memulai pembuatan flash sale
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({
                progress: {
                  current: i,
                  total: timeslot_ids.length,
                  status: `Membuat flash sale untuk slot ${i + 1}/${timeslot_ids.length}...`,
                  detail: {
                    flash_sale_id: null,
                    step: 'create',
                    status: 'Membuat flash sale baru...',
                    total_items: detailResponse.data?.items?.length || 0,
                    successful_items: 0
                  }
                }
              })}\n\n`
            )
          );

          // 2. Buat flash sale baru
          const createResponse = await fetch('http://localhost:10000/api/flashsale/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shop_id, timeslot_id })
          });

          const createData = await createResponse.json();
          
          if (!createData?.success) {
            throw new Error('Gagal membuat flash sale');
          }

          const newFlashSaleId = createData.data.flash_sale_id;

          // Kirim update status setelah flash sale berhasil dibuat
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({
                progress: {
                  current: i,
                  total: timeslot_ids.length,
                  status: `Flash sale berhasil dibuat dengan ID #${newFlashSaleId}`,
                  detail: {
                    flash_sale_id: newFlashSaleId,
                    step: 'create',
                    status: 'Flash sale berhasil dibuat',
                    total_items: detailResponse.data?.items?.length || 0,
                    successful_items: 0
                  }
                }
              })}\n\n`
            )
          );

          // 3. Kirim status mulai mendaftarkan items
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({
                progress: {
                  current: i,
                  total: timeslot_ids.length,
                  status: `Mendaftarkan items ke Flash Sale #${newFlashSaleId}...`,
                  detail: {
                    flash_sale_id: newFlashSaleId,
                    step: 'register',
                    status: `Mendaftarkan items ke Flash Sale #${newFlashSaleId}`,
                    total_items: detailResponse.data?.items?.length || 0,
                    successful_items: 0
                  }
                }
              })}\n\n`
            )
          );

          // 4. Proses penambahan items
          const items = detailResponse.data.items
            .map((item: FlashSaleItem) => {
              const itemModels = detailResponse.data.models
                .filter((model: FlashSaleModel) => 
                  model.item_id === item.item_id && model.campaign_stock > 0
                );
              
              if (itemModels.length === 0) return null;

              return {
                item_id: item.item_id,
                purchase_limit: 0,
                models: itemModels.map((model: FlashSaleModel) => ({
                  model_id: model.model_id,
                  input_promo_price: model.input_promotion_price,
                  stock: model.campaign_stock
                }))
              };
            })
            .filter(Boolean);

          // 5. Tambahkan items ke flash sale
          const addResponse = await fetch('http://localhost:10000/api/flashsale/items/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shop_id,
              flash_sale_id: newFlashSaleId,
              items
            })
          });

          const addData = await addResponse.json();

          // 6. Kirim status selesai untuk flash sale ini
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({
                progress: {
                  current: i + 1,
                  total: timeslot_ids.length,
                  status: `Berhasil mendaftarkan items ke Flash Sale #${newFlashSaleId}`,
                  detail: {
                    flash_sale_id: newFlashSaleId,
                    step: 'complete',
                    status: `Berhasil mendaftarkan ${items.length} items ke Flash Sale #${newFlashSaleId}`,
                    total_items: items.length,
                    successful_items: items.length
                  }
                }
              })}\n\n`
            )
          );

          // Tunggu sebentar sebelum memproses slot berikutnya
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // 7. Kirim ringkasan akhir setelah semua selesai
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              success: true,
              data: {
                summary: {
                  total_slots: timeslot_ids.length,
                  successful_slots: timeslot_ids.length,
                  failed_slots: 0
                }
              }
            })}\n\n`
          )
        );
      } catch (error) {
        console.error('Error during duplication:', error);
        // Kirim status error
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              success: false,
              message: 'Terjadi kesalahan saat duplikasi flash sale'
            })}\n\n`
          )
        );
      } finally {
        await writer.close();
      }
    })();

    console.log('Returning stream response');
    return response;

  } catch (error) {
    console.error('Route error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Terjadi kesalahan internal server'
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0