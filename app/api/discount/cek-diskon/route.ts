import { NextResponse } from "next/server";

interface Discount {
  discount_id: string | number;
  discount_name: string;
  start_time_formatted: string;
  end_time_formatted: string;
  source: number;
  status: 'upcoming' | 'ongoing' | 'expired';
  shop_name: string;
  shop_id: number;
}

interface Shop {
  shop_name: string;
  shop_id: number;
  discounts: Discount[];
}

interface ApiResponse {
  data: Shop[];
  success: boolean;
  message?: string;
}

interface ResultData {
  shops_without_backup: Array<{ 
    shop_name: string; 
    shop_id: number;
    ongoing_discounts: Discount[];
  }>;
  ending_soon: Array<{ shop_name: string; shop_id: number; discounts: Discount[] }>;
  expired_without_ongoing: Array<{ shop_name: string; shop_id: number; discount: Discount }>;
}

export async function GET(request: Request) {
  try {
    // Ambil parameter shopIds dari URL query
    const url = new URL(request.url);
    const shopIdsParam = url.searchParams.get('shopIds');
    
    // Buat URL dengan parameter shopIds jika ada
    let apiUrl = 'http://localhost:10000/api/discount';
    if (shopIdsParam) {
      console.log('Mendapatkan diskon dengan parameter shopIds:', shopIdsParam);
      // Teruskan parameter shopIds ke API jika diperlukan
      apiUrl += `?shopIds=${shopIdsParam}`;
    }
    
    const response = await fetch(apiUrl);
    
    // Jika response tidak ok, tetap kembalikan struktur data kosong yang valid
    if (!response.ok) {
      console.error('Response API discount tidak ok:', response.status, response.statusText);
      return NextResponse.json({
        success: true,
        data: {
          shops_without_backup: [],
          ending_soon: [],
          expired_without_ongoing: []
        },
        message: 'Tidak ada data diskon yang tersedia'
      });
    }
    
    const responseData = await response.json() as ApiResponse;

    // Tambahkan pemeriksaan data
    if (!responseData.success || !responseData.data || !Array.isArray(responseData.data)) {
      console.error('Data diskon tidak valid:', responseData);
      return NextResponse.json({
        success: true, // Tetap kembalikan success=true untuk menghindari error di SafeTool
        data: {
          shops_without_backup: [],
          ending_soon: [],
          expired_without_ongoing: []
        },
        message: 'Data diskon tidak tersedia atau tidak valid'
      });
    }

    // Filter data berdasarkan shopIds jika parameter diberikan
    let { data } = responseData;
    
    if (shopIdsParam) {
      const shopIds = shopIdsParam.split(',').map(id => parseInt(id.trim(), 10));
      console.log('Memfilter data diskon untuk shopIds:', shopIds);
      data = data.filter(shop => shopIds.includes(shop.shop_id));
      console.log(`Mendapatkan data diskon dari ${data.length} toko setelah filter`);
    }
    
    const result: ResultData = {
      shops_without_backup: [],
      ending_soon: [],
      expired_without_ongoing: []
    };

    // Tanggal sekarang dan 2 hari kedepan untuk pengecekan
    const now = new Date();
    const twoDaysLater = new Date();
    twoDaysLater.setDate(now.getDate() + 2);

    data.forEach((shop: Shop) => {
      const { shop_name, shop_id, discounts } = shop;

      // Tambahkan pemeriksaan discounts
      if (!discounts || !Array.isArray(discounts)) {
        console.warn(`Toko ${shop_name} (ID: ${shop_id}) tidak memiliki data diskon yang valid`);
        return; // skip shop ini
      }

      // 1. Cek backup (upcoming) diskon
      const hasUpcoming = discounts.some((d: Discount) => d.status === 'upcoming');
      const ongoingDiscounts = discounts.filter((d: Discount) => d.status === 'ongoing');
      
      if (!hasUpcoming && ongoingDiscounts.length > 0) {
        result.shops_without_backup.push({ 
          shop_name, 
          shop_id,
          ongoing_discounts: ongoingDiscounts
        });
      }

      // 2. Cek diskon yang akan berakhir dalam 2 hari
      const endingSoon = discounts.filter((d: Discount) => {
        if (!d.end_time_formatted) return false;
        try {
          const endDate = new Date(d.end_time_formatted);
          return d.status === 'ongoing' && 
                endDate <= twoDaysLater && 
                endDate > now;
        } catch (e) {
          console.warn(`Format tanggal tidak valid untuk diskon ${d.discount_name}:`, d.end_time_formatted);
          return false;
        }
      });
      
      if (endingSoon.length > 0) {
        result.ending_soon.push({
          shop_name,
          shop_id,
          discounts: endingSoon
        });
      }

      // 3. Cek diskon expired tanpa ongoing yang sama
      const expiredDiscounts = discounts.filter((d: Discount) => d.status === 'expired');
      expiredDiscounts.forEach((expired: Discount) => {
        const hasReplacement = discounts.some((d: Discount) => 
          (d.status === 'ongoing' || d.status === 'upcoming') && 
          d.discount_name === expired.discount_name
        );
        
        if (!hasReplacement) {
          result.expired_without_ongoing.push({
            shop_name,
            shop_id,
            discount: expired
          });
        }
      });
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Pengecekan diskon berhasil'
    });

  } catch (error) {
    console.error('Error checking discounts:', error);
    // Tetap kembalikan struktur data yang benar untuk mencegah error
    return NextResponse.json({
      success: true, // Tetap kembalikan success=true untuk menghindari error di SafeTool
      data: {
        shops_without_backup: [],
        ending_soon: [],
        expired_without_ongoing: []
      },
      message: 'Terjadi kesalahan saat mengecek diskon, mengembalikan data kosong'
    });
  }
}
export const dynamic = 'force-dynamic';
export const revalidate = 0;