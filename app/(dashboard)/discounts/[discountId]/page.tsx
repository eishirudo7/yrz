'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useSearchParams } from 'next/navigation';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ModelChanges {
    [key: number]: {
      price: number;
    }
  }
interface ModelDetail {
  model_id: number;
  model_name: string;
  model_normal_stock: number;
  model_original_price: number;
  model_promotion_price: number;
  model_promotion_stock: number;
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

export default function DiscountDetailPage({ params }: { params: { discountId: string } }) {
  const searchParams = useSearchParams();
  const shopId = searchParams.get('shopId');
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
        price: numValue
      }
    }));
  }, []);

  const handleDiscountChange = useCallback((modelId: number, value: string, originalPrice: number) => {
    const discountPercentage = parseInt(value) || 0;
    const promoPrice = calculatePromoPrice(originalPrice, discountPercentage);
    setChanges(prev => ({
      ...prev,
      [modelId]: {
        price: promoPrice
      }
    }));
  }, []);

  const handleSave = async () => {
    if (Object.keys(changes).length === 0) return;

    setIsSaving(true);
    try {
      // Kelompokkan perubahan berdasarkan item_id
      const itemChanges = new Map();
      
      discount?.item_list.forEach(item => {
        const modelChanges = item.model_list
          .filter(model => changes[model.model_id])
          .map(model => ({
            model_id: model.model_id,
            model_promotion_price: changes[model.model_id].price
          }));
          
        if (modelChanges.length > 0) {
          itemChanges.set(item.item_id, {
            item_id: item.item_id,
            purchase_limit: item.purchase_limit,
            model_list: modelChanges
          });
        }
      });

      const items = Array.from(itemChanges.values());

      const response = await fetch(`/api/discount/${params.discountId}?action=update-items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shopId,
          items
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Gagal menyimpan perubahan');
      }

      toast({
        title: "Berhasil",
        description: "Perubahan harga promo telah disimpan",
      });
      
      setChanges({});
      fetchDiscountDetail();
    } catch (err) {
      console.error('Save error:', err);
      toast({
        title: "Gagal",
        description: err instanceof Error ? err.message : 'Gagal menyimpan perubahan',
        variant: "destructive",
      });
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
        return status;
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
          newChanges[modelId] = { price: numValue };
        } else {
          const promoPrice = calculatePromoPrice(model.model_original_price, numValue);
          newChanges[modelId] = { price: promoPrice };
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
      
      const [modelName, modelSize] = m.model_name.split(',').map(s => s.trim());
      
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
      {/* Header Section */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-lg font-medium">{discount.discount_name}</h1>
              <Badge variant="outline" className={`${getStatusColor(discount.status)} px-2 py-0.5 text-xs`}>
                {getStatusText(discount.status)}
              </Badge>
            </div>
            <div className="text-sm text-gray-500 space-x-2">
              <span>{formatDate(discount.start_time)} - {formatDate(discount.end_time)}</span>
              <span>•</span>
              <span>{discount.item_list.length} produk</span>
            </div>
          </div>
          
          {Object.keys(changes).length > 0 && (
            <Button 
              onClick={handleSave}
              disabled={isSaving}
              size="sm"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          )}
        </div>
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
      <div className="bg-white rounded-lg shadow-sm border">
        {/* Table Header */}
        <div className="flex items-center gap-4 p-3 border-b text-sm">
          <div className="w-6">
            <Checkbox
              checked={selectedModels.length > 0 && 
                discount?.item_list.flatMap(item => item.model_list)
                  .every(model => selectedModels.includes(model.model_id))
              }
              onCheckedChange={handleSelectAll}
            />
          </div>
          <div className="flex-1">Produk</div>
          <div className="w-48 text-right">Harga Awal</div>
          <div className="w-48 text-right">Harga Promo</div>
          <div className="w-32 text-right">Diskon</div>
          <div className="w-32 text-right">Stok</div>
        </div>

        {/* Items List */}
        <div>
          {discount.item_list.map((item) => (
            <div key={item.item_id} className="border-b last:border-b-0">
              {/* Item Row */}
              <div className="flex items-center gap-4 p-3 bg-gray-50 text-sm">
                <div className="w-6">
                  <Checkbox
                    checked={item.model_list.some(model => selectedModels.includes(model.model_id))}
                    onCheckedChange={() => handleSelectItemModels(item.item_id)}
                  />
                </div>
                <div 
                  className="flex items-center gap-2 flex-1 cursor-pointer"
                  onClick={() => toggleExpand(item.item_id)}
                >
                  <ChevronDown 
                    className={`h-4 w-4 text-gray-400 transition-transform ${
                      expandedItems.includes(item.item_id) ? 'transform rotate-180' : ''
                    }`}
                  />
                  <div className="flex-1">{item.item_name}</div>
                </div>
              </div>

              {/* Model List - Only show models when item is expanded */}
              {expandedItems.includes(item.item_id) && (
                <div>
                  {getFilteredModels(item.model_list).map((model) => (
                    <div key={model.model_id} className="flex items-center gap-4 p-3 pl-14 border-t bg-white text-sm">
                      <div className="w-6">
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
                      </div>
                      <div className="flex-1">{model.model_name}</div>
                      <div className="w-48 text-right text-gray-600">{formatPrice(model.model_original_price)}</div>
                      <div className="w-48">
                        <Input
                          type="number"
                          value={changes[model.model_id]?.price || model.model_promotion_price}
                          onChange={(e) => handlePriceChange(model.model_id, e.target.value)}
                          className="text-right h-8 text-sm"
                        />
                      </div>
                      <div className="w-32">
                        <Input
                          type="number"
                          value={calculateDiscountPercentage(
                            model.model_original_price,
                            changes[model.model_id]?.price || model.model_promotion_price
                          )}
                          onChange={(e) => handleDiscountChange(model.model_id, e.target.value, model.model_original_price)}
                          className="text-right h-8 text-sm"
                        />
                      </div>
                      <div className="w-32 text-right text-gray-600">{model.model_normal_stock}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
