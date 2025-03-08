'use client';
import React from 'react';
import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { toast } from "sonner";

// Shadcn UI imports
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronDown, ChevronRight, Trash2, Store, Clock, Package } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

// Interfaces
interface UnqualifiedCondition {
  unqualified_code: number;
  unqualified_msg: string;
}

interface FailedItem {
  item_id: number;
  model_id: number;
  err_code?: number;
  err_msg: string;
  unqualified_conditions?: UnqualifiedCondition[];
}

interface FlashSaleItem {
  item_id: number;
  item_name: string;
  image: string;
}

interface Item {
  item_id: number;
  model_id: number;
  model_name: string;
  original_price: number;
  promotion_price_with_tax: number;
  input_promotion_price?: number;
  campaign_stock: number;
  purchase_limit: number;
  reject_reason: string;
  status: number;
  stock: number;
}

interface FlashSaleData {
  flash_sale_id: number;
  start_time: number;
  end_time: number;
  status: number;
  item_count: number;
  enabled_item_count: number;
  timeslot_id: number;
  type: number;
  items: FlashSaleItem[];
  models: Item[];
}

interface Product {
  item_id: number;
  item_name: string;
  item_sku: string;
  image: {
    image_id_list: any;
    image_url_list: string[];
  };
  models: {
    model_id: number;
    model_name: string;
    price_info: {
      current_price: number;
      original_price: number;
    };
    stock_info: {
      total_available_stock: number;
      seller_stock: number;
      total_reserved_stock: number;
    };
  }[];
}

// Helper functions di luar komponen
const formatTime = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
};

// Tambahkan fungsi helper untuk membulatkan ke ratusan terdekat
const roundToHundreds = (num: number) => {
  return Math.round(num / 100) * 100;
};

