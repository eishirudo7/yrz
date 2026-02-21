import { useEffect, useState, useCallback } from 'react'
import { DateRange } from 'react-day-picker'
import { useUserData } from '@/contexts/UserDataContext'
import { toast } from 'sonner'

export interface Order {
  order_sn: string
  shop_name: string
  order_status: string
  total_amount: string
  recalculated_total_amount?: number
  buyer_username: string
  shipping_carrier: string
  tracking_number: string
  sku_qty: string
  create_time: number
  cod: boolean
  cancel_reason: string
  pay_time?: number
  buyer_user_id?: number
  shop_id?: number
  escrow_amount_after_adjustment?: number
  items?: {
    sku: string
    model_name: string
    tier1_variation: string
    item_id?: number
    quantity: number
    price: number
    total_price: number
  }[]
}

export interface AdsData {
  shopId: number
  shopName: string
  totalSpend: number
  cost_formatted: string
}

// Tambahkan fungsi helper untuk format tanggal
const formatDateToYYYYMMDD = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateToDDMMYYYY = (dateStr: string) => {
  // dateStr dalam format YYYY-MM-DD
  return dateStr.split('-').reverse().join('-');
};

export function useOrders(dateRange?: DateRange | undefined) {
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersWithoutEscrow, setOrdersWithoutEscrow] = useState<Order[]>([])
  const [adsData, setAdsData] = useState<AdsData[]>([])
  const [totalAdsSpend, setTotalAdsSpend] = useState(0)
  const [loading, setLoading] = useState(true)
  const [adsLoading, setAdsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncingEscrow, setSyncingEscrow] = useState(false)
  const [syncType, setSyncType] = useState<'missing' | 'all' | null>(null)
  const [syncProgress, setSyncProgress] = useState({ completed: 0, total: 0 })

  // State untuk menyimpan parameter terakhir untuk refetch
  const [lastDateRange, setLastDateRange] = useState<DateRange | undefined>(dateRange)

  const { userId } = useUserData()

  const fetchOrders = useCallback(async (dateRangeToUse: DateRange | undefined = dateRange) => {
    if (!dateRangeToUse?.from) return

    try {
      setLoading(true)
      setError(null)

      // Simpan parameter ini untuk refetch nanti
      setLastDateRange(dateRangeToUse)

      // Konversi tanggal ke UNIX timestamp (dalam detik)
      const startDate = dateRangeToUse.from
      const endDate = dateRangeToUse.to || dateRangeToUse.from

      startDate.setHours(0, 0, 0, 0)
      endDate.setHours(23, 59, 59, 999)

      const startTimestamp = Math.floor(startDate.getTime() / 1000)
      const endTimestamp = Math.floor(endDate.getTime() / 1000)

      // Gunakan API endpoint - hanya kirim tanggal awal dan akhir
      const response = await fetch(
        `/api/orders?start_timestamp=${startTimestamp}&end_timestamp=${endTimestamp}`
      )

      // Handle error response
      if (!response.ok) {
        if (response.status === 504) {
          throw new Error('Request timeout. Silahkan coba kurangi rentang tanggal atau coba lagi nanti.');
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        setOrders(result.data || [])
        setOrdersWithoutEscrow(result.ordersWithoutEscrow || [])
      } else {
        throw new Error(result.message || 'Terjadi kesalahan saat mengambil data pesanan')
      }

      // Ambil data iklan secara non-blocking (tidak menghambat loading utama)
      fetchAdsDataNonBlocking(startTimestamp, endTimestamp)
    } catch (err) {
      console.error('Error fetching orders:', err)
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat mengambil data pesanan')
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  // Fungsi refetch yang dapat dipanggil dari luar
  const refetch = useCallback(() => {
    return fetchOrders(lastDateRange);
  }, [fetchOrders, lastDateRange]);

  const fetchAdsDataNonBlocking = (startTimestamp: number, endTimestamp: number) => {
    setAdsLoading(true)
    fetchAdsData(startTimestamp, endTimestamp).finally(() => setAdsLoading(false))
  }

  const fetchAdsData = async (startTimestamp: number, endTimestamp: number) => {
    try {
      // Ubah timestamp menjadi tanggal dalam format YYYY-MM-DD
      const startDate = new Date(startTimestamp * 1000);
      const endDate = new Date(endTimestamp * 1000);

      // Format tanggal untuk API iklan (YYYY-MM-DD)
      const startDateStr = formatDateToYYYYMMDD(startDate);
      const endDateStr = formatDateToYYYYMMDD(endDate);

      // Debug: log tanggal input
      console.log("Input ke fetchAdsData:", startDateStr, endDateStr);

      // Konversi format tanggal dari YYYY-MM-DD menjadi DD-MM-YYYY
      const formattedStartDate = formatDateToDDMMYYYY(startDateStr);
      const formattedEndDate = formatDateToDDMMYYYY(endDateStr);

      // Debug: log tanggal yang dikirim ke API
      console.log("Dikirim ke API ads:", formattedStartDate, formattedEndDate);

      // Panggil API untuk mendapatkan data iklan
      const response = await fetch(`/api/ads?start_date=${formattedStartDate}&end_date=${formattedEndDate}&_timestamp=${Date.now()}`);

      if (!response.ok) {
        throw new Error(`Gagal mengambil data iklan`);
      }

      const adsResult = await response.json();

      // Debug: log hasil respons API
      console.log("Respons dari API ads:", adsResult);
      console.log("Struktur ads_data:", adsResult.ads_data);
      console.log("Tipe ads_data:", Array.isArray(adsResult.ads_data) ? "Array" : typeof adsResult.ads_data);
      console.log("Jumlah item dalam ads_data:", adsResult.ads_data ? adsResult.ads_data.length : 0);

      // Simpan data toko jika ada
      if (adsResult && adsResult.ads_data) {
        setAdsData(adsResult.ads_data.map((ad: any) => ({
          shopId: ad.shop_id,
          shopName: ad.shop_name || `Shop ${ad.shop_id}`,
          totalSpend: ad.raw_cost,
          cost_formatted: ad.cost
        })));

        // Debug: log hasil konversi ads_data
        console.log("AdsData setelah konversi:", adsResult.ads_data.map((ad: any) => ({
          shopId: ad.shop_id,
          shopName: ad.shop_name || `Shop ${ad.shop_id}`,
          totalSpend: ad.raw_cost,
          cost_formatted: ad.cost
        })));
      }

      // Ambil total_cost langsung dari API response
      if (adsResult && adsResult.raw_total_cost) {
        // Gunakan raw_total_cost yang sudah dalam bentuk angka
        const totalCost = adsResult.raw_total_cost;
        setTotalAdsSpend(totalCost);
        console.log("Total pengeluaran iklan:", adsResult.total_cost, "(Rp)", adsResult.raw_total_cost, "(angka)");
      }
    } catch (err) {
      console.error("Error saat mengambil data iklan:", err)
      // Tidak perlu set error utama, karena ini hanya data pendukung
    }
  }

  // Tambahkan fungsi helper untuk memproses batch
  const processBatch = async (
    batch: Order[],
    shopId: number,
    updateProgress: (count: number) => void
  ) => {
    const orderSns = batch.map(order => order.order_sn);

    const response = await fetch(`/api/escrow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shopId: parseInt(shopId.toString()),
        orderSns
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Gagal menyinkronkan data escrow');
    }

    // Update progress setelah batch selesai
    updateProgress(orderSns.length);

    // Pastikan result.data adalah array
    if (!Array.isArray(result.data)) {
      console.error('Expected array of results but got:', result.data);
      return [];
    }

    // Return array of processed results dengan akses yang benar ke escrow_amount_after_adjustment
    return result.data.map((item: any) => ({
      order_sn: item.order_sn,
      success: item.success,
      escrow_amount_after_adjustment: item.data?.order_income?.escrow_amount_after_adjustment ?? null
    }));
  };

  // Fungsi helper untuk memproses array dalam chunks
  const processInChunks = async <T, R>(
    items: T[],
    chunkSize: number,
    processor: (chunk: T[]) => Promise<R[]>
  ): Promise<R[]> => {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, Math.min(i + chunkSize, items.length));
      const chunkResults = await Promise.all(chunk.map(item => processor([item]).then(r => r[0])));
      results.push(...chunkResults);
    }

    return results;
  };

  const syncMissingEscrowData = async (syncAll: boolean = false) => {
    // Jika sedang sync, jangan lakukan apa-apa
    if (syncingEscrow) return;

    // Set tipe sync yang sedang berjalan
    setSyncType(syncAll ? 'all' : 'missing');

    // Tentukan pesanan yang akan di-sync
    const ordersToSync = syncAll
      ? orders.filter(order =>
        order.order_status !== 'CANCELLED' &&
        order.order_status !== 'UNPAID'
      )
      : ordersWithoutEscrow;

    if (ordersToSync.length === 0) {
      toast.info('Tidak ada pesanan yang perlu disinkronkan');
      setSyncType(null);
      return;
    }

    setSyncingEscrow(true);
    setSyncProgress({ completed: 0, total: ordersToSync.length });

    let updatedOrders = [...orders];
    let completed = 0;

    try {
      // Kelompokkan order berdasarkan shop_id
      const ordersByShop = ordersToSync.reduce((acc, order) => {
        if (!order.shop_id) return acc;

        if (!acc[order.shop_id]) {
          acc[order.shop_id] = [];
        }
        acc[order.shop_id].push(order);
        return acc;
      }, {} as Record<number, Order[]>);

      // Proses setiap kelompok shop_id
      for (const [shopId, shopOrders] of Object.entries(ordersByShop)) {
        // Bagi pesanan menjadi batch-batch 100
        const batchSize = 100;
        const batches = [];
        for (let i = 0; i < shopOrders.length; i += batchSize) {
          batches.push(shopOrders.slice(i, i + batchSize));
        }

        // Proses 4 batch secara paralel
        const updateProgressCount = (count: number) => {
          completed += count;
          setSyncProgress({ completed, total: ordersToSync.length });
        };

        // Proses batches dalam chunks 4
        const results = await processInChunks(
          batches,
          4,
          async (batchChunk) => {
            const batchPromises = batchChunk.map(batch =>
              processBatch(batch, parseInt(shopId), updateProgressCount)
            );
            return Promise.all(batchPromises);
          }
        );

        // Flatten results dan update orders
        const flattenedResults = results.flat().flat(); // Double flatten karena nested arrays

        // Update orders dengan hasil yang valid
        updatedOrders = updatedOrders.map(order => {
          const result = flattenedResults.find(r => r.order_sn === order.order_sn);
          if (result?.success && result?.escrow_amount_after_adjustment !== undefined) {
            return {
              ...order,
              escrow_amount_after_adjustment: result.escrow_amount_after_adjustment
            };
          }
          return order;
        });
      }

      setOrders(updatedOrders);

      // Filter kembali pesanan yang masih belum memiliki data escrow
      const stillWithoutEscrow = updatedOrders.filter(
        order => (order.escrow_amount_after_adjustment === undefined ||
          order.escrow_amount_after_adjustment === null ||
          order.escrow_amount_after_adjustment === 0) &&
          order.order_status !== 'CANCELLED' &&
          order.order_status !== 'UNPAID'
      );
      setOrdersWithoutEscrow(stillWithoutEscrow);

      toast.success(`Berhasil menyinkronkan ${completed} data escrow`);
    } catch (err) {
      console.error('Error syncing escrow data:', err);
      toast.error(err instanceof Error ? err.message : 'Gagal menyinkronkan data escrow');
    } finally {
      setSyncingEscrow(false);
      setSyncType(null);
    }
  };

  useEffect(() => {
    if (dateRange?.from) {
      fetchOrders()
    }
  }, [dateRange, fetchOrders])

  return {
    orders,
    ordersWithoutEscrow,
    loading,
    error,
    syncMissingEscrowData,
    syncingEscrow,
    syncType,
    syncProgress,
    adsData,
    totalAdsSpend,
    adsLoading,
    refetch // Ekspor fungsi refetch
  }
} 