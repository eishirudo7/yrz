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

      // Supabase client only needed for auth implicitly by the API route now
      // Build query string
      const searchQueryParams = new URLSearchParams();
      if (params.order_sn) searchQueryParams.append('order_sn', params.order_sn);
      if (params.buyer_username) searchQueryParams.append('buyer_username', params.buyer_username);
      if (params.tracking_number) searchQueryParams.append('tracking_number', params.tracking_number);

      // Call internal API Route instead of Supabase client directly
      const response = await fetch(`/api/data/orders/search?${searchQueryParams.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to search orders via internal API');
      }

      const result = await response.json();

      if (!result.success || !result.data) {
        setSearchResults([])
        return
      }

      const ordersData = result.data.ordersData || [];
      const itemsData = result.data.itemsData || [];

      if (ordersData.length === 0) {
        setSearchResults([])
        return
      }

      // 4. Format data hasil sesuai dengan format yang diharapkan oleh aplikasi
      const formattedResults = (ordersData as any[]).map((order: any) => {
        // Data toko
        const shop = shops.find(s => s.shop_id === order.shop_id) || { shop_name: 'Tidak diketahui' }

        // Filter items untuk pesanan ini
        const orderItems = (itemsData as any[])?.filter((item: any) => item.order_sn === order.order_sn) || []

        // Hitung total dari items (seperti recalculated_total_amount di API)
        const recalculated_total_amount = orderItems.reduce((total: number, item: any) => {
          const price = parseFloat(item.model_discounted_price || 0)
          const quantity = parseInt(item.model_quantity_purchased || 0)
          return total + (price * quantity)
        }, 0)

        // Format sku_qty string
        const skuQty = orderItems.length > 0
          ? orderItems.map((item: any) => `${(item.item_sku && item.item_sku !== 'EMPTY' && item.item_sku.trim() !== '') ? item.item_sku : item.model_sku} (${item.model_quantity_purchased})`).join(', ')
          : ''

        // Format items array
        const formattedItems = orderItems.map((item: any) => ({
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
      formattedResults.sort((a: any, b: any) => {
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