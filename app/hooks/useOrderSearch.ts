import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Order } from './useOrders'
import { useUserData } from '@/contexts/UserDataContext'

interface SearchParams {
  order_sn?: string
  buyer_username?: string
  tracking_number?: string
}

export function useOrderSearch() {
  const [searchResults, setSearchResults] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { shops } = useUserData()

  const searchOrders = async (params: SearchParams) => {
    setLoading(true)
    setError(null)
    
    try {
      // Dapatkan daftar shop_id dari toko yang dimiliki user
      const userShopIds = shops.map(shop => shop.shop_id)
      
      // Jika user tidak memiliki toko, kembalikan array kosong
      if (userShopIds.length === 0) {
        setSearchResults([])
        return
      }

      // Supabase client
      const supabase = createClient()
      
      // 1. Query data pesanan
      let query = supabase
        .from('orders')
        .select('*')
        .in('shop_id', userShopIds) // Batasi hanya untuk toko yang dimiliki user
      
      // Tambahkan filter pencarian
      if (params.order_sn) {
        query = query.ilike('order_sn', `%${params.order_sn}%`)
      }
      if (params.buyer_username) {
        query = query.ilike('buyer_username', `%${params.buyer_username}%`)
      }
      if (params.tracking_number) {
        query = query.ilike('tracking_number', `%${params.tracking_number}%`)
      }

      const { data: ordersData, error: ordersError } = await query.order('create_time', { ascending: false })

      if (ordersError) throw ordersError
      
      if (!ordersData || ordersData.length === 0) {
        setSearchResults([])
        return
      }
      
      // 2. Ambil semua order_sn untuk query items
      const orderSns = ordersData.map(order => order.order_sn)
      
      // 3. Query data items untuk semua pesanan yang ditemukan
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('order_sn, item_sku, model_sku, model_quantity_purchased, model_discounted_price')
        .in('order_sn', orderSns)
        
      if (itemsError) throw itemsError
      
      // 4. Format data hasil sesuai dengan format yang diharapkan oleh aplikasi
      const formattedResults = ordersData.map(order => {
        // Data toko
        const shop = shops.find(s => s.shop_id === order.shop_id) || { shop_name: 'Tidak diketahui' }
        
        // Filter items untuk pesanan ini
        const orderItems = itemsData?.filter(item => item.order_sn === order.order_sn) || []
        
        // Hitung total dari items (seperti recalculated_total_amount di API)
        const recalculated_total_amount = orderItems.reduce((total, item) => {
          const price = parseFloat(item.model_discounted_price || 0)
          const quantity = parseInt(item.model_quantity_purchased || 0)
          return total + (price * quantity)
        }, 0)
        
        // Format sku_qty string
        const skuQty = orderItems.length > 0
          ? orderItems.map(item => `${(item.item_sku && item.item_sku !== 'EMPTY' && item.item_sku.trim() !== '') ? item.item_sku : item.model_sku} (${item.model_quantity_purchased})`).join(', ')
          : ''
        
        // Format items array
        const formattedItems = orderItems.map(item => ({
          sku: (item.item_sku && item.item_sku !== 'EMPTY' && item.item_sku.trim() !== '') ? item.item_sku : item.model_sku,
          quantity: parseInt(item.model_quantity_purchased || '0'),
          price: parseFloat(item.model_discounted_price || '0'),
          total_price: parseFloat(item.model_discounted_price || '0') * parseInt(item.model_quantity_purchased || '0')
        }))
        
        // Format hasil akhir
        return {
          ...order,
          shop_name: shop.shop_name,
          recalculated_total_amount: recalculated_total_amount || order.total_amount,
          sku_qty: skuQty,
          items: formattedItems
        } as Order
      })
      
      // 5. Urutkan hasil sesuai dengan logika di API
      formattedResults.sort((a, b) => {
        const aTime = a.cod ? a.create_time : (a.pay_time || a.create_time)
        const bTime = b.cod ? b.create_time : (b.pay_time || b.create_time)
        return bTime - aTime
      })
      
      setSearchResults(formattedResults)
      
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan saat mencari pesanan')
      setSearchResults([])
    } finally {
      setLoading(false)
    }
  }

  const clearSearch = () => {
    setSearchResults([])
    setError(null)
  }

  return {
    searchResults,
    loading,
    error,
    searchOrders,
    clearSearch
  }
} 