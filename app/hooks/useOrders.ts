import { useEffect, useState, useCallback } from 'react'
import { DateRange } from 'react-day-picker'
import { useUserData } from '@/contexts/UserDataContext'
import { toast } from 'sonner'

export interface Order {
  order_sn: string
  shop_name: string
  order_status: string
  total_amount: string
  buyer_username: string
  shipping_carrier: string
  tracking_number: string
  sku_qty: string
  create_time: number
  cod: boolean
  cancel_reason: string
  buyer_user_id?: number
  shop_id?: number
  escrow_amount_after_adjustment?: number
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
  const [error, setError] = useState<string | null>(null)
  const [syncingEscrow, setSyncingEscrow] = useState(false)
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

      // Ambil data iklan untuk rentang tanggal yang dipilih
      await fetchAdsData(startTimestamp, endTimestamp)
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

  const fetchAdsData = async (startTimestamp: number, endTimestamp: number) => {
    try {
      const response = await fetch(
        `/api/ads?start_timestamp=${startTimestamp}&end_timestamp=${endTimestamp}`
      )

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setAdsData(result.data || [])
          
          // Hitung total pengeluaran iklan
          const totalSpend = result.data.reduce((total: number, item: AdsData) => total + item.totalSpend, 0)
          setTotalAdsSpend(totalSpend)
        }
      }
    } catch (err) {
      console.error('Error fetching ads data:', err)
      // Tidak perlu set error utama, karena ini hanya data pendukung
    }
  }

  const syncMissingEscrowData = async () => {
    if (syncingEscrow || ordersWithoutEscrow.length === 0) return

    setSyncingEscrow(true)
    setSyncProgress({ completed: 0, total: ordersWithoutEscrow.length })

    let updatedOrders = [...orders]
    const orderSns = ordersWithoutEscrow.map(order => order.order_sn)
    let completed = 0

    try {
      const response = await fetch('/api/escrow/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderSns }),
      })

      if (response.ok) {
        const result = await response.json()
        
        if (result.success && result.data) {
          // Perbarui data orders dengan data escrow yang baru
          for (const updatedOrder of result.data) {
            updatedOrders = updatedOrders.map(order => 
              order.order_sn === updatedOrder.order_sn ? { ...order, ...updatedOrder } : order
            )
            completed++
            setSyncProgress({ completed, total: ordersWithoutEscrow.length })
          }
          
          setOrders(updatedOrders)
          
          // Filter kembali pesanan yang masih belum memiliki data escrow
          const stillWithoutEscrow = updatedOrders.filter(
            order => order.escrow_amount_after_adjustment === null || order.escrow_amount_after_adjustment === undefined
          )
          setOrdersWithoutEscrow(stillWithoutEscrow)
          
          toast.success(`Berhasil menyinkronkan ${completed} data escrow`)
        } else {
          throw new Error(result.message || 'Gagal menyinkronkan data escrow')
        }
      } else {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
    } catch (err) {
      console.error('Error syncing escrow data:', err)
      toast.error(err instanceof Error ? err.message : 'Gagal menyinkronkan data escrow')
    } finally {
      setSyncingEscrow(false)
    }
  }

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
    syncProgress,
    adsData,
    totalAdsSpend,
    refetch // Ekspor fungsi refetch
  }
} 