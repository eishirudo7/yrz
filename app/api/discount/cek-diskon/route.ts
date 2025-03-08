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

export async function GET() {
  try {
    const response = await fetch('http://localhost:10000/api/discount');
    const { data } = await response.json() as ApiResponse;

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
        const endDate = new Date(d.end_time_formatted);
        return d.status === 'ongoing' && 
               endDate <= twoDaysLater && 
               endDate > now;
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
        const hasOngoing = discounts.some((d: Discount) => 
          d.status === 'ongoing' && 
          d.discount_name === expired.discount_name
        );
        
        if (!hasOngoing) {
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
    return NextResponse.json({
      success: false,
      message: 'Terjadi kesalahan saat mengecek diskon',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
export const revalidate = 0;