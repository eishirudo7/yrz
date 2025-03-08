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
}

export function useOrders(dateRange: DateRange | undefined) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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
        
        const { data, error } = await supabase
          .from('orders_view')
          .select('*')
          .filter('create_time', 'gte', startTimestamp)
          .filter('create_time', 'lte', endTimestamp)
          .order('pay_time', { ascending: false })

        if (error) throw error
        setOrders(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Terjadi kesalahan saat mengambil data')
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [dateRange])

  return { orders, loading, error }
} 