export default function FlashSaleDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const shopId = searchParams.get('shop_id');
  const flashSaleId = searchParams.get('flash_sale_id');
  const shopName = decodeURIComponent(searchParams.get('shop_name') || '');
  
  const [flashSaleData, setFlashSaleData] = useState<FlashSaleData | null>(null);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [collapsedItems, setCollapsedItems] = useState<Set<number>>(new Set());
  const [updateType, setUpdateType] = useState<'fixed' | 'percentage'>('fixed');
  const [promoPrice, setPromoPrice] = useState<number | null>(null);
  const [stockValue, setStockValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [activatedModels, setActivatedModels] = useState<Set<string>>(new Set());
  const [registeredItems, setRegisteredItems] = useState<Set<number>>(new Set());
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | number[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasLoadedProducts, setHasLoadedProducts] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modifikasi useEffect untuk menginisialisasi collapsedItems
  useEffect(() => {
    // Pastikan searchParams sudah tersedia
    if (!searchParams.has('shop_id') || !searchParams.has('flash_sale_id')) {
      return;
    }

    if (!shopId || !flashSaleId || isNaN(Number(shopId)) || isNaN(Number(flashSaleId))) {
      toast.error("Parameter shop_id dan flash_sale_id harus berupa angka yang valid");
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const flashSaleIdInt = Math.abs(parseInt(flashSaleId));
        const shopIdInt = Math.abs(parseInt(shopId));

        const [detailRes, itemsRes] = await Promise.all([
          fetch(`/api/flashsale/detail?shop_id=${shopIdInt}&flash_sale_id=${flashSaleIdInt}`),
          fetch(`/api/flashsale/detail_items?shop_id=${shopIdInt}&flash_sale_id=${flashSaleIdInt}`)
        ]);

        const [detailData, itemsData] = await Promise.all([
          detailRes.json(),
          itemsRes.json()
        ]);

        if (detailData.success && itemsData.success) {
          setFlashSaleData({
            ...detailData.data,
            items: itemsData.data.items,
            models: itemsData.data.models
          });

          // Set semua item dalam keadaan collapse dengan type yang eksplisit
          const allItemIds: Set<number> = new Set(
            itemsData.data.items.map((item: { item_id: number }) => item.item_id)
          );
          setCollapsedItems(allItemIds);

          // Set activated models dan registered items berdasarkan data yang ada
          const activatedSet = new Set<string>();
          const registeredSet = new Set<number>();

          itemsData.data.models.forEach((model: any) => {
            if (model.status === 1) {
              activatedSet.add(`${model.item_id}-${model.model_id}`);
            }
            registeredSet.add(model.item_id);
          });

          setActivatedModels(activatedSet);
          setRegisteredItems(registeredSet);
        }
      } catch (error) {
        toast.error("Gagal mengambil data flash sale");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [shopId, flashSaleId, searchParams]);

  // Tambahkan loading indicator
  if (loading) {
    return (
      <div className="p-6">
        <Card className="bg-white dark:bg-gray-800/50 rounded-none">
          <CardContent className="flex items-center justify-center h-[200px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-200 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-200">Memuat data flash sale...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pindahkan toggleAllItems ke dalam komponen
  const toggleAllItems = () => {
    // Filter hanya model dengan stok > 0
    const availableModelKeys = flashSaleData?.models
      .filter(model => model.stock > 0)
      .map(model => `${model.item_id}-${model.model_id}`) || [];
    
    const allSelected = availableModelKeys.every(key => selectedModels.has(key));
    
    if (allSelected) {
      setSelectedModels(new Set());
    } else {
      setSelectedModels(new Set(availableModelKeys));
    }
  };

  // Tambahkan fungsi helper untuk membedakan item terdaftar dan baru
  const isItemRegistered = (itemId: number) => {
    return registeredItems.has(itemId);
  };

  // Modifikasi handleActivateSingleModel
  const handleActivateSingleModel = async (itemId: number, modelId: number, isActive: boolean) => {
    try {
      if (!isActive) {
        // Nonaktifkan model (hanya untuk item yang sudah terdaftar)
        if (!isItemRegistered(itemId)) {
          toast.error("Tidak dapat menonaktifkan item yang belum terdaftar");
          return;
        }

        const response = await fetch('/api/flashsale/items/update', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shop_id: shopId,
            flash_sale_id: flashSaleId,
            items: [{
              item_id: itemId,
              models: [{
                model_id: modelId,
                status: 0
              }]
            }]
          })
        });

        const data = await response.json();
        
        if (data.success) {
          // Cek apakah ada failed items
          if (data.data?.failed_items?.length > 0) {
            const failedItem = data.data.failed_items[0];
            const errorMessages = failedItem.unqualified_conditions
              ?.map((condition: UnqualifiedCondition) => condition.unqualified_msg)
              .join(', ');
              
            toast.error(`Gagal menonaktifkan model: ${errorMessages || failedItem.err_msg}`);
            return;
          }

          // Update state hanya jika tidak ada error
          setActivatedModels(prev => {
            const next = new Set(prev);
            next.delete(`${itemId}-${modelId}`);
            return next;
          });

          setFlashSaleData(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              models: prev.models.map(m => {
                if (m.item_id === itemId && m.model_id === modelId) {
                  return { ...m, status: 0 } as Item;
                }
                return m;
              })
            };
          });

          toast.success("Model berhasil dinonaktifkan");
        } else {
          toast.error(data.message || "Gagal menonaktifkan model");
        }
      } else {
        const model = flashSaleData?.models.find(
          m => m.item_id === itemId && m.model_id === modelId
        );
        
        if (!model) return;

        // Cek apakah semua model dalam item ini tidak aktif
        const allModelsInactive = flashSaleData?.models
          .filter(m => m.item_id === itemId)
          .every(m => m.status === 0);

        // Tentukan endpoint dan body berdasarkan status registrasi dan status model
        const endpoint = isItemRegistered(itemId) 
          ? '/api/flashsale/items/update'
          : '/api/flashsale/items/add';

        const requestBody = isItemRegistered(itemId) 
          ? {
              shop_id: Number(shopId),
              flash_sale_id: Number(flashSaleId),
              items: [{
                item_id: itemId,
                // Sertakan purchase_limit jika semua model tidak aktif
                ...(allModelsInactive && { purchase_limit: 0 }),
                models: [{
                  model_id: modelId,
                  status: 1,
                  input_promo_price: model.input_promotion_price,
                  stock: model.campaign_stock
                }]
              }]
            }
          : {
              shop_id: Number(shopId),
              flash_sale_id: Number(flashSaleId),
              items: [{
                item_id: itemId,
                purchase_limit: 0,
                models: [{
                  model_id: modelId,
                  input_promo_price: model.input_promotion_price,
                  stock: model.campaign_stock
                }]
              }]
            };

        const response = await fetch(endpoint, {
          method: isItemRegistered(itemId) ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        
        if (data.success) {
          // Cek apakah ada failed items
          if (data.data?.failed_items?.length > 0) {
            const failedItem = data.data.failed_items[0];
            const errorMessages = failedItem.unqualified_conditions
              ?.map((condition: UnqualifiedCondition) => condition.unqualified_msg)
              .join(', ');
            
            toast.error(`Gagal mengaktifkan model: ${errorMessages || failedItem.err_msg}`);
            return;
          }

          // Update registeredItems jika ini item baru
          if (!isItemRegistered(itemId)) {
            setRegisteredItems(prev => {
              const next = new Set(prev);
              next.add(itemId);
              return next;
            });
          }

          // Update state
          setActivatedModels(prev => {
            const next = new Set(prev);
            next.add(`${itemId}-${modelId}`);
            return next;
          });

          setFlashSaleData(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              models: prev.models.map(m => {
                if (m.item_id === itemId && m.model_id === modelId) {
                  return { 
                    ...m, 
                    status: 1,
                    input_promotion_price: model.input_promotion_price,
                    campaign_stock: model.campaign_stock
                  } as Item;
                }
                return m;
              })
            };
          });

          toast.success("Model berhasil diaktifkan");
        } else {
          toast.error(data.message || "Gagal mengaktifkan model");
        }
      }
    } catch (error) {
      toast.error(`Terjadi kesalahan saat ${isActive ? 'mengaktifkan' : 'menonaktifkan'} model`);
    }
  };

  // Modifikasi fungsi handleMassUpdate
  const handleMassUpdate = (field: 'promotion_price' | 'stock' | 'discount', value: number) => {
    if (selectedModels.size === 0) return;

    setFlashSaleData(prev => {
      if (!prev) return prev;
      
      return {
        ...prev,
        models: prev.models.map(model => {
          // Cek apakah model ini termasuk yang dipilih
          if (selectedModels.has(`${model.item_id}-${model.model_id}`)) {
            let updateValue = value;
            
            // Hitung harga diskon jika tipe update adalah discount
            if (field === 'discount') {
              // Hitung harga setelah diskon dan bulatkan ke ratusan terdekat
              updateValue = roundToHundreds(model.original_price * (1 - value / 100));
            }

            return {
              ...model,
              // Update input_promotion_price jika field adalah promotion_price atau discount
              input_promotion_price: field === 'promotion_price' || field === 'discount' 
                ? updateValue 
                : model.input_promotion_price,
              // Update campaign_stock jika field adalah stock
              campaign_stock: field === 'stock' 
                ? updateValue 
                : model.campaign_stock
            };
          }
          return model;
        })
      };
    });

    toast.success(`${selectedModels.size} model berhasil diperbarui`);
  };

  // Tambahkan fungsi untuk toggle model selection
  const toggleModelSelection = (itemId: number, modelId: number) => {
    const modelKey = `${itemId}-${modelId}`;
    const newSelected = new Set(selectedModels);
    if (newSelected.has(modelKey)) {
      newSelected.delete(modelKey);
    } else {
      newSelected.add(modelKey);
    }
    setSelectedModels(newSelected);
  };

  // Tambahkan fungsi untuk toggle semua model dalam satu item
  const toggleAllModels = (itemId: number, models: any[]) => {
    const newSelected = new Set(selectedModels);
    // Filter hanya model dengan stok > 0
    const availableModels = models.filter(model => model.stock > 0);
    const allModelKeys = availableModels.map(model => `${itemId}-${model.model_id}`);
    
    // Check if all available models are already selected
    const allSelected = availableModels.every(model => 
      newSelected.has(`${itemId}-${model.model_id}`)
    );
    
    if (allSelected) {
      // Unselect all models of this item
      allModelKeys.forEach(key => newSelected.delete(key));
    } else {
      // Select all available models of this item
      allModelKeys.forEach(key => newSelected.add(key));
    }
    
    setSelectedModels(newSelected);
  };

  // Modifikasi handleMassActivation
  const handleMassActivation = async (activate: boolean) => {
    try {
      const modelKeys = Array.from(selectedModels);
      const registeredModels: any[] = [];
      const newModels: any[] = [];

      // Buat Map untuk mengelompokkan model berdasarkan item_id
      const itemModelsMap = new Map<number, {
        models: any[],
        allInactive: boolean
      }>();

      // Pertama, kelompokkan model berdasarkan item_id dan filter model yang perlu diupdate
      modelKeys.forEach(key => {
        const [itemId, modelId] = key.split('-').map(Number);
        const model = flashSaleData?.models.find(
          m => m.item_id === itemId && m.model_id === modelId
        );

        // Skip jika model tidak ditemukan atau status sudah sesuai
        if (!model || (activate ? model.status === 1 : model.status === 0)) return;

        if (!itemModelsMap.has(itemId)) {
          // Cek apakah semua model dalam item ini tidak aktif
          const allItemModels = flashSaleData?.models.filter(m => m.item_id === itemId) || [];
          const allInactive = allItemModels.length > 0 ? allItemModels.every(m => m.status === 0) : true;
          
          itemModelsMap.set(itemId, {
            models: [],
            allInactive
          });
        }

        const itemData = itemModelsMap.get(itemId);
        if (itemData) {
          itemData.models.push(model);
        }
      });

      // Jika tidak ada model yang perlu diupdate, keluar dari fungsi
      if (itemModelsMap.size === 0) {
        toast.info(`Tidak ada model yang perlu di${activate ? 'aktifkan' : 'nonaktifkan'}`);
        return;
      }

      // Sisa kode sama seperti sebelumnya...
      itemModelsMap.forEach((itemData, itemId) => {
        if (isItemRegistered(itemId)) {
          // Untuk item yang sudah terdaftar
          const modelData = itemData.models.map(model => 
            activate ? {
              model_id: model.model_id,
              status: 1,
              input_promo_price: model.input_promotion_price,
              stock: model.campaign_stock
            } : {
              model_id: model.model_id,
              status: 0
            }
          );

          if (modelData.length > 0) {
            registeredModels.push({
              item_id: itemId,
              ...(itemData.allInactive && activate && { purchase_limit: 0 }),
              models: modelData
            });
          }
        } else if (activate) {
          // Untuk item baru
          newModels.push({
            item_id: itemId,
            purchase_limit: 0,
            models: itemData.models.map(model => ({
              model_id: model.model_id,
              input_promo_price: model.input_promotion_price,
              stock: model.campaign_stock
            }))
          });
        }
      });

      // Lanjutkan dengan kode yang ada untuk mengirim request...
      const requests = [];
      
      if (registeredModels.length > 0) {
        requests.push(
          fetch('/api/flashsale/items/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shop_id: shopId,
              flash_sale_id: flashSaleId,
              items: registeredModels
            })
          })
        );
      }

      if (newModels.length > 0) {
        requests.push(
          fetch('/api/flashsale/items/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shop_id: shopId,
              flash_sale_id: flashSaleId,
              items: newModels
            })
          })
        );
      }

      // Eksekusi semua request (bisa items/add dan/atau items/update)
      const responses = await Promise.all(requests);
      const results = await Promise.all(responses.map(r => r.json()));

      // Inisialisasi Set baru dari registeredItems yang ada
      const newRegisteredItems = new Set(registeredItems);

      // Kumpulkan semua failed items dari semua response
      const failedItems = new Set(
        results.flatMap(result => 
          result.data?.failed_items?.map((item: FailedItem) => 
            `${item.item_id}-${item.model_id}`
          ) || []
        )
      );

      // Proses setiap hasil
      let successCount = 0;
      let failedCount = failedItems.size;

      results.forEach(result => {
        if (result.success) {
          if (activate) {
            // Untuk request items/add, tambahkan item ke registeredItems 
            // hanya jika setidaknya satu model berhasil
            newModels.forEach(item => {
              const hasSuccessfulModel = item.models.some((model: { model_id: number }) => 
                !failedItems.has(`${item.item_id}-${model.model_id}`)
              );
              if (hasSuccessfulModel) {
                newRegisteredItems.add(item.item_id);
              }
            });
          }

          // Update model status, skip yang gagal
          modelKeys.forEach(key => {
            // Skip update jika model ini gagal
            if (failedItems.has(key)) return;

            const [itemId, modelId] = key.split('-').map(Number);
            
            if (activate) {
              setActivatedModels(prev => {
                const next = new Set(prev);
                next.add(`${itemId}-${modelId}`);
                return next;
              });
            } else {
              setActivatedModels(prev => {
                const next = new Set(prev);
                next.delete(`${itemId}-${modelId}`);
                return next;
              });
            }

            // Update flashSaleData
            setFlashSaleData(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                models: prev.models.map(m => {
                  if (m.item_id === itemId && m.model_id === modelId) {
                    const model = flashSaleData?.models.find(
                      fm => fm.item_id === itemId && fm.model_id === modelId
                    );
                    
                    if (activate && model) {
                      return { 
                        ...m,
                        status: 1,
                        input_promotion_price: model.input_promotion_price || model.promotion_price_with_tax,
                        campaign_stock: model.campaign_stock || 0
                      } as Item;
                    } else {
                      return {
                        ...m,
                        status: 0
                      } as Item;
                    }
                  }
                  return m;
                })
              };
            });
          });

          // Tampilkan pesan error untuk failed items
          if (failedItems.size > 0) {
            const errorMessages = results
              .flatMap(result => 
                result.data?.failed_items?.map((item: FailedItem) => 
                  `Model ${item.model_id}: ${item.err_msg}`
                ) || []
              )
              .join('\n');

            toast.error(`Beberapa model gagal diaktifkan: ${errorMessages}`);
          }

          successCount = modelKeys.length - failedCount;
        } else {
          failedCount = modelKeys.length;
          toast.error(`Gagal memperbarui item: ${result.message || "Gagal memperbarui item"}`);
        }
      });

      // Update registeredItems setelah semua proses selesai
      setRegisteredItems(newRegisteredItems);

      // Tampilkan notifikasi sukses jika ada
      if (successCount > 0) {
        toast.success(`${successCount} model berhasil ${activate ? 'diaktifkan' : 'dinonaktifkan'}`);
      }

    } catch (error) {
      toast.error(`Gagal ${activate ? 'mengaktifkan' : 'menonaktifkan'} item`);
    }
  };

  // Modifikasi fungsi handleAddProduct
  const handleAddProduct = () => {
    setIsProductDialogOpen(true);
    
    // Hanya ambil data jika belum pernah diambil sebelumnya
    if (!hasLoadedProducts) {
      fetchProducts();
    }
  };

  // Pisahkan logika fetch products ke fungsi terpisah
  const fetchProducts = async () => {
    if (!shopId) return;
    
    setLoadingProducts(true);
    try {
      const response = await fetch(`/api/produk?shop_id=${shopId}`);
      const data = await response.json();
      
      if (data.success) {
        setProducts(data.data.items);
        setHasLoadedProducts(true);
      } else {
        toast.error('Gagal mengambil daftar produk');
      }
    } catch (error) {
      toast.error('Terjadi kesalahan saat mengambil data produk');
    } finally {
      setLoadingProducts(false);
      setIsRefreshing(false);
    }
  };

  // Tambahkan fungsi untuk refresh data
  const handleRefreshProducts = () => {
    setIsRefreshing(true);
    fetchProducts();
  };

  // Fungsi untuk menangani pemilihan produk
  const handleProductSelect = (productId: number) => {
    const newSelected = new Set(selectedProductIds);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProductIds(newSelected);
  };

  // Fungsi untuk menangani pemilihan semua produk
  const handleSelectAllProducts = () => {
    if (selectedProductIds.size === products.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(products.map(p => p.item_id)));
    }
  };

  // Fungsi untuk menangani konfirmasi penambahan produk
  const handleConfirmProducts = async () => {
    const selectedProducts = products.filter(p => selectedProductIds.has(p.item_id));
    
    // Buat array untuk items baru dengan type FlashSaleItem
    const newItems: FlashSaleItem[] = selectedProducts.map(product => ({
      item_id: product.item_id,
      item_name: product.item_name,
      image: product.image.image_id_list[0]
    }));

    // Buat array untuk models baru dengan type Item
    const newModels: Item[] = selectedProducts.flatMap(product => 
      product.models.map(model => ({
        item_id: product.item_id,
        model_id: model.model_id,
        model_name: model.model_name,
        original_price: model.price_info.original_price,
        promotion_price_with_tax: model.price_info.current_price,
        input_promotion_price: model.price_info.current_price,
        campaign_stock: Math.min(20, (model.stock_info?.seller_stock ?? 0) - (model.stock_info?.total_reserved_stock ?? 0)),
        purchase_limit: 0,
        reject_reason: "",
        status: 0,
        stock: model.stock_info?.seller_stock ?? 0
      }))
    );

    setFlashSaleData(prev => {
      if (!prev) return prev;

      const existingItemIds = new Set(prev.items.map(item => item.item_id));
      const filteredNewItems = newItems.filter(item => !existingItemIds.has(item.item_id));

      const existingModelKeys = new Set(
        prev.models.map(model => `${model.item_id}-${model.model_id}`)
      );
      const filteredNewModels = newModels.filter(
        model => !existingModelKeys.has(`${model.item_id}-${model.model_id}`)
      );

      return {
        ...prev,
        // Tempatkan item baru di awal array
        items: [...filteredNewItems, ...prev.items],
        // Tempatkan model baru di awal array
        models: [...filteredNewModels, ...prev.models]
      };
    });

    setIsProductDialogOpen(false);
    setSelectedProductIds(new Set());

    toast.success(`${newModels.length} model produk berhasil ditambahkan`);
  };

  // Tambahkan fungsi untuk menghapus item
  const handleDeleteItems = async () => {
    if (selectedModels.size === 0) return;

    const itemIds = Array.from(selectedModels).map(key => parseInt(key.split('-')[0]));
    const uniqueItemIds = Array.from(new Set(itemIds));
    
    // Buka dialog dengan menyimpan items yang akan dihapus
    setItemToDelete(uniqueItemIds);
    setDeleteDialogOpen(true);
  };

  // Tambahkan fungsi untuk menghapus single item
  const handleDeleteSingleItem = (itemId: number) => {
    setItemToDelete(itemId);
    setDeleteDialogOpen(true);
  };

  // Tambahkan fungsi untuk mengeksekusi penghapusan
  const executeDelete = async () => {
    if (!itemToDelete) return;

    setIsDeleting(true);
    try {
      const itemIds = Array.isArray(itemToDelete) ? itemToDelete : [itemToDelete];
      
      // Pisahkan item yang terdaftar dan belum terdaftar
      const registeredItemIds = itemIds.filter(id => registeredItems.has(id));
      const unregisteredItemIds = itemIds.filter(id => !registeredItems.has(id));
      
      // Jika ada item terdaftar, hapus melalui API
      if (registeredItemIds.length > 0) {
        const response = await fetch(
          `/api/flashsale/items/delete?shop_id=${shopId}&flash_sale_id=${flashSaleId}&item_ids=${registeredItemIds.join(',')}`,
          { method: 'DELETE' }
        );
        const data = await response.json();

        if (!data.success) {
          toast.error(`Gagal menghapus item: ${data.message || "Gagal menghapus item"}`);
          return;
        }
      }

      // Update state untuk semua item (terdaftar dan tidak terdaftar)
      setFlashSaleData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.filter(item => !itemIds.includes(item.item_id)),
          models: prev.models.filter(model => !itemIds.includes(model.item_id))
        };
      });

      // Update registered items untuk item yang terdaftar
      if (registeredItemIds.length > 0) {
        setRegisteredItems(prev => {
          const next = new Set(prev);
          registeredItemIds.forEach(id => next.delete(id));
          return next;
        });
      }

      // Update selected models
      setSelectedModels(prev => {
        const next = new Set(prev);
        itemIds.forEach(itemId => {
          Array.from(prev).forEach(key => {
            if (key.startsWith(`${itemId}-`)) {
              next.delete(key);
            }
          });
        });
        return next;
      });

      // Tampilkan pesan sukses yang sesuai
      if (registeredItemIds.length > 0 && unregisteredItemIds.length > 0) {
        toast.success(`${registeredItemIds.length} item berhasil dihapus dari flash sale dan ${unregisteredItemIds.length} item dihapus dari tabel`);
      } else if (registeredItemIds.length > 0) {
        toast.success(`${registeredItemIds.length} item berhasil dihapus dari flash sale`);
      } else {
        toast.success(`${unregisteredItemIds.length} item berhasil dihapus dari tabel`);
      }

    } catch (error) {
      toast.error("Terjadi kesalahan saat menghapus item");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  // Tambahkan fungsi helper untuk menghitung diskon
  const calculateDiscount = (originalPrice: number, promoPrice: number) => {
    if (!originalPrice || !promoPrice) return 0;
    const discount = ((originalPrice - promoPrice) / originalPrice) * 100;
    return Math.round(discount); // Bulatkan ke angka terdekat
  };

  // Render komponen
  return (
    
      <Card className="bg-white dark:bg-gray-800/50 rounded-none">
        <CardContent className="pt-6 px-4 sm:px-6">
          {/* Info Flash Sale - Responsif Grid */}
          <div className="bg-white dark:bg-gray-800/80 rounded-lg shadow-sm border dark:border-gray-700/50 p-3 sm:p-4 mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
              <h2 className="text-lg font-semibold dark:text-gray-200">Detail Flash Sale</h2>
              <Badge 
                variant="secondary" 
                className="bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-3 py-0.5 text-xs"
              >
                Aktif
              </Badge>
            </div>
            
            {/* Grid yang responsif */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Kolom Kiri */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">ID Flash Sale</label>
                  <p className="text-sm font-mono dark:text-gray-200">{flashSaleId}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">ID Time Slot</label>
                  <p className="text-sm font-mono dark:text-gray-200">{flashSaleData?.timeslot_id}</p>
                </div>
              </div>

              {/* Kolom Tengah */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Store className="w-4 h-4 text-gray-400" />
                    <label className="text-xs text-gray-500 dark:text-gray-400">Toko</label>
                  </div>
                  <p className="text-sm dark:text-gray-200">{shopName}</p>
                </div>
                
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <label className="text-xs text-gray-500 dark:text-gray-400">Waktu Flash Sale</label>
                  </div>
                  <p className="text-sm dark:text-gray-200">
                    {flashSaleData && format(new Date(flashSaleData.start_time * 1000), "MMMM do, yyyy")}
                    <span className="text-gray-500 dark:text-gray-400 ml-2">
                      {flashSaleData && `${formatTime(flashSaleData.start_time)} - ${formatTime(flashSaleData.end_time)}`}
                    </span>
                  </p>
                </div>
              </div>

              {/* Kolom Kanan */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Package className="w-4 h-4 text-gray-400" />
                    <label className="text-xs text-gray-500 dark:text-gray-400">Total Produk</label>
                  </div>
                  <p className="text-sm font-medium dark:text-gray-200">{flashSaleData?.item_count ?? 0} Produk</p>
                </div>
                
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">Status Produk</label>
                  <p className="text-sm font-medium dark:text-gray-200">{flashSaleData?.enabled_item_count ?? 0} Aktif</p>
                </div>
              </div>
            </div>
          </div>

          {/* Mass Update Controls - Responsif */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3 sm:p-5 bg-white dark:bg-gray-800/95 rounded-lg shadow-sm border dark:border-gray-700/50 mb-6">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Mass Update
              </span>
              <Badge 
                variant="secondary" 
                className="bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600/50 w-[140px] flex items-center justify-center"
              >
                {selectedModels.size} model terpilih
              </Badge>
            </div>

            <div className="hidden sm:block h-4 w-px bg-gray-200 dark:bg-gray-700/50 mx-2" />

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full">
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <Select 
                    onValueChange={(value: 'fixed' | 'percentage') => {
                      setUpdateType(value);
                      setPromoPrice(null);
                    }}
                    value={updateType}
                  >
                    <SelectTrigger className="h-9 text-sm bg-white dark:bg-gray-700/50 dark:text-gray-200 w-full sm:w-[100px] shrink-0">
                      <SelectValue placeholder="Harga" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Harga</SelectItem>
                      <SelectItem value="percentage">Diskon</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    type="number"
                    placeholder={updateType === 'fixed' ? "Harga" : "%"}
                    className="h-9 text-sm w-full sm:w-32 dark:bg-gray-700/50 dark:border-gray-600/50 dark:text-gray-200 dark:placeholder-gray-400"
                    value={promoPrice || ''}
                    min={0}
                    max={updateType === 'percentage' ? 100 : undefined}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value)) {
                        setPromoPrice(value);
                      }
                    }}
                  />

                  <Input
                    type="number"
                    placeholder="Stok"
                    className="h-9 text-sm w-full sm:w-32 dark:bg-gray-700/50 dark:border-gray-600/50 dark:text-gray-200 dark:placeholder-gray-400"
                    value={stockValue || ''}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value)) {
                        setStockValue(value);
                      }
                    }}
                  />

                  <Button
                    type="button"
                    onClick={() => {
                      if (promoPrice !== null) {
                        if (updateType === 'fixed') {
                          handleMassUpdate('promotion_price', promoPrice);
                        } else {
                          handleMassUpdate('discount', promoPrice);
                        }
                      }
                      if (stockValue !== null) {
                        handleMassUpdate('stock', stockValue);
                      }
                    }}
                    disabled={selectedModels.size === 0}
                    className="h-9 w-full sm:w-auto bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-800"
                  >
                    Update
                  </Button>
                </div>
              </div>

              <div className="hidden sm:block h-4 w-px bg-gray-200 dark:bg-gray-700/50 mx-2" />

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:ml-auto">
                <Button
                  onClick={() => handleMassActivation(true)}
                  className="h-9 w-full sm:w-auto bg-emerald-500 text-white hover:bg-emerald-600"
                  disabled={selectedModels.size === 0}
                >
                  Aktifkan
                </Button>

                <Button
                  onClick={() => handleMassActivation(false)}
                  className="h-9 w-full sm:w-auto bg-rose-500 text-white hover:bg-rose-600"
                  disabled={selectedModels.size === 0}
                >
                  Nonaktifkan
                </Button>

                <Button
                  onClick={handleDeleteItems}
                  className="h-9 w-full sm:w-auto bg-red-600 text-white hover:bg-red-700"
                  disabled={selectedModels.size === 0 || isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Menghapus...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Hapus Item
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Tambahkan tombol Tambah Produk */}
          <div className="mb-4">
            <Button
              type="button"
              onClick={handleAddProduct}
              className="bg-black dark:bg-gray-700/90 text-white hover:bg-black/90 dark:hover:bg-gray-600/90 dark:border-gray-600/50"
            >
              + Tambah Produk
            </Button>
          </div>

          {/* Table responsif dengan scroll horizontal */}
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <Table className="border dark:border-gray-700/50 rounded-lg min-w-[800px]">
              <TableHeader className="bg-gray-50 dark:bg-gray-800/90">
                <TableRow className="border-b dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700/50">
                  <TableHead className="font-medium dark:text-gray-300">
                    <Checkbox
                      checked={flashSaleData?.models && flashSaleData.models.length > 0 && 
                        flashSaleData.models.every(model => 
                          selectedModels.has(`${model.item_id}-${model.model_id}`)
                        )}
                      onCheckedChange={toggleAllItems}
                    />
                  </TableHead>
                  <TableHead className="font-medium dark:text-gray-300">Nama Produk</TableHead>
                  <TableHead className="font-medium dark:text-gray-300">Harga Normal</TableHead>
                  <TableHead className="font-medium dark:text-gray-300">Harga Saat Ini</TableHead>
                  <TableHead className="font-medium dark:text-gray-300">Harga Promo</TableHead>
                  <TableHead className="font-medium dark:text-gray-300">Diskon %</TableHead>
                  <TableHead className="font-medium dark:text-gray-300">Stok Tersedia</TableHead>
                  <TableHead className="font-medium dark:text-gray-300">Stok Flash Sale</TableHead>
                  <TableHead className="font-medium dark:text-gray-300">Status</TableHead>
                  
                </TableRow>
              </TableHeader>
              <TableBody>
                {flashSaleData?.items.map((item: any) => {
                  const itemModels = flashSaleData.models.filter(
                    (model: any) => model.item_id === item.item_id
                  );
                  
                  return (
                    <React.Fragment key={item.item_id}>
                      {/* Item row */}
                      <TableRow className="border-b dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/90">
                        <TableCell colSpan={9}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={itemModels.every(model => 
                                    selectedModels.has(`${item.item_id}-${model.model_id}`)
                                  )}
                                  onCheckedChange={() => toggleAllModels(item.item_id, itemModels)}
                                />
                                <button 
                                  onClick={() => {
                                    setCollapsedItems(prev => {
                                      const next = new Set(prev);
                                      if (next.has(item.item_id)) {
                                        next.delete(item.item_id);
                                      } else {
                                        next.add(item.item_id);
                                      }
                                      return next;
                                    });
                                  }}
                                  type="button"
                                  className="p-0.5 hover:bg-gray-200 rounded-sm transition-colors"
                                >
                                  {collapsedItems.has(item.item_id) ? (
                                    <ChevronRight className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                              <div className="relative w-8 h-8">
                                <img 
                                  src={`https://down-id.img.susercontent.com/${item.image}`}
                                  alt={item.item_name}
                                  className="object-cover rounded-md w-full h-full"
                                  onError={(e) => {
                                    e.currentTarget.src = '/placeholder-image.jpg';
                                  }}
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{item.item_name}</span>
                                {isItemRegistered(item.item_id) ? (
                                  <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                                    Terdaftar
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400 rounded-full">
                                    Belum Terdaftar
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <Button
                              onClick={() => handleDeleteSingleItem(item.item_id)}
                              variant="ghost"
                              className="h-8 px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                              disabled={isDeleting}
                            >
                              {isDeleting && itemToDelete === item.item_id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-2" />
                              ) : (
                                <Trash2 className="h-4 w-4 mr-1" />
                              )}
                              {isDeleting && itemToDelete === item.item_id ? 'Menghapus...' : 'Hapus'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Model rows */}
                      {!collapsedItems.has(item.item_id) && 
                        [...itemModels] // Buat copy array untuk diurutkan
                          .sort((a, b) => a.model_name.localeCompare(b.model_name)) // Urutkan berdasarkan model_name
                          .map((model: any) => (
                            <TableRow 
                              key={`${model.item_id}-${model.model_id}`} 
                              className="border-b dark:border-gray-700/50"
                            >
                              <TableCell>
                                <Checkbox
                                  checked={selectedModels.has(`${model.item_id}-${model.model_id}`)}
                                    onCheckedChange={() => toggleModelSelection(model.item_id, model.model_id)}
                                    disabled={model.stock === 0}
                                  />
                              </TableCell>
                              <TableCell>{model.model_name}</TableCell>
                              <TableCell>{formatRupiah(model.original_price)}</TableCell>
                              <TableCell>{formatRupiah(model.promotion_price_with_tax || model.promotion_price)}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={model.input_promotion_price || model.promotion_price_with_tax}
                                  className="w-28 h-9 dark:bg-gray-700/50 dark:border-gray-600/50 dark:text-gray-200 dark:placeholder-gray-400 dark:focus:border-blue-500/70 dark:focus:ring-blue-500/20"
                                  disabled={activatedModels.has(`${model.item_id}-${model.model_id}`)}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value);
                                    if (!isNaN(value)) {
                                      const updatedModels = flashSaleData.models.map((m: any) => {
                                        if (m.item_id === model.item_id && m.model_id === model.model_id) {
                                          return { ...m, input_promotion_price: value };
                                        }
                                        return m;
                                      });
                                      setFlashSaleData({ ...flashSaleData, models: updatedModels });
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                {/* Kolom Diskon % */}
                                {model.input_promotion_price ? (
                                  <span className="text-emerald-500 dark:text-emerald-400 font-medium">
                                    {calculateDiscount(model.original_price, model.input_promotion_price)}%
                                  </span>
                                ) : (
                                  <span className="text-emerald-500 dark:text-emerald-400 font-medium">
                                    {calculateDiscount(model.original_price, model.promotion_price_with_tax)}%
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>{model.stock}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={model.campaign_stock}
                                  className="w-24 h-9 dark:bg-gray-700/50 dark:border-gray-600/50 dark:text-gray-200 dark:placeholder-gray-400 dark:focus:border-blue-500/70 dark:focus:ring-blue-500/20"
                                  disabled={activatedModels.has(`${model.item_id}-${model.model_id}`)}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value);
                                    if (!isNaN(value)) {
                                      const updatedModels = flashSaleData.models.map((m: any) => {
                                        if (m.item_id === model.item_id && m.model_id === model.model_id) {
                                          return { ...m, campaign_stock: value };
                                        }
                                        return m;
                                      });
                                      setFlashSaleData({ ...flashSaleData, models: updatedModels });
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <Switch
                                  checked={model.status === 1}
                                  onCheckedChange={(checked) => 
                                    handleActivateSingleModel(
                                      model.item_id, 
                                      model.model_id, 
                                      checked
                                    )
                                  }
                                  className="
                                    data-[state=checked]:bg-blue-600 
                                    data-[state=unchecked]:bg-gray-700/50
                                    dark:data-[state=checked]:bg-blue-500/90
                                    dark:data-[state=unchecked]:bg-gray-600/40
                                    dark:border-gray-600/50
                                    hover:data-[state=checked]:bg-blue-600/90
                                    hover:data-[state=unchecked]:bg-gray-600/60
                                    transition-colors
                                    duration-200
                                  "
                                />
                              </TableCell>
                            </TableRow>
                          ))
                      }
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Tambahkan Dialog Produk */}
          <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
            <DialogContent className="sm:max-w-[900px] dark:bg-gray-800/95 dark:backdrop-blur-sm">
              <DialogHeader>
                <div className="flex justify-between items-center">
                  <DialogTitle className="dark:text-gray-200">Pilih Produk</DialogTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshProducts}
                    disabled={isRefreshing || loadingProducts}
                    className="flex items-center gap-2"
                  >
                    {(isRefreshing || loadingProducts) ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black" />
                        Memuat...
                      </>
                    ) : (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <path d="M21 2v6h-6" />
                          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                          <path d="M3 22v-6h6" />
                          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                        </svg>
                        Refresh
                      </>
                    )}
                  </Button>
                </div>
              </DialogHeader>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Cari produk..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 dark:bg-gray-700/50 dark:border-gray-600/50 dark:text-gray-200 dark:placeholder-gray-400 dark:focus:border-blue-500/70 dark:focus:ring-blue-500/20"
                />
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedProductIds.size === products.length}
                          onCheckedChange={handleSelectAllProducts}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableHead>
                      <TableHead className="w-[100px]">Gambar</TableHead>
                      <TableHead>Nama Produk</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Harga Terendah</TableHead>
                      <TableHead>Total Stok</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => {
                      const lowestPrice = Math.min(...product.models.map(m => m.price_info.current_price));
                      const totalStock = product.models.reduce((sum, m) => sum + m.stock_info.total_available_stock, 0);
                      const isExisting = flashSaleData?.items.some(item => item.item_id === product.item_id) ?? false;
                      
                      return (
                        <TableRow 
                          key={product.item_id} 
                          className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${isExisting ? 'opacity-50' : ''}`}
                          onClick={() => !isExisting && handleProductSelect(product.item_id)}
                        >
                          <TableCell className="w-[50px]">
                            <Checkbox
                              checked={selectedProductIds.has(product.item_id)}
                              onCheckedChange={() => !isExisting && handleProductSelect(product.item_id)}
                              disabled={isExisting}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </TableCell>
                          <TableCell className="w-[100px] p-4">
                            {product.image?.image_url_list?.[0] && (
                              <div className="relative w-16 h-16">
                                <img 
                                  src={product.image.image_url_list[0]}
                                  alt={product.item_name}
                                  className="object-cover rounded-md w-full h-full"
                                  onError={(e) => {
                                    e.currentTarget.src = '/placeholder-image.jpg';
                                  }}
                                />
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {product.item_name}
                              {isExisting}
                            </div>
                          </TableCell>
                          <TableCell>{product.item_sku}</TableCell>
                          <TableCell>{formatRupiah(lowestPrice)}</TableCell>
                          <TableCell>{totalStock}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center gap-3 mt-4 pt-4 border-t dark:border-gray-700/50">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedProductIds.size} produk terpilih
                </span>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsProductDialogOpen(false);
                      setSelectedProductIds(new Set());
                    }}
                  >
                    Batal
                  </Button>
                  <Button
                    onClick={handleConfirmProducts}
                    disabled={selectedProductIds.size === 0}
                    className="bg-black dark:bg-gray-700/90 text-white hover:bg-black/90 dark:hover:bg-gray-600/90 dark:border-gray-600/50"
                  >
                    Tambahkan Produk
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Tambahkan Alert Dialog */}
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent className="dark:bg-gray-800/95 dark:backdrop-blur-sm">
              <AlertDialogHeader>
                <AlertDialogTitle className="dark:text-gray-200">Konfirmasi Penghapusan</AlertDialogTitle>
                <AlertDialogDescription className="dark:text-gray-400">
                  {Array.isArray(itemToDelete) ? (
                    <>
                      Apakah Anda yakin ingin menghapus {itemToDelete.length} item yang dipilih dari flash sale ini?
                      <br />
                      Tindakan ini tidak dapat dibatalkan.
                    </>
                  ) : (
                    <>
                      Apakah Anda yakin ingin menghapus item ini dari flash sale?
                      <br />
                      Tindakan ini tidak dapat dibatalkan.
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
                <AlertDialogAction
                  onClick={executeDelete}
                  disabled={isDeleting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Menghapus...
                    </>
                  ) : (
                    'Ya, Hapus'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    
  );
}