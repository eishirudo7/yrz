import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Order } from './useOrders'

interface SearchParams {
  order_sn?: string
  buyer_username?: string
  tracking_number?: string
}

export function useOrderSearch() {
  const [searchResults, setSearchResults] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchOrders = async (params: SearchParams) => {
    setLoading(true)
    setError(null)
    
    try {
      let query = supabase
        .from('orders_view')
        .select('*')
      
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