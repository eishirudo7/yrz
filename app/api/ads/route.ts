import { NextRequest, NextResponse } from "next/server";
import { getAllShops, getAdsDailyPerformance } from '@/app/services/shopeeService';
import { formatCurrency } from '@/utils/currencyFormatter';

export async function GET(req: NextRequest, res: NextResponse) {
    const { searchParams } = new URL(req.url);

    let start_date = searchParams.get("start_date");
    let end_date = searchParams.get("end_date");

    // Dapatkan tanggal hari ini dalam zona waktu Jakarta
    const today = new Date();
    const jakartaTime = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const todayFormatted = jakartaTime.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).split('/').join('-');

    // Fungsi untuk parsing tanggal DD-MM-YYYY
    function parseDate(dateStr: string): Date | null {
        const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dateStr);
        if (!match) return null;
        
        const [_, day, month, year] = match;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    // Fungsi untuk format tanggal ke DD-MM-YYYY
    function formatDate(date: Date): string {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    }

    if (!start_date || !end_date) {
        start_date = todayFormatted;
        end_date = todayFormatted;
        console.log(`Menggunakan tanggal default: ${todayFormatted}`);
    }

    // Parse tanggal yang diterima
    const startDateObj = parseDate(start_date as string);
    const endDateObj = parseDate(end_date as string);
    const todayObj = parseDate(todayFormatted);
    
    if (!startDateObj || !endDateObj || !todayObj) {
        console.error("Error parsing tanggal: ", { start_date, end_date, todayFormatted });
        return NextResponse.json({ error: "Format tanggal tidak valid" }, { status: 400 });
    }
    
    console.log("Tanggal yang di-parse:", {
        startDate: startDateObj.toISOString(),
        endDate: endDateObj.toISOString(),
        today: todayObj.toISOString()
    });

    // Validasi: Jika tanggal di masa depan, gunakan tanggal hari ini
    if (endDateObj > todayObj) {
        console.log(`End date ${end_date} di masa depan. Menggunakan tanggal hari ini: ${todayFormatted}`);
        end_date = todayFormatted;
        endDateObj.setTime(todayObj.getTime());
    }
    
    if (startDateObj > todayObj) {
        console.log(`Start date ${start_date} di masa depan. Menggunakan tanggal hari ini: ${todayFormatted}`);
        start_date = todayFormatted;
        startDateObj.setTime(todayObj.getTime());
    }
    
    // Pastikan startDate tidak lebih dari endDate
    if (startDateObj > endDateObj) {
        console.log(`Start date ${start_date} lebih dari end date ${end_date}. Menggunakan end date sebagai start date.`);
        start_date = end_date;
        startDateObj.setTime(endDateObj.getTime());
    }

    // Hitung rentang tanggal (dalam hari)
    const diffTime = Math.abs(endDateObj.getTime() - startDateObj.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 karena inklusif
    
    console.log(`Rentang tanggal: ${diffDays} hari (dari ${start_date} sampai ${end_date})`);
    
    // Validasi: Pastikan rentang tanggal tidak lebih dari 30 hari (batas API Shopee)
    if (diffDays > 30) {
        console.log(`Rentang tanggal (${diffDays} hari) melebihi batas 30 hari dari API Shopee.`);
        
        // Strategi untuk menangani bulan dengan 31 hari:
        // 1. Jika rentang adalah bulan penuh, potong menjadi dua periode: 1-30 dan 31
        // 2. Jika rentang adalah periode lain yang melebihi 30 hari, ambil 30 hari terakhir
        
        const isFullMonth = isFullMonthRange(startDateObj, endDateObj);
        
        if (isFullMonth && diffDays === 31) {
            // Kasus khusus: Bulan dengan 31 hari
            console.log("Mendeteksi bulan penuh dengan 31 hari. Memecah menjadi dua permintaan API.");
            
            // Kita akan membuat dua permintaan API: 
            // 1. Untuk 30 hari pertama (1-30)
            // 2. Untuk 1 hari terakhir (31)
            
            // Ambil tanggal 30 dari bulan tersebut sebagai tanggal akhir periode pertama
            const endFirstPeriod = new Date(startDateObj);
            endFirstPeriod.setDate(30);
            
            // Kita akan memproses 30 hari pertama terlebih dahulu
            const safeStartDateOriginal = start_date as string;
            const safeEndDateFirstPeriod = formatDate(endFirstPeriod);
            
            console.log(`Memproses periode pertama: ${safeStartDateOriginal} hingga ${safeEndDateFirstPeriod} (30 hari)`);
            
            // Simpan tanggal hari ke-31 untuk diproses nanti jika diperlukan
            const startSecondPeriod = new Date(endFirstPeriod);
            startSecondPeriod.setDate(31);
            const safeStartDateSecondPeriod = formatDate(startSecondPeriod);
            
            console.log(`Tanggal untuk periode kedua (akan diproses nanti): ${safeStartDateSecondPeriod} hingga ${end_date} (1 hari)`);
            
            // Gunakan 30 hari pertama untuk permintaan utama
            start_date = safeStartDateOriginal;
            end_date = safeEndDateFirstPeriod;
        } else {
            // Kasus umum: Ambil 30 hari terakhir
            startDateObj.setTime(endDateObj.getTime());
            startDateObj.setDate(endDateObj.getDate() - 29); // -29 untuk mendapatkan rentang 30 hari inklusif
            
            // Format ulang tanggal mulai
            start_date = formatDate(startDateObj);
            
            console.log(`Tanggal mulai disesuaikan menjadi: ${start_date}`);
        }
    }

    // Pastikan start_date dan end_date adalah string
    const safeStartDate = start_date as string;
    const safeEndDate = end_date as string;
    
    console.log(`Tanggal yang akan digunakan: ${safeStartDate} hingga ${safeEndDate}`);

    // Fungsi untuk menentukan apakah rentang adalah bulan penuh
    function isFullMonthRange(startDate: Date, endDate: Date): boolean {
        // Rentang adalah bulan penuh jika:
        // 1. Tanggal mulai adalah tanggal 1
        // 2. Bulan tanggal mulai dan akhir sama
        // 3. Tahun tanggal mulai dan akhir sama
        // 4. Tanggal akhir adalah tanggal terakhir bulan tersebut
        
        if (startDate.getDate() !== 1) return false;
        if (startDate.getMonth() !== endDate.getMonth()) return false;
        if (startDate.getFullYear() !== endDate.getFullYear()) return false;
        
        // Cek apakah tanggal akhir adalah tanggal terakhir bulan
        const lastDayOfMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
        return endDate.getDate() === lastDayOfMonth;
    }

    // Fungsi untuk menunggu dengan waktu tertentu
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Fungsi untuk mengambil data iklan dengan retry
    async function fetchAdsWithRetry(shopId: number, startDate: string, endDate: string, maxRetries = 3, retryDelay = 2000) {
        let retries = 0;
        
        while (retries < maxRetries) {
            try {
                const performance = await getAdsDailyPerformance(shopId, startDate, endDate);
                
                // Cek jika terjadi rate limit
                if (performance?.error === 'ads.rate_limit.exceed_api') {
                    retries++;
                    console.log(`Rate limit terdeteksi untuk toko ID ${shopId}, retry ke-${retries}/${maxRetries} setelah ${retryDelay}ms`);
                    await sleep(retryDelay);
                    continue;
                }
                
                return performance;
            } catch (error) {
                retries++;
                if (retries >= maxRetries) throw error;
                console.log(`Error pada request untuk toko ID ${shopId}, retry ke-${retries}/${maxRetries} setelah ${retryDelay}ms`);
                await sleep(retryDelay);
            }
        }
        
        throw new Error(`Gagal mengambil data setelah ${maxRetries} percobaan`);
    }

    try {
        const shops = await getAllShops();
        
        // Ubah ke pengambilan data secara paralel menggunakan Promise.all
        const adsDataPromises = shops.map(async (shop) => {
            try {
                console.log(`Mengambil performa iklan untuk toko ${shop.shop_name} (ID: ${shop.shop_id})`);
                console.log(`Parameter request: shop_id=${shop.shop_id}, start_date=${safeStartDate}, end_date=${safeEndDate}`);
                
                // Gunakan fungsi dengan retry
                const performance = await fetchAdsWithRetry(Number(shop.shop_id), safeStartDate, safeEndDate);
                
                console.log(`Response dari API untuk toko ${shop.shop_name}:`, 
                    typeof performance === 'object' ? JSON.stringify(performance).substring(0, 200) + '...' : performance);
                
                if (Array.isArray(performance)) {
                    const shopCost = performance.reduce((sum: any, day: { expense: any; }) => sum + day.expense, 0);
                    const shopCostWithTax = shopCost * 1.11;
                    
                    return {
                        shop_id: shop.shop_id,
                        shop_name: shop.shop_name,
                        cost: formatCurrency(shopCostWithTax),
                        raw_cost: shopCostWithTax
                    };
                } else {
                    console.error(`Respons API bukan array untuk toko ${shop.shop_name}:`, performance);
                    
                    return {
                        shop_id: shop.shop_id,
                        shop_name: shop.shop_name,
                        cost: formatCurrency(0),
                        raw_cost: 0,
                        error: performance?.message || (performance?.error ? `Error: ${performance.error}` : 'Format data tidak valid')
                    };
                }
            } catch (error) {
                console.error(`Terjadi kesalahan saat mengambil performa iklan untuk toko ${shop.shop_name}:`, error);
                return {
                    shop_id: shop.shop_id,
                    shop_name: shop.shop_name,
                    cost: formatCurrency(0),
                    raw_cost: 0,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });
        
        const adsData = await Promise.all(adsDataPromises);
        const totalCost = adsData.reduce((sum, item) => sum + (item.raw_cost || 0), 0);

        console.log(`Pengambilan performa iklan selesai. Total toko: ${adsData.length}`);
        return NextResponse.json({
            ads_data: adsData,
            total_cost: formatCurrency(totalCost),
            raw_total_cost: totalCost
        }, { status: 200 });

    } catch (error) {
        console.error("Error fetching ads performance:", error);
        return NextResponse.json({ 
            error: "Gagal mengambil data performa iklan",
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
