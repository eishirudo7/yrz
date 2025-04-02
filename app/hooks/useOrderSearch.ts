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

      let query = createClient()
        .from('orders_view')
        .select('*')
        .in('shop_id', userShopIds) // Batasi hanya untuk toko yang dimiliki user
      
      if (params.order_sn) {
        query = query.ilike('order_sn', `%${params.order_sn}%`)
      }
      if (params.buyer_username) {
        query = query.ilike('buyer_username', `%${params.buyer_username}%`)
      }
      if (params.tracking_number) {
        query = query.ilike('tracking_number', `%${params.tracking_number}%`)
      }

      const { data, error } = await query.order('create_time', { ascending: false })

      if (error) throw error
      
      const results = data || []
      setSearchResults(results)
      
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