import { NextResponse } from 'next/server';
import { getShopFlashSaleList } from '@/app/services/shopeeFlashSaleService';
import { getAllShops } from '@/app/services/shopeeService';

interface FlashSale {
  click_count: number;
  enabled_item_count: number;
  end_time: number;
  flash_sale_id: number;
  item_count: number;
  remindme_count: number;
  start_time: number;
  status: number;
  timeslot_id: number;
  type: number;
}

interface Shop {
  shop_id: number;
  shop_name: string;
}

export async function GET() {
  try {
    const shops = await getAllShops();
    let flashSaleIssues: Array<{
      shop_id: number;
      shop_name: string;
      issues: {
        inactive_current: number;
        no_active_flashsale: boolean;
        upcoming_count: number;
        inactive_upcoming: number;
      };
      details: Array<{
        flash_sale_id: number;
        start_time: number;
        end_time: number;
        type: string;
      }>;
    }> = [];

    for (const shop of shops) {
      try {
        const result = await getShopFlashSaleList(shop.shop_id, {
          type: 0, // Semua flash sale
          pagination_offset: 0,
          pagination_entry_count: 50
        });

        if (!result.success || !result.data.flash_sale_list) continue;

        const flashSales = result.data.flash_sale_list;

        // Menggunakan status type dari API
        const currentFlashSales = flashSales.filter((sale: FlashSale) => 
          sale.type === 2  // Flash sale yang sedang berjalan
        );
        
        const upcomingFlashSales = flashSales.filter((sale: FlashSale) => 
          sale.type === 1  // Flash sale yang akan datang
        );

        const currentInactive = currentFlashSales.filter((sale: FlashSale) => 
          sale.enabled_item_count === 0
        ).length;

        const upcomingInactive = upcomingFlashSales.filter((sale: FlashSale) => 
          sale.enabled_item_count === 0
        ).length;

        const upcomingCount = upcomingFlashSales.length;
        const hasActiveFlashsale = currentFlashSales.length > 0;

        // Modifikasi kondisi untuk selalu menambahkan toko yang tidak memiliki flash sale aktif
        if (!hasActiveFlashsale || currentInactive > 0 || upcomingCount < 3 || upcomingInactive > 0) {
          const details: Array<any> = [];

          // Jika tidak ada flash sale yang sedang berjalan, tambahkan detail khusus
          if (!hasActiveFlashsale) {
            details.push({
              flash_sale_id: 0,
              start_time: 0,
              end_time: 0,
              type: 'no_active_flashsale'
            });
          }

          // Tambahkan detail flash sale yang sedang berjalan tapi tidak aktif
          details.push(...currentFlashSales
            .filter((sale: FlashSale) => sale.enabled_item_count === 0)
            .map((sale: FlashSale) => ({
              flash_sale_id: sale.flash_sale_id,
              start_time: sale.start_time,
              end_time: sale.end_time,
              type: 'current_inactive'
            })));

          // Tambahkan detail flash sale yang akan datang tapi tidak aktif
          details.push(...upcomingFlashSales
            .filter((sale: FlashSale) => sale.enabled_item_count === 0)
            .map((sale: FlashSale) => ({
              flash_sale_id: sale.flash_sale_id,
              start_time: sale.start_time,
              end_time: sale.end_time,
              type: 'upcoming_inactive'
            })));

          flashSaleIssues.push({
            shop_id: shop.shop_id,
            shop_name: shop.shop_name,
            issues: {
              inactive_current: currentInactive,
              no_active_flashsale: !hasActiveFlashsale,
              upcoming_count: upcomingCount,
              inactive_upcoming: upcomingInactive
            },
            details
          });
        }
      } catch (shopError) {
        console.error(`Error checking shop ${shop.shop_id}:`, shopError);
        continue;
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: flashSaleIssues,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in check-inactive API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 
export const dynamic = 'force-dynamic';
export const revalidate = 0;