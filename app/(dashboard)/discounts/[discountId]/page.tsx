'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSearchParams } from 'next/navigation';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, Search, Trash2, Store, Calendar, Tag, ArrowLeft } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableHeader,
  TableBody,
  TableCell,
  TableRow,
  TableHead
} from "@/components/ui/table"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useUserData } from "@/contexts/UserDataContext";
import Link from "next/link";

interface ModelChanges {
    [key: number]: {
      price: number;
      previousPrice?: number;
    }
  }
interface ModelDetail {
  model_id: number;
  model_name: string;
  model_normal_stock: number;
  model_original_price: number;
  model_promotion_price: number;
  model_promotion_stock: number;
  in_promotion?: boolean;
}

interface ItemDetail {
  item_id: number;
  item_name: string;
  item_original_price: number;
  item_promotion_price: number;
  item_promotion_stock: number;
  model_list: ModelDetail[];
  normal_stock: number;
  purchase_limit: number;
  image_url?: string | null;
}

interface DiscountDetail {
  discount_id: number;
  discount_name: string;
  end_time: number;
  start_time: number;
  status: string;
  item_list: ItemDetail[];
  more: boolean;
  source: number;
}

interface Product {
  item_id: number;
  item_name: string;
  item_sku: string;
  image: {
    image_url_list: string[];
  };
  models: {
    model_id: number;
    model_name: string;
    model_original_price: number;
    model_promotion_price: number;
    model_normal_stock: number;
    price_info?: {
      current_price: number;
    };
    stock_info?: {
      summary_info?: {
        total_available_stock: number;
      };
      seller_stock: number;
    };
  }[];
}

