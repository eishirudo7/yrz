import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DateRange } from 'react-day-picker'
import { getEscrowDetail, getAdsDailyPerformance } from '@/app/services/shopeeService'
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

export interface AdsData {
  shopId: number
  shopName: string
  totalSpend: number
  cost_formatted: string
}

export function useOrders(dateRange: DateRange | undefined) {
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersWithoutEscrow, setOrdersWithoutEscrow] = useState<Order[]>([])
  const [adsData, setAdsData] = useState<AdsData[]>([])
  const [totalAdsSpend, setTotalAdsSpend] = useState(0)
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

  // Fungsi untuk mengambil data iklan
  const fetchAdsData = async (startDate: string, endDate: string) => {
    try {
      // Debug: log tanggal input
      console.log("Input ke fetchAdsData:", startDate, endDate);
      
      // Cek apakah tanggal mulai dan akhir sama, jika sama gunakan tanggal yang sama untuk keduanya
      const useStartDate = startDate;
      
      // Konversi format tanggal dari YYYY-MM-DD menjadi DD-MM-YYYY
      const formattedStartDate = useStartDate.split('-').reverse().join('-');
      const formattedEndDate = endDate.split('-').reverse().join('-');
      
      // Debug: log tanggal yang dikirim ke API
      console.log("Dikirim ke API ads:", formattedStartDate, formattedEndDate);
      
      // Panggil API untuk mendapatkan data iklan
      const response = await fetch(`/api/ads?start_date=${formattedStartDate}&end_date=${formattedEndDate}&_timestamp=${Date.now()}`);
      
      if (!response.ok) {
        throw new Error(`Gagal mengambil data iklan`);
      }
      
      const adsResult = await response.json();
      
      // Simpan data toko jika ada
      if (adsResult && adsResult.ads_data) {
        setAdsData(adsResult.ads_data.map((ad: any) => ({
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
    } catch (e) {
      console.error("Error saat mengambil data iklan:", e);
    }
  };

  useEffect(() => {
    // Penting: Set loading ke true setiap kali dateRange berubah
    setLoading(true)
    console.log("Loading dimulai, dateRange berubah:", dateRange)
    
    async function fetchOrders() {
      try {
        const fromDate = dateRange?.from || new Date()
        const toDate = dateRange?.to || fromDate
        
        console.log("Date range dari picker:", fromDate, toDate);
        
        // Set waktu ke awal dan akhir hari
        const startDate = new Date(fromDate)
        const endDate = new Date(toDate)
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)
        
        console.log("Tanggal setelah set jam:", startDate, endDate);
        
        // Konversi ke UNIX timestamp (seconds)
        const startTimestamp = Math.floor(startDate.getTime() / 1000)
        const endTimestamp = Math.floor(endDate.getTime() / 1000)
        
        // Format tanggal untuk API iklan (YYYY-MM-DD)
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        
        console.log("Tanggal format ISO:", startDateStr, endDateStr);
        
        // Simpan format tanggal untuk digunakan oleh fetchAdsDataAsync
        const adsStartDate = startDateStr;
        const adsEndDate = endDateStr;
        
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
        
        // Setelah selesai mengambil data pesanan, atur loading ke false
        setLoading(false)
        
      } catch (e) {
        console.error("Error saat mengambil data:", e)
        setError(e instanceof Error ? e.message : 'Terjadi kesalahan saat mengambil data')
        setLoading(false)
      }
    }
    
    // Fungsi terpisah untuk mengambil data iklan
    async function fetchAdsDataAsync() {
      if (!dateRange?.from || !dateRange?.to) return;
      
      // Buat ulang format tanggal dengan pola yang sama persis seperti di fetchOrders
      const fromDate = dateRange?.from || new Date()
      const toDate = dateRange?.to || fromDate
      
      // Set waktu ke awal dan akhir hari
      const startDate = new Date(fromDate)
      const endDate = new Date(toDate)
      startDate.setHours(0, 0, 0, 0)
      endDate.setHours(23, 59, 59, 999)
      
      // Format tanggal untuk API iklan (YYYY-MM-DD)
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      console.log("Tanggal untuk ads di fetchAdsDataAsync:", startDateStr, endDateStr);
      
      // Ambil data iklan secara asynchronous - untuk hari yang sama, gunakan endDateStr untuk kedua parameter
      if (fromDate.toDateString() === toDate.toDateString()) {
        fetchAdsData(endDateStr, endDateStr).catch(err => {
          console.error("Error saat mengambil data iklan secara async:", err)
        });
      } else {
        fetchAdsData(startDateStr, endDateStr).catch(err => {
          console.error("Error saat mengambil data iklan secara async:", err)
        });
      }
    }

    // Jalankan fetchOrders dan fetchAdsDataAsync secara terpisah
    fetchOrders();
    fetchAdsDataAsync();
  }, [dateRange])

  return { 
    orders, 
    ordersWithoutEscrow, 
    adsData,
    totalAdsSpend,
    loading, 
    error, 
    syncMissingEscrowData, 
    syncingEscrow, 
    syncProgress 
  }
} 