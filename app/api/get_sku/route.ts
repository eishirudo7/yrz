import { NextResponse } from 'next/server';
import { getItemsBySku } from '@/app/services/databaseOperations';
import { getItemBaseInfo } from '@/app/services/shopeeService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shop_id');
    const itemIds = searchParams.get('item_ids')?.split(',');

    // Validasi parameter
    if (!itemIds?.length) {
      return NextResponse.json(
        { error: 'item_ids diperlukan' },
        { status: 400 }
      );
    }

    // 1. Ambil data dari database lokal dulu
    const items = await getItemsBySku(itemIds, shopId);

    // 2. Cek apakah ada item yang tidak ditemukan di DB
    const foundItemIds = new Set(items.map((item: any) => item.item_id.toString()));
    const missingItemIds = itemIds.filter(id => !foundItemIds.has(id));

    // 3. Fallback: Ambil data missing items dari Shopee API langsung
    if (missingItemIds.length > 0 && shopId) {
      try {
        const numericMissingIds = missingItemIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));

        if (numericMissingIds.length > 0) {
          const shopeeResult = await getItemBaseInfo(parseInt(shopId, 10), numericMissingIds);

          if (shopeeResult.success && shopeeResult.data && shopeeResult.data.item_list) {
            // Mapping hasil Shopee agar sesuai format getItemsBySku dari DB
            const shopeeItems = shopeeResult.data.item_list.map((item: any) => ({
              item_id: item.item_id.toString(),
              item_sku: item.item_sku || '',
              item_name: item.item_name || '',
              image: item.image?.image_url_list?.[0] || ''
            }));

            // Gabungkan dengan item yang ditemukan di DB
            items.push(...shopeeItems);
          }
        }
      } catch (shopeeError) {
        console.error('Gagal fallback ke Shopee API:', shopeeError);
        // Tetap lanjut, kita kembalikan saja setidaknya apa yang ada di DB
      }
    }

    return NextResponse.json({ items });

  } catch (error) {
    console.error('Error di /api/get_sku:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}