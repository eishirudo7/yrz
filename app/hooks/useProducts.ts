import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { getAllShops } from '../services/shopeeService'
import { supabase } from '@/lib/supabase'

export interface Product {
  item_id: number
  shop_id: number
  category_id: number
  item_name: string
  description: string
  item_sku: string
  create_time: number
  update_time: number
  weight: string | number
  image: {
    image_id_list: string[]
    image_url_list: string[]
    image_ratio: string
  }
  logistic_info: Array<{
    logistic_id: number
    logistic_name: string
    enabled: boolean
    size_id: number
    is_free: boolean
  }>
  pre_order: {
    is_pre_order: boolean
    days_to_ship: number
  }
  condition: string
  item_status: string
  has_model: boolean
  models?: Array<{
    model_id: number
    model_name: string
    price_info: {
      current_price: number
      original_price: number
    }
    stock_info: {
      stock_type: number
      stock: number
    }
    model_status: string
  }>
  variations?: Array<{
    name: string
    options: string[]
    variation_id?: number
    variation_name: string
    variation_option_list: Array<{
      variation_option_id: number
      variation_option_name: string
      image_url: string | null
    }>
    variation_group_id: number | null
  }>
  brand: {
    brand_id: number
    original_brand_name: string
  }
  item_dangerous: number
  description_type: string
  size_chart_id: number
  promotion_image: {
    image_id_list: string[]
    image_url_list: string[]
  }
  deboost: string
  authorised_brand_id: number
  shopee_tokens: {
    shop_id: number
    shop_name: string
  }[]
  image_id_list: string[]
  image_url_list: string[]
}

interface SyncResponse {
  error: string | undefined
  success: boolean
  data: {
    items: Product[]
    total: number
    has_next_page: boolean
    next_offset: number
  }
}

interface Shop {
  shop_id: number
  shop_name: string
}

interface StockPrice {
  model_id: number;
  model_name: string;
  current_price: number;
  original_price: number;
  stock_info: {
    seller_stock: number;
    shopee_stock: Array<{
      stock: number;
      location_id: string;
    }>;
    total_reserved_stock: number;
    total_available_stock: number;
  };
  model_status: string;
  image_url: string | null;
}

interface VariationOption {
  id: number;
  name: string;
  image_url: string | null;
}

interface VariationData {
  variation_option: {
    options: VariationOption[];
    group_id: number | null;
  }
}

// Tambahkan interface untuk model dari API Shopee
interface ShopeeModel {
  model_id: number;
  model_name: string;
  price_info: {
    current_price: number;
    original_price: number;
  };
  stock_info: {
    seller_stock: number;
    shopee_stock: Array<{
      stock: number;
      location_id: string;
    }>;
    total_reserved_stock: number;
    total_available_stock: number;
  };
  model_status: string;
}

interface ShopeeVariation {
  variation_id: number;
  variation_name: string;
  variation_option_list: Array<{
    variation_option_id: number;
    variation_option_name: string;
    image_url: string | null;
  }>;
}

