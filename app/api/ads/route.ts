import { NextRequest, NextResponse } from "next/server";
import { getAllShops, getAdsDailyPerformance } from '@/app/services/shopeeService';
import { formatCurrency } from '@/utils/currencyFormatter';

export async function GET(req: NextRequest, res: NextResponse) {
    const { searchParams } = new URL(req.url);

    let start_date = searchParams.get("start_date");
    let end_date = searchParams.get("end_date");

    if (!start_date || !end_date) {
        const today = new Date();
        const jakartaTime = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
        const defaultDate = jakartaTime.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).split('/').join('-');
        start_date = defaultDate;
        end_date = defaultDate;
        console.log(`Menggunakan tanggal default: ${defaultDate}`);
    }

    // Pastikan start_date dan end_date adalah string
    const safeStartDate = start_date as string;
    const safeEndDate = end_date as string;

    try {
        const shops = await getAllShops();
        let adsData = [];
        let totalCost = 0;

        for (const shop of shops) {
            try {

                console.log(`Mengambil performa iklan untuk toko ${shop.shop_name} (ID: ${shop.shop_id})`);
                const performance = await getAdsDailyPerformance(shop.shop_id, safeStartDate, safeEndDate);

                const shopCost = performance.reduce((sum: any, day: { expense: any; }) => sum + day.expense, 0);
                totalCost += shopCost;

                adsData.push({
                    shop_id: shop.shop_id,
                    shop_name: shop.shop_name,
                    cost: formatCurrency(shopCost)
                });
            } catch (error) {
                console.error(`Terjadi kesalahan saat mengambil performa iklan untuk toko ${shop.shop_name}: ${error}`);
            }
        }

        console.log(`Pengambilan performa iklan selesai. Total toko: ${adsData.length}`);
        return NextResponse.json({
            ads_data: adsData,
            total_cost: formatCurrency(totalCost * 1.11)
        }, { status: 200 });

    } catch (error) {
        console.error("Error fetching ads performance:", error);
        return NextResponse.json({ error: "Gagal mengambil data performa iklan" }, { status: 500 });
    }
}
