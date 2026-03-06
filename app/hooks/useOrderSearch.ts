import { useState } from 'react'
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
      const userShopIds = shops.map(shop => shop.shop_id)

      if (userShopIds.length === 0) {
        setSearchResults([])
        return
      }

      const queryParams = new URLSearchParams();
      if (params.order_sn) queryParams.set('order_sn', params.order_sn);
      if (params.buyer_username) queryParams.set('buyer_username', params.buyer_username);
      if (params.tracking_number) queryParams.set('tracking_number', params.tracking_number);

      const response = await fetch(`/api/data/order-search?${queryParams}`);
      if (!response.ok) throw new Error('Gagal mencari pesanan');

      const result = await response.json();
      setSearchResults(result.data || []);

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