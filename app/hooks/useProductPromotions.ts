// hooks/useProductPromotions.ts
import { useState } from 'react'
import { toast } from 'sonner'

interface PromotionData {
  promotion_id: string
  promotion_type: string
  model_id: number
  start_time: number
  end_time: number
  promotion_price_info: {
    promotion_price: number
  }[]
  promotion_staging: 'ongoing' | 'upcoming'
  promotion_stock_info_v2: {
    summary_info: {
      total_reserved_stock: number
    }
  }
}

interface ProductPromotion {
  item_id: number
  promotion: PromotionData[]
}

export function useProductPromotions() {
  const [isLoading, setIsLoading] = useState(false)
  const [promotions, setPromotions] = useState<ProductPromotion[]>([])

  const fetchPromotions = async (shopId: number, itemIds: number[]) => {
    try {
      setIsLoading(true)
      
      const response = await fetch(`/api/produk/promotion?shop_id=${shopId}&item_ids=${itemIds.join(',')}`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Gagal mengambil data promosi')
      }

      setPromotions(data.data.success_list)
      return data.data.success_list

    } catch (error) {
      toast.error('Gagal Memuat Promosi', {
        description: error instanceof Error ? error.message : 'Terjadi kesalahan saat memuat data promosi',
      })
      return []
    } finally {
      setIsLoading(false)
    }
  }

  // Fungsi helper untuk mendapatkan promosi aktif untuk model tertentu
  const getActivePromotion = (itemId: number, modelId: number) => {
    const productPromo = promotions.find(p => p.item_id === itemId)
    if (!productPromo) return null

    return productPromo.promotion.find(
      promo => 
        promo.model_id === modelId && 
        (promo.promotion_staging === 'ongoing' || promo.promotion_staging === 'upcoming')
    )
  }

  return {
    isLoading,
    promotions,
    fetchPromotions,
    getActivePromotion
  }
}