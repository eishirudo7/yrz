import { NextRequest, NextResponse } from 'next/server';
import { getShopFlashSaleList } from '@/app/services/shopeeFlashSaleService';
import { getAllShops } from '@/app/services/shopeeService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shopId = searchParams.get('shop_id') || '';
    const type = parseInt(searchParams.get('type') || '');
    const startTime = searchParams.get('start_time') ? parseInt(searchParams.get('start_time') || '') : undefined;
    const endTime = searchParams.get('end_time') ? parseInt(searchParams.get('end_time') || '') : undefined;
    const offset = parseInt(searchParams.get('offset') || '0');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Validasi parameter wajib
    if (!shopId) {
      return NextResponse.json(
        { error: 'Parameter shop_id diperlukan' },
        { status: 400 }
      );
    }

    // Handle kasus untuk semua toko
    if (shopId.toLowerCase() === 'all') {
      const shops = await getAllShops();
      const allFlashSales = await Promise.all(
        shops.map(async shop => {
          const flashSaleData = await getShopFlashSaleList(shop.shop_id, {
            type: type || 0,
            pagination_offset: offset,
            pagination_entry_count: 50
          });

          // Tambahkan informasi toko ke setiap flash sale
          return {
            shop_id: shop.shop_id,
            shop_name: shop.shop_name,
            flash_sales: flashSaleData
          };
        })
      );

      return NextResponse.json(allFlashSales);
    }

    // Handle kasus untuk toko spesifik
    const shopIdNum = parseInt(shopId);
    if (isNaN(shopIdNum)) {
      return NextResponse.json(
        { error: 'Parameter shop_id harus berupa angka atau "all"' },
        { status: 400 }
      );
    }

    // Validasi type
    if (![0, 1, 2, 3].includes(type)) {
      return NextResponse.json(
        { error: 'Parameter type harus bernilai 0, 1, 2, atau 3' },
        { status: 400 }
      );
    }

    // Validasi start_time dan end_time
    if ((startTime && !endTime) || (!startTime && endTime)) {
      return NextResponse.json(
        { error: 'Parameter start_time dan end_time harus digunakan bersama' },
        { status: 400 }
      );
    }

    if (startTime && endTime && startTime >= endTime) {
      return NextResponse.json(
        { error: 'Parameter start_time harus lebih kecil dari end_time' },
        { status: 400 }
      );
    }

    // Validasi offset dan limit
    if (offset < 0 || offset > 1000) {
      return NextResponse.json(
        { error: 'Parameter offset harus antara 0 dan 1000' },
        { status: 400 }
      );
    }

    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Parameter limit harus antara 1 dan 100' },
        { status: 400 }
      );
    }

    const result = await getShopFlashSaleList(shopIdNum, {
      type,
      start_time: startTime,
      end_time: endTime,
      pagination_offset: offset,
      pagination_entry_count: limit
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 