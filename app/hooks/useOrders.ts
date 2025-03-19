import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DateRange } from 'react-day-picker'
import { getEscrowDetail } from '@/app/services/shopeeService'
import { saveEscrowDetail } from '@/app/services/databaseOperations'

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

export function useOrders(dateRange: DateRange | undefined) {
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersWithoutEscrow, setOrdersWithoutEscrow] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncingEscrow, setSyncingEscrow] = useState(false)
  const [syncProgress, setSyncProgress] = useState({ completed: 0, total: 0 })

  // Fungsi untuk mengambil dan menyimpan data escrow untuk pesanan yang belum memilikinya
  const syncMissingEscrowData = async () => {
    if (ordersWithoutEscrow.length === 0) {
      console.log("Tidak ada pesanan yang memerlukan data escrow")
      return
    }
    
    setSyncingEscrow(true)
    setSyncProgress({ completed: 0, total: ordersWithoutEscrow.length })
    
    // Membuat antrian pesanan untuk proses batch
    const orderQueue = [...ordersWithoutEscrow]
    const processedOrders: Order[] = []
    
    try {
      // Proses batch dengan maksimal 10 pesanan per batch
      const batchSize = 10
      while (orderQueue.length > 0) {
        const batch = orderQueue.splice(0, batchSize)
        
        // Proses setiap pesanan dalam batch secara paralel
        await Promise.all(batch.map(async (order) => {
          try {
            if (!order.shop_id) {
              console.warn(`Pesanan ${order.order_sn} tidak memiliki shop_id, melewati`)
              return
            }
            
            // Ambil detail escrow dari API Shopee melalui API endpoint kita
            const response = await fetch(`/api/escrow?shop_id=${order.shop_id}&order_sn=${order.order_sn}`);
            const escrowResult = await response.json();

            if (escrowResult.success && escrowResult.data && escrowResult.data.success) {
              // Simpan detail escrow ke database
              await saveEscrowDetail(order.shop_id, escrowResult.data.data);
              
              // Perbarui data pesanan dengan nilai escrow
              const updatedOrder = {
                ...order,
                escrow_amount_after_adjustment: 
                  escrowResult.data.data.order_income?.escrow_amount_after_adjustment || 0
              };
              
              processedOrders.push(updatedOrder);
            } else {
              console.error(`Gagal mengambil escrow untuk pesanan ${order.order_sn}: ${
                escrowResult.message || (escrowResult.data && escrowResult.data.message) || 'Tidak ada pesan error'
              }`);
            }
          } catch (e) {
            console.error(`Error saat memproses pesanan ${order.order_sn}:`, e)
          }
          
          // Perbarui progress
          setSyncProgress(prev => ({
            completed: prev.completed + 1,
            total: prev.total
          }))
        }))
        
        // Delay antara batch untuk menghindari rate limiting
        if (orderQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
      
      // Perbarui state orders dengan data escrow yang baru
      if (processedOrders.length > 0) {
        setOrders(prevOrders => {
          const orderMap = new Map(prevOrders.map(order => [order.order_sn, order]))
          
          // Perbarui orders dengan data escrow baru
          processedOrders.forEach(updatedOrder => {
            orderMap.set(updatedOrder.order_sn, updatedOrder)
          })
          
          return Array.from(orderMap.values())
        })
        
        // Perbarui ordersWithoutEscrow (kurangi yang sudah diproses)
        const processedOrderSns = new Set(processedOrders.map(order => order.order_sn))
        setOrdersWithoutEscrow(prevOrders => 
          prevOrders.filter(order => !processedOrderSns.has(order.order_sn))
        )
        
        console.log(`Berhasil menyinkronkan ${processedOrders.length} data escrow`)
      }
    } catch (e) {
      console.error("Error saat menyinkronkan data escrow:", e)
    } finally {
      setSyncingEscrow(false)
    }
  }

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
        
        // Periksa pesanan dengan escrow_amount_after_adjustment bernilai NULL
        const ordersWithNullEscrow = allOrders.filter(
          order => order.escrow_amount_after_adjustment === null
        )
        
        console.log("Pesanan tanpa data escrow:", ordersWithNullEscrow.length)
        setOrdersWithoutEscrow(ordersWithNullEscrow)
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

  return { 
    orders, 
    ordersWithoutEscrow, 
    loading, 
    error, 
    syncMissingEscrowData, 
    syncingEscrow, 
    syncProgress 
  }
} 