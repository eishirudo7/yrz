import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DateRange } from 'react-day-picker'

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
}

export function useOrders(dateRange: DateRange | undefined) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Penting: Set loading ke true setiap kali dateRange berubah
    setLoading(true)
    console.log("Loading dimulai, dateRange berubah:", dateRange)
    
    async function fetchOrders() {
      try {
        const fromDate = dateRange?.from || new Date()
        const toDate = dateRange?.to || fromDate
        
        // Set waktu ke awal dan akhir hari
        const startDate = new Date(fromDate)
        const endDate = new Date(toDate)
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)
        
        // Konversi ke UNIX timestamp (seconds)
        const startTimestamp = Math.floor(startDate.getTime() / 1000)
        const endTimestamp = Math.floor(endDate.getTime() / 1000)
        
        let allOrders: Order[] = []
        let page = 0
        const pageSize = 800
        let hasMore = true
        
        while (hasMore) {
          const { data, error } = await supabase
            .from('orders_view')
            .select('*')
            .filter('create_time', 'gte', startTimestamp)
            .filter('create_time', 'lte', endTimestamp)
            .order('pay_time', { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1)
          
          if (error) throw error
          
          if (data && data.length > 0) {
            allOrders = [...allOrders, ...data]
            page++
          }
          
          // Jika data yang dikembalikan kurang dari pageSize, berarti sudah tidak ada lagi data
          hasMore = data && data.length === pageSize
        }
        
        console.log("Data berhasil diambil:", allOrders.length)
        setOrders(allOrders)
      } catch (e) {
        console.error("Error saat mengambil data:", e)
        setError(e instanceof Error ? e.message : 'Terjadi kesalahan saat mengambil data')
      } finally {
        console.log("Loading selesai")
        setLoading(false)
      }
    }

    fetchOrders()
  }, [dateRange]) // Pastikan dateRange ada di dependency array

  return { orders, loading, error }
} 