export default function DiscountDetailPage({ params }: { params: { discountId: string } }) {
  const searchParams = useSearchParams();
  const shopId = searchParams.get('shopId');
  const { shops } = useUserData();
  const shopInfo = shops.find(shop => shop.shop_id.toString() === shopId);
  const [discount, setDiscount] = useState<DiscountDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changes, setChanges] = useState<ModelChanges>({});
  const [isSaving, setIsSaving] = useState(false);
  const [selectedModels, setSelectedModels] = useState<number[]>([]);
  const [massUpdateType, setMassUpdateType] = useState<'price' | 'discount'>('price');
  const [massUpdateValue, setMassUpdateValue] = useState<string>('');
  const [modelFilter, setModelFilter] = useState<string[]>(['all']);
  const [sizeFilter, setSizeFilter] = useState<string[]>(['all']);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [sizeDropdownOpen, setSizeDropdownOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<number[]>([]);
  const [newItemIds, setNewItemIds] = useState<Set<number>>(new Set());

  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());
  const [hasLoadedProducts, setHasLoadedProducts] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | number[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const getCheckedItemIds = () => {
    if (!discount?.item_list) return [];
    
    return discount.item_list
      .filter(item => 
        item.model_list?.some(model => 
          selectedModels.includes(model.model_id)
        )
      )
      .map(item => item.item_id);
  };

  useEffect(() => {
    const checkedIds = getCheckedItemIds();
    
    if (checkedIds?.length === 1) {
      setModelFilter(['all']);
      setSizeFilter(['all']);
      
      const selectedItem = discount?.item_list?.find(item => item.item_id === checkedIds[0]);
      if (selectedItem?.model_list && selectedModels.length === 0) {
        const modelIds = selectedItem.model_list.map(model => model.model_id);
        setSelectedModels(modelIds);
      }
    }
  }, [discount]);

  const calculatePromoPrice = (originalPrice: number, discountPercentage: number) => {
    const discount = (discountPercentage / 100) * originalPrice;
    return Math.round(originalPrice - discount);
  };

  const handlePriceChange = useCallback((modelId: number, value: string) => {
    const numValue = parseInt(value) || 0;
    setChanges(prev => ({
      ...prev,
      [modelId]: {
        price: numValue,
        previousPrice: prev[modelId]?.previousPrice
      }
    }));
  }, []);

  const handleDiscountChange = useCallback((modelId: number, value: string, originalPrice: number) => {
    const discountPercentage = parseInt(value) || 0;
    const promoPrice = calculatePromoPrice(originalPrice, discountPercentage);
    setChanges(prev => ({
      ...prev,
      [modelId]: {
        price: promoPrice,
        previousPrice: prev[modelId]?.previousPrice
      }
    }));
  }, []);

  const handleDiscountToggle = useCallback((modelId: number, enabled: boolean, originalPrice: number) => {
    if (enabled) {
      // Jika diaktifkan, gunakan nilai diskon sebelumnya atau default 26%
      const previousPrice = changes[modelId]?.previousPrice;
      const newPrice = previousPrice || Math.round(originalPrice * 0.74); // 26% discount
      
      setChanges(prev => ({
        ...prev,
        [modelId]: {
          price: newPrice,
          previousPrice: previousPrice || newPrice
        }
      }));
    } else {
      // Jika dinonaktifkan, simpan harga promosi saat ini sebagai previousPrice dan atur harga = harga asli
      const currentPrice = changes[modelId]?.price;
      
      setChanges(prev => ({
        ...prev,
        [modelId]: {
          price: originalPrice,
          previousPrice: currentPrice || prev[modelId]?.previousPrice
        }
      }));
    }
  }, [changes]);

  const handleSave = async () => {
    if (Object.keys(changes).length === 0) return;

    setIsSaving(true);
    try {
      // Kelompokkan perubahan berdasarkan item_id
      const existingItemChanges = new Map();
      const newItemChanges = new Map();
      const newModelChanges = new Map(); // Untuk model yang belum dalam promosi tapi itemnya sudah ada
      
      discount?.item_list.forEach(item => {
        // Identifikasi apakah ini item baru atau item yang sudah ada
        const isNewItem = newItemIds.has(item.item_id);
        
        const modelChanges = item.model_list
          .filter(model => changes[model.model_id])
          .map(model => ({
            model_id: model.model_id,
            model_promotion_price: changes[model.model_id].price
          }));
          
        if (modelChanges.length > 0) {
          const itemChange = {
            item_id: item.item_id,
            purchase_limit: item.purchase_limit,
            model_list: modelChanges
          };
          
          if (isNewItem) {
            newItemChanges.set(item.item_id, itemChange);
          } else {
            // Cek apakah model sudah dalam promosi atau belum
            const inPromotionModels: { model_id: number, model_promotion_price: number }[] = [];
            const notInPromotionModels: { model_id: number, model_promotion_price: number }[] = [];
            
            modelChanges.forEach(model => {
              const detailModel = item.model_list.find(m => m.model_id === model.model_id);
              if (detailModel?.in_promotion === false) {
                notInPromotionModels.push(model);
              } else {
                inPromotionModels.push(model);
              }
            });
            
            if (inPromotionModels.length > 0) {
              existingItemChanges.set(item.item_id, {
                ...itemChange,
                model_list: inPromotionModels
              });
            }
            
            if (notInPromotionModels.length > 0) {
              newModelChanges.set(item.item_id, {
                ...itemChange,
                model_list: notInPromotionModels
              });
            }
          }
        }
      });

      // Proses item yang sudah ada dan modelnya sudah dalam promosi (update-items)
      if (existingItemChanges.size > 0) {
        const existingItems = Array.from(existingItemChanges.values());
        
        const updateResponse = await fetch(`/api/discount/${params.discountId}?action=update-items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shopId,
            items: existingItems
          }),
        });

        if (!updateResponse.ok) {
          throw new Error(`HTTP error! status: ${updateResponse.status}`);
        }

        const updateResult = await updateResponse.json();
        
        if (!updateResult.success) {
          throw new Error(updateResult.message || 'Gagal menyimpan perubahan pada item yang sudah ada');
        }
      }
      
      // Gabungkan model baru dari item yang sudah ada dengan item baru
      const allNewItems = [...Array.from(newItemChanges.values()), ...Array.from(newModelChanges.values())];
      
      // Proses item baru dan model baru dari item yang sudah ada (add-items)
      if (allNewItems.length > 0) {
        const addResponse = await fetch(`/api/discount/${params.discountId}?action=add-items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shopId,
            items: allNewItems
          }),
        });

        if (!addResponse.ok) {
          throw new Error(`HTTP error! status: ${addResponse.status}`);
        }

        const addResult = await addResponse.json();
        
        if (!addResult.success) {
          throw new Error(addResult.message || 'Gagal menambahkan item/model baru');
        }
      }

      toast.success("Perubahan harga promo telah disimpan");
      
      setChanges({});
      setNewItemIds(new Set()); // Reset newItemIds setelah berhasil disimpan
      fetchDiscountDetail();
    } catch (err) {
      console.error('Save error:', err);
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan perubahan');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (unixTimestamp: number) => {
    return new Date(unixTimestamp * 1000).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ongoing':
        return 'bg-green-100 text-green-800';
      case 'upcoming':
        return 'bg-blue-100 text-blue-800';
      case 'expired':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ongoing':
        return 'Sedang Berjalan';
      case 'upcoming':
        return 'Akan Datang';
      case 'expired':
        return 'Berakhir';
      default:
        return 'Sedang Berjalan';
    }
  };

  const calculateDiscountPercentage = useCallback((originalPrice: number, promoPrice: number) => {
    if (!originalPrice) return 0;
    const discount = ((originalPrice - promoPrice) / originalPrice) * 100;
    return Math.round(discount);
  }, []);

  const handleMassUpdate = () => {
    if (!massUpdateValue || selectedModels.length === 0) return;

    const numValue = parseInt(massUpdateValue);
    if (isNaN(numValue)) return;

    const newChanges = { ...changes };
    selectedModels.forEach(modelId => {
      const model = discount?.item_list
        .flatMap(item => item.model_list)
        .find(m => m.model_id === modelId);

      if (model) {
        if (massUpdateType === 'price') {
          newChanges[modelId] = { 
            price: numValue,
            previousPrice: changes[modelId]?.previousPrice || model.model_promotion_price
          };
        } else {
          const promoPrice = calculatePromoPrice(model.model_original_price, numValue);
          newChanges[modelId] = { 
            price: promoPrice,
            previousPrice: changes[modelId]?.previousPrice || model.model_promotion_price
          };
        }
      }
    });
    setChanges(newChanges);
    setMassUpdateValue('');
  };

  const handleSelectAll = () => {
    if (!discount?.item_list) return;

    const allModelIds = discount.item_list
      .flatMap(item => item.model_list || [])
      .map(model => model.model_id);

    setSelectedModels(prev => {
      const currentSelected = prev || [];
      const allSelected = allModelIds.length > 0 && 
        allModelIds.every(id => currentSelected.includes(id));
      
      if (allSelected) {
        return currentSelected.filter(id => !allModelIds.includes(id));
      } else {
        return [...currentSelected, ...allModelIds].filter((id, index, self) => 
          self.indexOf(id) === index
        );
      }
    });
  };

  const handleSelectItemModels = (itemId: number) => {
    if (!discount?.item_list) return;

    const item = discount.item_list.find(item => item.item_id === itemId);
    if (!item?.model_list) return;

    const modelIds = item.model_list.map(model => model.model_id);

    setSelectedModels(prev => {
      const currentSelected = prev || [];
      const allSelected = modelIds.length > 0 && 
        modelIds.every(id => currentSelected.includes(id));
      
      if (allSelected) {
        return currentSelected.filter(id => !modelIds.includes(id));
      } else {
        return [...currentSelected, ...modelIds].filter((id, index, self) => 
          self.indexOf(id) === index
        );
      }
    });
  };

  const getUniqueSizes = (models: ModelDetail[] | undefined) => {
    if (!models?.length) return ['all'];

    const sizes = models
      .filter(model => model?.model_name && model.model_name.includes(','))
      .map(model => {
        const parts = model.model_name.split(',');
        return parts[1]?.trim() || '';
      })
      .filter(size => size !== '');

    const sortedSizes = Array.from(new Set(sizes)).sort((a, b) => a.localeCompare(b));
    return ['all', ...sortedSizes];
  };

  const handleSizeFilterChange = (size: string, e?: Event) => {
    e?.preventDefault();
    let newFilter: string[];
    if (size === 'all') {
      newFilter = ['all'];
    } else {
      newFilter = sizeFilter.includes(size)
        ? sizeFilter.filter(s => s !== size && s !== 'all')
        : [...sizeFilter.filter(s => s !== 'all'), size];
      
      if (newFilter.length === 0) {
        newFilter = ['all'];
      }
    }
    
    setSizeFilter(newFilter);
    
    const selectedItem = discount?.item_list?.find(
      item => item.item_id === getCheckedItemIds()[0]
    );
    if (!selectedItem?.model_list) return;

    const filteredModelIds = selectedItem.model_list
      .filter(m => {
        if (!m?.model_name) return false;
        
        const modelName = m.model_name.split(',')[0].trim();
        const modelSize = m.model_name.split(',')[1]?.trim() || '';
        
        const passModelFilter = modelFilter.includes('all') || 
          modelFilter.includes(modelName);
        const passSizeFilter = newFilter.includes('all') || 
          newFilter.includes(modelSize);
        
        return passModelFilter && passSizeFilter;
      })
      .map(m => m.model_id);
    
    setSelectedModels(filteredModelIds);
  };

  const getUniqueModels = (models: ModelDetail[] | undefined) => {
    if (!models?.length) return ['all'];

    try {
      const modelNames = models
        .filter(model => model?.model_name && typeof model.model_name === 'string')
        .map(model => model.model_name.split(',')[0].trim())
        .filter(name => name !== '');

      const uniqueNames = ['all'];
      modelNames.forEach(name => {
        if (!uniqueNames.includes(name)) {
          uniqueNames.push(name);
        }
      });

      const sortedNames = uniqueNames.slice(1).sort((a, b) => a.localeCompare(b));
      return ['all', ...sortedNames];
    } catch (error) {
      console.error('Error in getUniqueModels:', error);
      return ['all'];
    }
  };

  const handleModelFilterChange = (model: string, e?: Event) => {
    e?.preventDefault();
    const newFilter = model === 'all' 
      ? ['all']
      : modelFilter.includes(model)
        ? modelFilter.filter(m => m !== model && m !== 'all')
        : [...modelFilter.filter(m => m !== 'all'), model];

    const finalFilter = newFilter.length === 0 ? ['all'] : newFilter;
    setModelFilter(finalFilter);
    updateSelectedModels(finalFilter, sizeFilter);
  };

  const updateSelectedModels = (currentModelFilter: string[], currentSizeFilter: string[]) => {
    const selectedItem = discount?.item_list?.find(
      item => item.item_id === getCheckedItemIds()[0]
    );
    if (!selectedItem?.model_list) return;

    const filteredModelIds = selectedItem.model_list
      .filter(m => {
        if (!m?.model_name) return false;
        
        const [modelName, modelSize] = m.model_name.split(',').map(s => s.trim());
        
        const passModelFilter = currentModelFilter.includes('all') || 
          currentModelFilter.includes(modelName);
        const passSizeFilter = currentSizeFilter.includes('all') || 
          currentSizeFilter.includes(modelSize);
        
        return passModelFilter && passSizeFilter;
      })
      .map(m => m.model_id);
    
    setSelectedModels(filteredModelIds);
  };

  const isAllSelected = (filters: string[]) => {
    return filters.length === 1 && filters[0] === 'all';
  };

  const sortDiscountData = (data: DiscountDetail): DiscountDetail => {
    return {
      ...data,
      item_list: [...data.item_list]
        .map(item => ({
          ...item,
          model_list: [...item.model_list].sort((a, b) => 
            a.model_name.toLowerCase().localeCompare(b.model_name.toLowerCase())
          )
        }))
        .sort((a, b) => a.item_name.toLowerCase().localeCompare(b.item_name.toLowerCase()))
    };
  };

  const fetchDiscountDetail = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/discount/${params.discountId}?shopId=${shopId}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Gagal mengambil data diskon');
      }
      
      setDiscount(sortDiscountData(data.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengambil data diskon');
    } finally {
      setIsLoading(false);
    }
  };

  const uniqueModels = useMemo(() => {
    const selectedItem = discount?.item_list?.find(
      item => item.item_id === getCheckedItemIds()[0]
    );
    return getUniqueModels(selectedItem?.model_list);
  }, [discount?.item_list, getCheckedItemIds]);

  const uniqueSizes = useMemo(() => {
    const selectedItem = discount?.item_list?.find(
      item => item.item_id === getCheckedItemIds()[0]
    );
    return getUniqueSizes(selectedItem?.model_list);
  }, [discount?.item_list, getCheckedItemIds]);

  const getFilteredModels = useCallback((models: ModelDetail[] | undefined) => {
    if (!models) return [];
    
    return models.filter(m => {
      if (!m?.model_name) return false;
      
      // Pisahkan nama model dan ukuran jika tersedia
      const parts = m.model_name.split(',');
      const modelName = parts[0].trim();
      const modelSize = parts[1]?.trim() || '';
      
      const passModelFilter = isAllSelected(modelFilter) || 
        modelFilter.includes(modelName);
      const passSizeFilter = isAllSelected(sizeFilter) || 
        sizeFilter.includes(modelSize);
      
      return passModelFilter && passSizeFilter;
    });
  }, [modelFilter, sizeFilter]);

  useEffect(() => {
    let isSubscribed = true;

    if (shopId) {
      fetchDiscountDetail()
        .then(() => {
          if (!isSubscribed) return;
          
          if (discount?.item_list) {
            const sortedItems = [...discount.item_list].map(item => ({
              ...item,
              model_list: [...item.model_list].sort((a, b) => 
                a.model_name.localeCompare(b.model_name)
              )
            })).sort((a, b) => 
              a.item_name.localeCompare(b.item_name)
            );
            setDiscount(prev => prev ? {...prev, item_list: sortedItems} : null);
          }
        })
        .catch(console.error);
    }

    return () => {
      isSubscribed = false;
    };
  }, [shopId, params.discountId]);

  const toggleExpand = (itemId: number) => {
    setExpandedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleAddProduct = () => {
    setIsProductDialogOpen(true);
    
    if (!hasLoadedProducts) {
      fetchProducts();
    }
  };

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

  const handleRefreshProducts = () => {
    setIsRefreshing(true);
    fetchProducts();
  };

  const handleProductSelect = (productId: number) => {
    const newSelected = new Set(selectedProductIds);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProductIds(newSelected);
  };

  const handleSelectAllProducts = () => {
    if (selectedProductIds.size === products.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(products.map(p => p.item_id)));
    }
  };

  const handleConfirmProducts = async () => {
    const selectedProducts = products.filter(p => selectedProductIds.has(p.item_id));
    
    const newItems = selectedProducts.map(product => {
      const models = product.models.map(model => ({
        model_id: model.model_id,
        model_name: model.model_name,
        model_original_price: model.price_info?.current_price || model.model_original_price,
        model_promotion_price: model.price_info?.current_price || model.model_original_price,
        model_promotion_stock: 0,
        model_normal_stock: model.stock_info?.summary_info?.total_available_stock || 
                           model.stock_info?.seller_stock || 
                           model.model_normal_stock || 0
      }));

      return {
        item_id: product.item_id,
        item_name: product.item_name,
        item_original_price: 0,
        item_promotion_price: 0,
        item_promotion_stock: 0,
        normal_stock: 0,
        purchase_limit: 0,
        model_list: models,
        image_url: product.image?.image_url_list?.[0] || undefined
      };
    });

    setDiscount(prev => {
      if (!prev) return prev;

      const existingItemIds = new Set(prev.item_list.map(item => item.item_id));
      const filteredNewItems = newItems.filter(item => !existingItemIds.has(item.item_id));
      
      // Track item baru dengan menambahkannya ke newItemIds
      const newItemIdSet = filteredNewItems.map(item => item.item_id);
      setNewItemIds(prev => {
        const updatedSet = new Set(prev);
        newItemIdSet.forEach(id => updatedSet.add(id));
        return updatedSet;
      });

      return {
        ...prev,
        item_list: [...filteredNewItems, ...prev.item_list]
      };
    });

    setIsProductDialogOpen(false);
    setSelectedProductIds(new Set());

    toast.success(`${newItems.length} produk berhasil ditambahkan ke diskon`);
  };

  const handleDeleteItems = async () => {
    if (selectedModels.length === 0) return;

    const itemIds = Array.from(new Set(
      selectedModels.map(modelId => {
        const item = discount?.item_list.find(item => 
          item.model_list.some(model => model.model_id === modelId)
        );
        return item?.item_id;
      }).filter(Boolean) as number[]
    ));
    
    setItemToDelete(itemIds);
    setDeleteDialogOpen(true);
  };

  const handleDeleteSingleItem = (itemId: number) => {
    setItemToDelete(itemId);
    setDeleteDialogOpen(true);
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;

    setIsDeleting(true);
    try {
      const itemIds = Array.isArray(itemToDelete) ? itemToDelete : [itemToDelete];
      
      // Hapus item satu per satu karena API hanya mendukung penghapusan 1 item per request
      let successCount = 0;
      let errorMessages = [];
      
      for (const itemId of itemIds) {
        try {
          // Format item untuk API
          const itemRequest = { item_id: itemId };
          
          // Panggil API untuk menghapus item dari diskon
          const response = await fetch(`/api/discount/${params.discountId}?action=delete-items`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              shopId,
              itemIds: [itemRequest]
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
          }

          const result = await response.json();
          
          if (!result.success) {
            throw new Error(result.message || 'Gagal menghapus item dari diskon');
          }
          
          successCount++;
        } catch (itemError: unknown) {
          console.error(`Error deleting item ID ${itemId}:`, itemError);
          errorMessages.push(`Item ID ${itemId}: ${itemError instanceof Error ? itemError.message : 'Unknown error'}`);
        }
      }
      
      // Update state lokal setelah berhasil menghapus dari API
      if (successCount > 0) {
        setDiscount(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            item_list: prev.item_list.filter(item => !itemIds.includes(item.item_id))
          };
        });

        setSelectedModels(prev => 
          prev.filter(modelId => {
            const modelBelongsToDeletedItem = discount?.item_list
              .filter(item => itemIds.includes(item.item_id))
              .some(item => item.model_list.some(model => model.model_id === modelId));
            
            return !modelBelongsToDeletedItem;
          })
        );

        toast.success(`${successCount} dari ${itemIds.length} item berhasil dihapus dari diskon`);
      }
      
      if (errorMessages.length > 0) {
        toast.error(errorMessages.join(', '));
      }


    } catch (error) {
      console.error('Error deleting items:', error);
      toast.error(error instanceof Error ? error.message : "Terjadi kesalahan saat menghapus item");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  if (isLoading || error || !discount) {
    return (
      <div className="p-4">
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-8 w-[200px]" />
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        )}
        {error && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-red-500">
                <p>{error}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Tombol Kembali */}
      <div className="mb-4">
        <Link href={`/discounts?shopId=${shopId}`}>
          <Button variant="outline" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Daftar Diskon
          </Button>
        </Link>
      </div>
      
      {/* Header Section */}
      <div className="bg-white rounded-lg shadow-sm border mb-6 overflow-hidden">
        <CardHeader className="border-b bg-slate-50 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-slate-700" />
              <h2 className="text-sm font-medium text-slate-600">
                {shopInfo ? shopInfo.shop_name : `Toko ID: ${shopId}`}
              </h2>
            </div>
            <Badge variant="outline" className={`${getStatusColor(discount?.status || 'ongoing')} px-2 py-0.5 text-xs`}>
              {getStatusText(discount?.status || 'ongoing')}
            </Badge>
          </div>
        </CardHeader>
        
        <div className="p-5">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <h1 className="text-2xl font-bold mb-2">{discount?.discount_name || 'Loading...'}</h1>
              <div className="flex flex-wrap gap-y-2 gap-x-4 text-sm text-gray-600">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <span>{discount ? `${formatDate(discount.start_time)} - ${formatDate(discount.end_time)}` : 'Loading...'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Tag className="h-4 w-4" />
                  <span>{discount ? `${discount.item_list.length} produk` : 'Loading...'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tambahkan tombol Tambah Produk */}
      <div className="mb-4 flex justify-between items-center">
        <Button
          type="button"
          onClick={handleAddProduct}
          className="bg-black text-white hover:bg-black/90"
        >
          + Tambah Produk
        </Button>
        
        {Object.keys(changes).length > 0 && (
          <Button 
            onClick={handleSave}
            disabled={isSaving}
            size="default"
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        )}
      </div>

      {/* Control Panel */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          {/* Mass Update Controls */}
          <div className="flex items-center gap-2 flex-1 min-w-[300px]">
            <Select
              value={massUpdateType}
              onValueChange={(value: 'price' | 'discount') => setMassUpdateType(value)}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price">Harga</SelectItem>
                <SelectItem value="discount">Diskon</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              value={massUpdateValue}
              onChange={(e) => setMassUpdateValue(e.target.value)}
              placeholder={massUpdateType === 'price' ? 'Harga' : '% Diskon'}
              className="w-32"
            />
            <Button 
              size="sm"
              variant="secondary"
              onClick={handleMassUpdate}
              disabled={selectedModels.length === 0 || !massUpdateValue}
            >
              Update ({selectedModels.length})
            </Button>
            {selectedModels.length > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDeleteItems}
                className="ml-2"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Hapus Terpilih
              </Button>
            )}
          </div>

          {/* Filters - Only show when single item selected */}
          {getCheckedItemIds()?.length === 1 && (
            <div className="flex items-center gap-2">
              <DropdownMenu open={modelDropdownOpen} onOpenChange={setModelDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Model: {modelFilter.includes('all') ? "Semua" : modelFilter.length}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48">
                  {uniqueModels.map((model) => (
                    <DropdownMenuCheckboxItem
                      key={model}
                      checked={modelFilter.includes(model)}
                      onCheckedChange={() => handleModelFilterChange(model)}
                    >
                      {model === 'all' ? 'Semua Model' : model}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu open={sizeDropdownOpen} onOpenChange={setSizeDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Ukuran: {sizeFilter.includes('all') ? "Semua" : sizeFilter.length}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48">
                  {uniqueSizes.map((size) => (
                    <DropdownMenuCheckboxItem
                      key={size}
                      checked={sizeFilter.includes(size)}
                      onCheckedChange={() => handleSizeFilterChange(size)}
                    >
                      {size === 'all' ? 'Semua Ukuran' : size}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {/* Table Header */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow className="border-b">
                <TableHead className="w-10 p-2 text-left">
                  <Checkbox
                    checked={selectedModels.length > 0 && 
                      discount?.item_list.flatMap(item => item.model_list)
                        .every(model => selectedModels.includes(model.model_id))
                    }
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="font-medium">Produk</TableHead>
                <TableHead className="w-32 text-right font-medium">Harga Awal</TableHead>
                <TableHead className="w-32 text-right font-medium">Harga Promo</TableHead>
                <TableHead className="w-24 text-right font-medium">Diskon</TableHead>
                <TableHead className="w-24 text-right font-medium">Stok</TableHead>
                <TableHead className="w-24 text-center font-medium">Status</TableHead>
                <TableHead className="w-24 text-right font-medium">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {discount.item_list.map((item) => (
                <React.Fragment key={item.item_id}>
                  {/* Item Row */}
                  <TableRow className="border-b bg-gray-50">
                    <TableCell className="p-2">
                      <Checkbox
                        checked={item.model_list.some(model => selectedModels.includes(model.model_id))}
                        onCheckedChange={() => handleSelectItemModels(item.item_id)}
                      />
                    </TableCell>
                    <TableCell colSpan={6} className="py-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="flex items-center gap-2 cursor-pointer flex-1"
                          onClick={() => toggleExpand(item.item_id)}
                        >
                          <ChevronDown 
                            className={`h-4 w-4 text-gray-400 transition-transform ${
                              expandedItems.includes(item.item_id) ? 'transform rotate-180' : ''
                            }`}
                          />
                          {item.image_url && (
                            <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                              <img 
                                src={item.image_url} 
                                alt={item.item_name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = '/placeholder-image.jpg';
                                }}
                              />
                            </div>
                          )}
                          <div className="font-medium">{item.item_name}</div>
                          {item.model_list.some(model => model.in_promotion === false) && (
                            <Badge variant="outline" className="ml-2 bg-yellow-50 text-yellow-800 border-yellow-200">
                              {item.model_list.filter(model => model.in_promotion === false).length} model belum ditambahkan
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSingleItem(item.item_id);
                        }}
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>

                  {/* Model List - Only show models when item is expanded */}
                  {expandedItems.includes(item.item_id) && (
                    getFilteredModels(item.model_list).map((model) => (
                      <TableRow 
                        key={model.model_id} 
                        className={`border-t hover:bg-gray-50 ${model.in_promotion === false ? 'bg-yellow-50/30' : ''}`}
                      >
                        <TableCell className="p-2 pl-10">
                          {getCheckedItemIds().includes(item.item_id) && getCheckedItemIds().length === 1 && (
                            <Checkbox
                              checked={selectedModels.includes(model.model_id)}
                              onCheckedChange={(checked) => {
                                setSelectedModels(prev =>
                                  checked
                                    ? [...prev, model.model_id]
                                    : prev.filter(id => id !== model.model_id)
                                );
                              }}
                            />
                          )}
                        </TableCell>
                        <TableCell className="pl-10 py-2">
                          {model.model_name}
                          {model.in_promotion === false && (
                            <Badge className="ml-2 text-xs bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                              Belum ditambahkan
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-gray-600 py-2">{formatPrice(model.model_original_price)}</TableCell>
                        <TableCell className="py-2">
                          <div className="input-wrapper">
                            <span className="input-prefix">Rp</span>
                            <Input
                              type="number"
                              value={changes[model.model_id]?.price || model.model_promotion_price}
                              onChange={(e) => handlePriceChange(model.model_id, e.target.value)}
                              className="text-right h-8 text-sm w-full input-with-prefix"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="input-wrapper">
                            <Input
                              type="number"
                              value={calculateDiscountPercentage(
                                model.model_original_price,
                                changes[model.model_id]?.price || model.model_promotion_price
                              )}
                              onChange={(e) => handleDiscountChange(model.model_id, e.target.value, model.model_original_price)}
                              className="text-right h-8 text-sm w-full input-with-suffix"
                            />
                            <span className="input-suffix">%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-gray-600 py-2">{model.model_normal_stock}</TableCell>
                        <TableCell className="text-center py-2">
                          <Switch
                            checked={(changes[model.model_id]?.price || model.model_promotion_price) < model.model_original_price}
                            onCheckedChange={(checked) => 
                              handleDiscountToggle(
                                model.model_id, 
                                checked, 
                                model.model_original_price
                              )
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Dialog Tambah Produk */}
      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="sm:max-w-[900px]">
          <DialogHeader>
            <div className="flex justify-between items-center">
              <DialogTitle>Pilih Produk</DialogTitle>
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
              className="pl-9"
            />
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedProductIds.size === products.length && products.length > 0}
                      onCheckedChange={handleSelectAllProducts}
                    />
                  </TableHead>
                  <TableHead className="w-[100px]">Gambar</TableHead>
                  <TableHead>Nama Produk</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Harga</TableHead>
                  <TableHead>Stok</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products
                  .filter(product => 
                    searchQuery === '' || 
                    product.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    product.item_sku.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((product) => {
                    const lowestPrice = Math.min(
                      ...product.models.map(m => {
                        return m.price_info?.current_price || m.model_original_price || 0;
                      })
                    );
                    const totalStock = product.models.reduce(
                      (sum, m) => {
                        const modelStock = m.stock_info?.summary_info?.total_available_stock || 
                                          m.stock_info?.seller_stock || 
                                          m.model_normal_stock || 0;
                        return sum + modelStock;
                      }, 0
                    );
                    const isExisting = discount?.item_list.some(
                      item => item.item_id === product.item_id
                    ) ?? false;
                    
                    return (
                      <TableRow 
                        key={product.item_id} 
                        className={`cursor-pointer hover:bg-gray-50 ${isExisting ? 'opacity-50' : ''}`}
                        onClick={() => !isExisting && handleProductSelect(product.item_id)}
                      >
                        <TableCell className="w-[50px]">
                          <Checkbox
                            checked={selectedProductIds.has(product.item_id)}
                            onCheckedChange={() => !isExisting && handleProductSelect(product.item_id)}
                            disabled={isExisting}
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
                            {isExisting && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                                Sudah ditambahkan
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{product.item_sku}</TableCell>
                        <TableCell>{formatPrice(lowestPrice)}</TableCell>
                        <TableCell>{totalStock}</TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-between items-center gap-3 mt-4 pt-4 border-t">
            <span className="text-sm text-gray-600">
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
                className="bg-black text-white hover:bg-black/90"
              >
                Tambahkan Produk
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog untuk konfirmasi hapus */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Konfirmasi Penghapusan
              </div>
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-2">
              {Array.isArray(itemToDelete) ? (
                <>
                  <p className="mb-2">
                    Apakah Anda yakin ingin menghapus {itemToDelete.length} item yang dipilih dari diskon ini?
                    Tindakan ini tidak dapat dibatalkan.
                  </p>
                  <div className="mt-4 max-h-[200px] overflow-y-auto border rounded-md p-2 bg-gray-50">
                    <p className="font-medium text-sm mb-2 text-gray-700">Item yang akan dihapus:</p>
                    <ul className="space-y-1 text-sm">
                      {itemToDelete.map(itemId => {
                        const item = discount?.item_list.find(i => i.item_id === itemId);
                        return (
                          <li key={itemId} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-100">
                            {item?.image_url && (
                              <div className="w-6 h-6 rounded overflow-hidden flex-shrink-0">
                                <img 
                                  src={item.image_url} 
                                  alt={item.item_name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.src = '/placeholder-image.jpg';
                                  }}
                                />
                              </div>
                            )}
                            <span className="truncate">{item?.item_name || `Item #${itemId}`}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  <p className="mb-2">
                    Apakah Anda yakin ingin menghapus item ini dari diskon?
                    Tindakan ini tidak dapat dibatalkan.
                  </p>
                  {itemToDelete && (
                    <div className="mt-4 border rounded-md p-3 bg-gray-50">
                      {(() => {
                        const item = discount?.item_list.find(i => i.item_id === itemToDelete);
                        return (
                          <div className="flex items-center gap-3">
                            {item?.image_url && (
                              <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
                                <img 
                                  src={item.image_url} 
                                  alt={item.item_name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.src = '/placeholder-image.jpg';
                                  }}
                                />
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{item?.item_name || `Item #${itemToDelete}`}</p>
                              <p className="text-sm text-gray-500">{item?.model_list.length || 0} variasi</p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-6">
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

      <style jsx global>{`
        /* Menghilangkan tombol panah pada input number */
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
        
        /* Styling untuk wrapper input dengan prefix/suffix */
        .input-wrapper {
          position: relative;
          width: 100%;
        }
        
        .input-prefix {
          position: absolute;
          left: 8px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 0.75rem;
          color: #6b7280;
          pointer-events: none;
        }
        
        .input-suffix {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 0.75rem;
          color: #6b7280;
          pointer-events: none;
        }
        
        .input-with-prefix {
          padding-left: 24px;
        }
        
        .input-with-suffix {
          padding-right: 20px;
        }
      `}</style>
    </div>
  );
}
