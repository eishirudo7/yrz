import { NextRequest, NextResponse } from 'next/server';
import { createDiscount, getDiscountList,getAllShops, addDiscountItems } from '@/app/services/shopeeService';

// Tambahkan interface untuk tipe data shop
interface ShopData {
  id: number;
  shop_id: number;
  shop_name: string;
  // ... properti lain tidak digunakan untuk fungsi ini
}

// Interface untuk response dari getAllShops

// Interface untuk data diskon dari Shopee
interface DiscountData {
  discount_id: string | number;
  discount_name: string;
  start_time: number;
  end_time: number;
  source: number;
  status: string;
}

// Interface untuk data yang sudah ditambah informasi toko
interface EnhancedDiscountData extends DiscountData {
  shop_name: string;
  shop_id: number;
  start_time_formatted: string;
  end_time_formatted: string;
}

// Interface untuk response dari Shopee
interface ShopeeDiscountResponse {
  success: boolean;
  data: {
    discount_list: DiscountData[];
    more: boolean;
  };
  request_id: string;
}

// Tambahkan interface baru untuk hasil per toko
interface ShopDiscountResult {
  shop_name: string;
  shop_id: number;
  discounts: EnhancedDiscountData[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shopId, discountData } = body;

    if (!shopId || !discountData) {
      return NextResponse.json(
        { error: 'Data tidak lengkap' },
        { status: 400 }
      );
    }

    const result = await createDiscount(shopId, discountData);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating discount:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan internal server' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const shopId = searchParams.get('shopId') ? parseInt(searchParams.get('shopId') || '') : null;
    const status = (searchParams.get('status') || 'all').toLowerCase() as 'upcoming' | 'ongoing' | 'expired' | 'all';
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const cursor = searchParams.get('cursor') || '';

    console.log('Request parameters:', {
      shopId,
      status,
      pageSize,
      cursor
    });

    if (!shopId) {
      const shops = await getAllShops() as ShopData[];
      console.log('Daftar toko yang ditemukan:', shops);

      if (!shops || !shops.length) {
        return NextResponse.json(
          { error: "Tidak ada toko yang ditemukan" },
          { status: 400 }
        );
      }

      const params = {
        discount_status: status,
        page_size: pageSize,
        cursor
      };
      
      console.log('Parameter request ke Shopee:', params);

      const allDiscounts = await Promise.all(
        shops.map(async (shop: ShopData) => {
          console.log(`Request ke Shopee untuk toko ${shop.shop_name} (ID: ${shop.shop_id})`);
          const response = await getDiscountList(shop.shop_id, params) as ShopeeDiscountResponse;
          console.log(`Response dari Shopee untuk toko ${shop.shop_name}:`, response);
          if (response.success && response.data && Array.isArray(response.data.discount_list)) {
            return {
              ...response,
              data: {
                ...response.data,
                discount_list: response.data.discount_list.map(discount => ({
                  discount_id: discount.discount_id,
                  discount_name: discount.discount_name,
                  start_time_formatted: new Date(discount.start_time * 1000).toLocaleString('id-ID'),
                  end_time_formatted: new Date(discount.end_time * 1000).toLocaleString('id-ID'),
                  source: discount.source,
                  status: discount.status,
                  shop_name: shop.shop_name,
                  shop_id: shop.shop_id
                })),
                shop_name: shop.shop_name,
                shop_id: shop.shop_id
              }
            };
          }
          return response;
        })
      );

      console.log('Semua response dari Shopee:', JSON.stringify(allDiscounts, null, 2));

      const combinedResult = {
        success: true,
        data: allDiscounts.reduce((acc: ShopDiscountResult[], curr: any) => {
          if (curr.success && curr.data && Array.isArray(curr.data.discount_list)) {
            acc.push({
              shop_name: curr.data.shop_name,
              shop_id: curr.data.shop_id,
              discounts: curr.data.discount_list
            });
          }
          return acc;
        }, [] as ShopDiscountResult[]),
        message: "Berhasil mengambil data diskon dari semua toko"
      };

      console.log('Hasil akhir yang dikelompokkan per toko:', JSON.stringify(combinedResult, null, 2));
      
      return NextResponse.json(combinedResult);
    }

    // Untuk single shop
    const params = {
      discount_status: status,
      page_size: pageSize,
      cursor
    };
    
    console.log('Request ke Shopee:', {
      shopId,
      params
    });

    const result = await getDiscountList(shopId, params);

    console.log('Response dari Shopee:', JSON.stringify(result, null, 2));

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting discount list:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan internal server' },
      { status: 500 }
    );
  }
} 
export const dynamic = 'force-dynamic';
export const revalidate = 0;