export function useProducts() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [isLoadingShops, setIsLoadingShops] = useState(false)
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [stockPrices, setStockPrices] = useState<StockPrice[]>([]);
  const [isLoadingStockPrices, setIsLoadingStockPrices] = useState(false);

  const loadShops = async () => {
    try {
      setIsLoadingShops(true)
      const shopsData = await getAllShops()
      setShops(shopsData)
    } catch (error) {
      toast.error('Gagal Memuat Toko', {
        description: 'Terjadi kesalahan saat memuat daftar toko',
      })
    } finally {
      setIsLoadingShops(false)
    }
  }

  const loadProducts = async () => {
    try {
      setIsLoadingProducts(true)
      
      // Ambil data token shop yang aktif
      const { data: shopTokens, error: shopError } = await supabase
        .from('shopee_tokens')
        .select('shop_id, shop_name')
        .eq('is_active', true)
      
      if (shopError) throw shopError

      // Ambil items
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .in('shop_id', shopTokens?.map(token => token.shop_id) || [])
      
      if (itemsError) throw itemsError

      // Transform data untuk menyesuaikan dengan interface Product
      const productsWithShops = items?.map(item => ({
        ...item,
        image_id_list: item.image.image_id_list || [],
        image_url_list: item.image.image_url_list || [],
        shopee_tokens: shopTokens?.filter(token => token.shop_id === item.shop_id) || []
      })) || []

      setProducts(productsWithShops)
    } catch (error) {
      toast.error('Gagal Memuat Produk', {
        description: error instanceof Error ? error.message : 'Terjadi kesalahan saat memuat daftar produk',
      })
    } finally {
      setIsLoadingProducts(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  const syncProducts = async (shopIds: number[], onProgress?: (progress: number) => void) => {
    try {
      setIsSyncing(true)
      let totalProducts = 0
      let processedProducts = 0

      // Proses setiap toko yang dipilih
      for (const shopId of shopIds) {
        const response = await fetch(`/api/produk?shop_id=${shopId}`)
        const data: SyncResponse = await response.json()

        if (data.success) {
          totalProducts += data.data.items.length

          // Simpan data produk ke Supabase
          for (const item of data.data.items) {
            // Insert/Update item utama
            const { error: itemError } = await supabase
              .from('items')
              .upsert({
                item_id: item.item_id,
                shop_id: shopId,
                category_id: item.category_id,
                item_name: item.item_name,
                description: item.description,
                item_sku: item.item_sku,
                create_time: item.create_time,
                update_time: item.update_time,
                weight: item.weight,
                image: item.image,
                logistic_info: item.logistic_info,
                pre_order: item.pre_order,
                condition: item.condition,
                item_status: item.item_status,
                has_model: item.has_model,
                brand: item.brand,
                item_dangerous: item.item_dangerous,
                description_type: item.description_type,
                size_chart_id: item.size_chart_id,
                promotion_image: item.promotion_image,
                deboost: item.deboost === 'FALSE' ? false : true,
                authorised_brand_id: item.authorised_brand_id
              }, { 
                onConflict: 'item_id' 
              })

            if (itemError) throw itemError

            processedProducts++
            
            // Update progress
            if (onProgress) {
              const progress = Math.round((processedProducts / totalProducts) * 100)
              onProgress(progress)
            }
          }
        } else {
          throw new Error(data.error)
        }
      }

      // Refresh products setelah sync selesai
      await loadProducts()

      toast.success('Sinkronisasi Berhasil', {
        description: `${processedProducts} produk telah disinkronkan`,
      })

      return {
        success: processedProducts,
        total: totalProducts
      }
    } catch (error) {
      toast.error('Gagal Sinkronisasi', {
        description: error instanceof Error ? error.message : 'Terjadi kesalahan saat sinkronisasi',
      })
      return {
        success: 0,
        total: 0
      }
    } finally {
      setIsSyncing(false)
    }
  }

  const getStockPrices = async (itemId: number): Promise<StockPrice[]> => {
    try {
      const product = products.find(p => p.item_id === itemId);
      if (!product?.shop_id) {
        throw new Error('Shop ID tidak ditemukan');
      }

      const response = await fetch(`/api/produk?shop_id=${product.shop_id}&item_id=${itemId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Gagal mengambil data produk');
      }

      const item = data.data.item;

      const stockPrices: StockPrice[] = item.models.map((model: ShopeeModel) => ({
        model_id: model.model_id,
        model_name: model.model_name,
        current_price: model.price_info.current_price,
        original_price: model.price_info.original_price,
        stock_info: {
          seller_stock: model.stock_info.seller_stock,
          shopee_stock: model.stock_info.shopee_stock || [],
          total_reserved_stock: model.stock_info.total_reserved_stock || 0,
          total_available_stock: model.stock_info.total_available_stock || 0
        },
        model_status: model.model_status,
        image_url: item.variations?.find((v: ShopeeVariation) => 
          v.variation_option_list?.some((opt) => 
            model.model_name.toUpperCase().includes(opt.variation_option_name.toUpperCase())
          )
        )?.variation_option_list?.find((opt: { variation_option_id: number; variation_option_name: string; image_url: string | null }) => 
          model.model_name.toUpperCase().includes(opt.variation_option_name.toUpperCase())
        )?.image_url || null
      }));

      return stockPrices;
      
    } catch (error) {
      toast.error('Gagal Memuat Data Stok dan Harga', {
        description: error instanceof Error ? error.message : 'Terjadi kesalahan saat memuat data'
      });
      return [];
    }
  };

  const updateStock = async (
    shopId: number,
    itemId: number,
    modelUpdates: Array<{
      modelId: number,
      newStock: number,
      reservedStock: number
    }>
  ) => {
    try {
      const response = await fetch('/api/produk/update-stock', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shop_id: shopId,
          item_id: itemId,
          stock_list: modelUpdates.map(update => ({
            model_id: update.modelId,
            seller_stock: [{
              stock: update.newStock
            }]
          }))
        })
      });

      const result = await response.json();

      // Jika ada failure_list, return detail kegagalan
      if (!result.success || (result.data?.failure_list?.length > 0)) {
        if (result.data?.failure_list?.length > 0) {
          return {
            success: false,
            failedModels: result.data.failure_list.map((fail: { model_id: any; failed_reason: any }) => ({
              modelId: fail.model_id,
              reason: fail.failed_reason
            })),
            message: result.warning || result.message || 'Terjadi kesalahan saat mengupdate stok'
          };
        }

        return {
          success: false,
          message: result.warning || result.message || 'Terjadi kesalahan saat mengupdate stok'
        };
      }

      return {
        success: true,
        message: 'Stok berhasil diupdate'
      };

    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Terjadi kesalahan saat mengupdate stok',
        error
      };
    }
  };

  const toggleProductStatus = async (
    shopId: number,
    items: Array<{
      item_id: number,
      unlist: boolean // true untuk nonaktif, false untuk aktif
    }>
  ) => {
    try {
      const response = await fetch('/api/produk/unlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shopId,
          items
        })
      });

      const result = await response.json();

      if (!result.success) {
        toast.error('Gagal Mengubah Status Produk', {
          description: result.message || 'Terjadi kesalahan saat mengubah status produk'
        });
        return result;
      }

      // Refresh data produk setelah berhasil
      await loadProducts();

      // Tampilkan notifikasi sukses
      const actionText = items[0]?.unlist ? 'dinonaktifkan' : 'diaktifkan';
      toast.success(`Produk Berhasil ${actionText}`, {
        description: `${items.length} produk telah diperbarui`
      });

      return result;

    } catch (error) {
      console.error('Error saat mengubah status produk:', error);
      toast.error('Gagal Mengubah Status Produk', {
        description: 'Terjadi kesalahan saat menghubungi server'
      });
      return {
        success: false,
        message: 'Terjadi kesalahan saat mengubah status produk'
      };
    }
  };

  return {
    products,
    isSyncing,
    syncProducts,
    shops,
    loadShops,
    isLoadingShops,
    isLoadingProducts,
    loadProducts,
    stockPrices,
    isLoadingStockPrices,
    getStockPrices,
    updateStock,
    toggleProductStatus
  }
}
