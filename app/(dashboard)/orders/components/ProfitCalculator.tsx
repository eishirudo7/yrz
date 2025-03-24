'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Wallet, RefreshCw, List, Search, CreditCard, DollarSign, Eye, BarChart3, CalendarIcon, ListIcon, Tag, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { type Order } from '@/app/hooks/useOrders'
import ProfitabilitySettingsDialog from './ProfitabilitySettingsDialog'
import DownloadReportButton from './ExcelExporter'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface ProfitCalculatorProps {
  orders: Order[]
  escrowTotal: number
  adsSpend: number | string | { ads_data: any[], total_cost: string, raw_cost: number }
  dateRange?: { from: Date | undefined, to?: Date | undefined } | undefined
}

// Interface untuk item rincian profit
interface ProfitDetailItem {
  sku: string
  quantity: number
  pricePerItem: number
  method: 'modal' | 'margin'
  value: number // modal price atau margin percentage
  profitPerItem: number
  totalProfit: number
  shopName?: string
  orderSn?: string
}

// Tambahkan fungsi formatCompactNumber di dalam komponen ProfitCalculator
// atau di luar jika Anda ingin menggunakannya di komponen lain
const formatCompactNumber = (number: number): string => {
  if (number < 1000) return `Rp ${Math.round(number)}`;
  if (number < 1000000) return `Rp ${(number/1000).toFixed(1)}rb`;
  return `Rp ${(number/1000000).toFixed(1)}jt`;
};

export default function ProfitCalculator({ 
  orders, 
  escrowTotal, 
  adsSpend,
  dateRange
}: ProfitCalculatorProps) {
  const [totalProfit, setTotalProfit] = useState<number>(0)
  const [isCalculating, setIsCalculating] = useState<boolean>(false)
  const [lastCalcTime, setLastCalcTime] = useState<Date | null>(null)
  const [defaultMargin, setDefaultMargin] = useState<number>(0.15) // 25% default margin
  const [skuProfitData, setSkuProfitData] = useState<{
    [key: string]: {
      cost_price: number | null,
      margin_percentage: number | null,
      is_using_cost: boolean
    }
  }>({})
  // State untuk dialog rincian
  const [showProfitDetails, setShowProfitDetails] = useState(false)
  const [profitDetails, setProfitDetails] = useState<ProfitDetailItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [groupedDetails, setGroupedDetails] = useState<{[key: string]: ProfitDetailItem}>({})
  const [dataLoaded, setDataLoaded] = useState(false)
  const [shopProfitData, setShopProfitData] = useState<{[key: number]: {
    shopId: number,
    shopName: string,
    totalEscrow: number,
    totalProfit: number,
    adsSpend: number,
    netProfit: number
  }}>({})
  const [autoCalculated, setAutoCalculated] = useState(false) // Tambahkan state untuk tracking kalkulasi otomatis
  
  // Fungsi untuk mengecek apakah adsSpend valid/tersedia
  const isAdsSpendAvailable = useCallback(() => {
    if (typeof adsSpend === 'number' && adsSpend > 0) return true;
    if (typeof adsSpend === 'string' && adsSpend.trim() !== '') return true;
    if (typeof adsSpend === 'object' && adsSpend !== null) {
      if ('raw_cost' in adsSpend && typeof adsSpend.raw_cost === 'number' && adsSpend.raw_cost > 0) return true;
      if ('ads_data' in adsSpend && Array.isArray(adsSpend.ads_data) && adsSpend.ads_data.length > 0) return true;
    }
    return false;
  }, [adsSpend]);

  // Prefetch SKU data when component mounts
  useEffect(() => {
    const prefetchSkuData = async () => {
      if (orders.length > 0 && !dataLoaded) {
        const ordersWithEscrow = orders.filter(
          order => order.escrow_amount_after_adjustment !== null && 
                   order.escrow_amount_after_adjustment !== undefined
        );
        await fetchAllSkuData(ordersWithEscrow);
        setDataLoaded(true);
      }
    };
    
    prefetchSkuData();
  }, [orders, dataLoaded]);
  
  // Tambahkan useEffect baru untuk kalkulasi otomatis
  useEffect(() => {
    // Cek apakah memenuhi kondisi untuk kalkulasi otomatis
    if (
      !autoCalculated && // Belum pernah kalkulasi otomatis
      dataLoaded && // Data SKU sudah dimuat
      orders.length > 0 && // Ada order 
      escrowTotal > 0 && // Ada escrow
      isAdsSpendAvailable() && // Ada data iklan
      !isCalculating // Tidak sedang menghitung
    ) {
      // Jalankan kalkulasi otomatis
      calculateTotalProfit();
      setAutoCalculated(true); // Tandai sudah kalkulasi otomatis
    }
  }, [dataLoaded, orders, escrowTotal, adsSpend, isCalculating, autoCalculated, isAdsSpendAvailable]);
  
  // Fungsi untuk mendapatkan nilai adsSpend yang valid
  const getValidAdsSpend = (): number => {
    // Jika adsSpend adalah object dengan raw_cost
    if (adsSpend && typeof adsSpend === 'object' && 'raw_cost' in adsSpend) {
      return typeof adsSpend.raw_cost === 'number' ? adsSpend.raw_cost : 0;
    }
    
    // Jika adsSpend adalah string (format rupiah)
    if (typeof adsSpend === 'string') {
      // Hapus format Rp. dan titik ribuan
      const numericValue = parseFloat(adsSpend.replace(/[^\d,]/g, '').replace(',', '.'));
      return isNaN(numericValue) ? 0 : numericValue;
    }
    
    // Jika adsSpend adalah angka langsung
    return typeof adsSpend === 'number' && !isNaN(adsSpend) ? adsSpend : 0;
  };
  
  // Ekstrak SKU dan kuantitas dari sku_qty string
  const extractSkusWithQuantity = (skuQty: string): { sku: string, quantity: number }[] => {
    if (!skuQty) return [];
    
    const result: { sku: string, quantity: number }[] = [];
    const entries = skuQty.split(',').map(entry => entry.trim());
    
    for (const entry of entries) {
      const match = entry.match(/(.*?)\s*\((\d+)\)/);
      if (match) {
        const [, skuName, quantityStr] = match;
        const quantity = parseInt(quantityStr);
        // Simpan SKU dengan nama asli (dengan case yang sama) dan versi normalized
        result.push({ 
          sku: skuName,
          quantity 
        });
      }
    }
    
    return result;
  };
  
  // Fungsi untuk mengambil semua data SKU sekaligus
  const fetchAllSkuData = async (orders: Order[]) => {
    try {
      // Ekstrak semua SKU unik dari orders
      const allSkus = new Set<string>();
      const skuVariants: {[key: string]: string[]} = {}; // Untuk menampung varian dari SKU (perbedaan case)
      
      orders.forEach(order => {
        if (order.sku_qty) {
          const skuItems = extractSkusWithQuantity(order.sku_qty);
          skuItems.forEach(item => {
            const normalizedSku = item.sku.toUpperCase();
            allSkus.add(normalizedSku);
            
            // Simpan varian nama SKU untuk referensi nanti
            if (!skuVariants[normalizedSku]) {
              skuVariants[normalizedSku] = [];
            }
            if (!skuVariants[normalizedSku].includes(item.sku)) {
              skuVariants[normalizedSku].push(item.sku);
            }
          });
        }
      });
      
      if (allSkus.size === 0) return;
      
      // Query database sekali saja untuk semua SKU
      const { data, error } = await supabase
        .from('sku_cost_margins')
        .select('item_sku, cost_price, margin_percentage, is_using_cost');
      
      if (error) {
        console.error('Error fetching SKU data:', error);
        return;
      }
      
      // Simpan data dalam bentuk object untuk pencarian cepat
      const skuMap: {[key: string]: any} = {};
      
      // Buat indeks SKU untuk pencocokan case-insensitive
      const dataIndex: {[key: string]: any} = {};
      data?.forEach(item => {
        const normalizedSku = item.item_sku.toUpperCase();
        dataIndex[normalizedSku] = item;
      });
      
      // Petakan data ke setiap varian SKU
      allSkus.forEach(normalizedSku => {
        // Cari data dari database berdasarkan normalized SKU
        const dataItem = dataIndex[normalizedSku] || data?.find(
          item => item.item_sku.toUpperCase() === normalizedSku
        );
        
        if (dataItem) {
          // Gunakan data yang ditemukan di database
          skuMap[normalizedSku] = {
            cost_price: dataItem.cost_price,
            margin_percentage: dataItem.margin_percentage,
            is_using_cost: dataItem.is_using_cost
          };
          
          // Terapkan juga ke varian SKU
          if (skuVariants[normalizedSku]) {
            skuVariants[normalizedSku].forEach(variant => {
              skuMap[variant] = {
                cost_price: dataItem.cost_price,
                margin_percentage: dataItem.margin_percentage || (dataItem.cost_price ? null : defaultMargin),
                is_using_cost: dataItem.is_using_cost
              };
            });
          }
        } else {
          // Gunakan nilai default jika tidak ada data
          const defaultData = {
            cost_price: null,
            margin_percentage: defaultMargin,
            is_using_cost: false
          };
          
          skuMap[normalizedSku] = defaultData;
          
          // Terapkan juga ke varian SKU
          if (skuVariants[normalizedSku]) {
            skuVariants[normalizedSku].forEach(variant => {
              skuMap[variant] = defaultData;
            });
          }
        }
      });
      
      setSkuProfitData(skuMap);
      
    } catch (error) {
      console.error('Error in fetchAllSkuData:', error);
    }
  };
  
  // Ubah getSkuProfitData untuk menggunakan data dari state dengan fallback yang lebih baik
  const getSkuProfitData = (sku: string): { 
    cost_price: number | null, 
    margin_percentage: number | null, 
    is_using_cost: boolean 
  } => {
    // Coba cari dengan case yang sama persis
    if (skuProfitData[sku]) {
      return skuProfitData[sku];
    }
    
    // Coba cari dengan case insensitive
    const normalizedSku = sku.toUpperCase();
    const matchingKey = Object.keys(skuProfitData).find(
      key => key.toUpperCase() === normalizedSku
    );
    
    if (matchingKey && skuProfitData[matchingKey]) {
      return skuProfitData[matchingKey];
    }
    
    // Fallback ke default
    return {
      cost_price: null,
      margin_percentage: defaultMargin,
      is_using_cost: false
    };
  };
  
  // Hitung profit untuk satu pesanan
  const calculateOrderProfit = (order: Order): { profit: number, details: ProfitDetailItem[] } => {
    if (!order.escrow_amount_after_adjustment || 
        order.escrow_amount_after_adjustment === null || 
        order.escrow_amount_after_adjustment <= 0) {
      return { profit: 0, details: [] };
    }
    
    const escrowAmount = parseFloat(order.escrow_amount_after_adjustment.toString());
    
    // Jika tidak ada sku_qty, gunakan default margin
    if (!order.sku_qty) {
      return { 
        profit: escrowAmount * defaultMargin, 
        details: [{
          sku: 'Unknown',
          quantity: 1,
          pricePerItem: escrowAmount,
          method: 'margin',
          value: defaultMargin,
          profitPerItem: escrowAmount * defaultMargin,
          totalProfit: escrowAmount * defaultMargin,
          shopName: order.shop_name,
          orderSn: order.order_sn
        }]
      };
    }
    
    // Ekstrak SKU dan jumlah
    const skuQuantities = extractSkusWithQuantity(order.sku_qty);
    
    if (skuQuantities.length === 0) {
      return { 
        profit: escrowAmount * defaultMargin, 
        details: [{
          sku: 'Unknown',
          quantity: 1,
          pricePerItem: escrowAmount,
          method: 'margin',
          value: defaultMargin,
          profitPerItem: escrowAmount * defaultMargin,
          totalProfit: escrowAmount * defaultMargin,
          shopName: order.shop_name,
          orderSn: order.order_sn
        }]
      };
    }
    
    // Hitung total jumlah item
    const totalQuantity = skuQuantities.reduce((sum, item) => sum + item.quantity, 0);
    
    // Hitung profit berdasarkan metode yang dipilih
    let totalProfit = 0;
    let usedDefaultForAll = true;
    const details: ProfitDetailItem[] = [];
    
    for (const { sku, quantity } of skuQuantities) {
      const { cost_price, margin_percentage, is_using_cost } = getSkuProfitData(sku);
      
      // Estimasi harga per item
      const estimatedPricePerItem = escrowAmount / totalQuantity;
      let profitPerItem = 0;
      let method: 'modal' | 'margin' = 'margin';
      let value = defaultMargin;
      
      // Hitung profit berdasarkan metode yang dipilih
      if (cost_price !== null && cost_price > 0) {
        // Prioritas 1: Gunakan harga modal jika tersedia
        method = 'modal';
        value = cost_price;
        profitPerItem = Math.max(0, estimatedPricePerItem - cost_price); // Tidak bisa rugi
        totalProfit += profitPerItem * quantity;
        usedDefaultForAll = false;
      } else if (margin_percentage !== null && margin_percentage > 0) {
        // Prioritas 2: Gunakan margin dari database jika modal tidak tersedia
        method = 'margin';
        value = margin_percentage;
        profitPerItem = estimatedPricePerItem * margin_percentage;
        totalProfit += profitPerItem * quantity;
        usedDefaultForAll = false;
      } else {
        // Prioritas 3: Fallback ke default margin jika keduanya tidak tersedia
        method = 'margin';
        value = defaultMargin;
        profitPerItem = estimatedPricePerItem * defaultMargin;
        totalProfit += profitPerItem * quantity;
      }
      
      // Tambahkan detail untuk SKU ini
      details.push({
        sku,
        quantity,
        pricePerItem: estimatedPricePerItem,
        method,
        value,
        profitPerItem,
        totalProfit: profitPerItem * quantity,
        shopName: order.shop_name,
        orderSn: order.order_sn
      });
    }
    
    // Jika semua menggunakan default, gunakan perhitungan sederhana
    if (usedDefaultForAll) {
      return { 
        profit: escrowAmount * defaultMargin, 
        details 
      };
    }
    
    return { profit: totalProfit, details };
  };
  
  // Menghitung profit untuk semua pesanan
  const calculateTotalProfit = async () => {
    if (orders.length === 0) return;
    
    setIsCalculating(true);
    setProfitDetails([]);
    
    try {
      // Gunakan orders langsung karena sudah difilter dari page.tsx
      await fetchAllSkuData(orders);
      
      setDataLoaded(true);
      
      // Hitung profit
      let profit = 0;
      let allDetails: ProfitDetailItem[] = [];
      
      // Proses perhitungan pesanan
      for (const order of orders) {
        const result = calculateOrderProfit(order);
        profit += result.profit;
        allDetails = [...allDetails, ...result.details];
      }
      
      // Dapatkan nilai adsSpend yang benar
      const validAdsSpend = getValidAdsSpend();
      
      // Kurangi dengan biaya iklan
      const profitAfterAds = profit - validAdsSpend;
      
      setTotalProfit(profitAfterAds);
      setLastCalcTime(new Date());
      
      // Siapkan data detail untuk ditampilkan di dialog
      setProfitDetails(allDetails);
      
      // Buat data yang dikelompokkan berdasarkan SKU
      const grouped: {[key: string]: ProfitDetailItem} = {};
      allDetails.forEach(detail => {
        const key = detail.sku;
        if (!grouped[key]) {
          grouped[key] = {
            sku: detail.sku,
            quantity: detail.quantity,
            pricePerItem: detail.pricePerItem * detail.quantity,
            method: detail.method,
            value: detail.value,
            profitPerItem: detail.profitPerItem,
            totalProfit: detail.totalProfit,
          };
        } else {
          grouped[key].quantity += detail.quantity;
          grouped[key].pricePerItem += detail.pricePerItem * detail.quantity;
          grouped[key].totalProfit += detail.totalProfit;
        }
      });
      
      // Hitungkan rata-rata untuk harga per item
      Object.keys(grouped).forEach(key => {
        grouped[key].pricePerItem = grouped[key].pricePerItem / grouped[key].quantity;
        grouped[key].profitPerItem = grouped[key].totalProfit / grouped[key].quantity;
      });
      
      setGroupedDetails(grouped);
      
      // Hitung profit per toko
      const shopProfits: {[key: number]: {
        shopId: number,
        shopName: string,
        totalEscrow: number,
        totalProfit: number,
        adsSpend: number,
        netProfit: number
      }} = {};
      
      // Inisialisasi data toko dari props adsSpend
      if (typeof adsSpend === 'object') {
        // Jika data dalam bentuk Array
        if (Array.isArray(adsSpend)) {
          adsSpend.forEach(ad => {
            // Pastikan menggunakan properti yang benar
            const shopId = ad.shop_id || ad.shopId;
            shopProfits[shopId] = {
              shopId: shopId,
              shopName: ad.shop_name || ad.shopName || `Shop ${shopId}`,
              totalEscrow: 0,
              totalProfit: 0,
              adsSpend: ad.raw_cost || ad.rawCost || ad.totalSpend || 0,
              netProfit: -(ad.raw_cost || ad.rawCost || ad.totalSpend || 0)
            };
          });
        }
        // Jika data dalam bentuk { ads_data: [...] }
        else if ('ads_data' in adsSpend && Array.isArray(adsSpend.ads_data)) {
          adsSpend.ads_data.forEach((ad) => {
            const shopId = ad.shop_id || ad.shopId;
            if (shopId) {
              shopProfits[shopId] = {
                shopId: shopId,
                shopName: ad.shop_name || ad.shopName || `Shop ${shopId}`,
                totalEscrow: 0,
                totalProfit: 0,
                adsSpend: ad.raw_cost || ad.rawCost || ad.totalSpend || 0,
                netProfit: -(ad.raw_cost || ad.rawCost || ad.totalSpend || 0)
              };
            }
          });
        }
      }
      
      console.log("Data adsSpend yang diterima:", adsSpend);
      console.log("Struktur adsSpend:", typeof adsSpend, adsSpend);
      
      console.log("Shop profit data setelah inisialisasi:", shopProfits);
      
      // Kalkulasi profit dari orders per toko
      for (const order of orders) {
        if (!order.shop_id) continue;
        
        const result = calculateOrderProfit(order);
        const escrowAmount = order.escrow_amount_after_adjustment || 0;
        
        // Tambahkan atau perbarui data toko
        if (!shopProfits[order.shop_id]) {
          shopProfits[order.shop_id] = {
            shopId: order.shop_id,
            shopName: order.shop_name,
            totalEscrow: escrowAmount,
            totalProfit: result.profit,
            adsSpend: 0, // Tidak ada data iklan
            netProfit: result.profit // Belum dikurangi iklan
          };
        } else {
          shopProfits[order.shop_id].totalEscrow += escrowAmount;
          shopProfits[order.shop_id].totalProfit += result.profit;
          // Hitung ulang net profit
          shopProfits[order.shop_id].netProfit = 
            shopProfits[order.shop_id].totalProfit - shopProfits[order.shop_id].adsSpend;
        }
      }
      
      setShopProfitData(shopProfits);
      
    } catch (error) {
      console.error('Error calculating profit:', error);
      toast.error('Gagal menghitung profit');
    } finally {
      setIsCalculating(false);
    }
  };
  
  // Hitung margin quick estimate dari escrow dan total profit
  const estimatedMargin = totalProfit && escrowTotal 
    ? (totalProfit / escrowTotal * 100).toFixed(1) 
    : '-';
  
  // Filter hasil rincian berdasarkan search term
  const filteredDetails = profitDetails.filter(detail => 
    detail.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (detail.shopName && detail.shopName.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const filteredGroupedDetails = Object.entries(groupedDetails)
    .filter(([sku]) => sku.toLowerCase().includes(searchTerm.toLowerCase()))
    .reduce((obj, [key, value]) => {
      obj[key] = value;
      return obj;
    }, {} as {[key: string]: ProfitDetailItem});
  
  // Fungsi untuk mengurutkan data berdasarkan kolom
  const sortByTotalProfit = (a: ProfitDetailItem, b: ProfitDetailItem) => 
    b.totalProfit - a.totalProfit;
  
  const windowWidth = window.innerWidth;
  
  useEffect(() => {
    console.log("ProfitCalculator menerima adsSpend:", adsSpend);
  }, [adsSpend]);
  
  return (
    <Card className="bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800 h-full">
      <div className="p-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-teal-800 dark:text-teal-300">
              Estimasi Laba Bersih
            </p>
            <div className="flex-shrink-0">
              <div className="flex items-center gap-1">
                <DownloadReportButton
                  orders={orders}
                  escrowTotal={escrowTotal}
                  adsSpend={adsSpend}
                  profitDetails={profitDetails}
                  shopProfitData={shopProfitData}
                  calculateTotalProfit={calculateTotalProfit}
                  dateRange={dateRange}
                />
                
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6 bg-teal-100/50 dark:bg-teal-900/50 border-teal-200 dark:border-teal-800"
                  onClick={calculateTotalProfit}
                  disabled={isCalculating}
                  title="Hitung Profit"
                >
                  {isCalculating ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                </Button>
                
                <Dialog open={showProfitDetails} onOpenChange={setShowProfitDetails}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-6 w-6 bg-teal-100/50 dark:bg-teal-900/50 border-teal-200 dark:border-teal-800"
                      disabled={profitDetails.length === 0}
                      title="Lihat Detail"
                    >
                      <List className="h-3 w-3" />
                    </Button>
                  </DialogTrigger>
                  
                  <DialogContent className="sm:max-w-[900px] max-h-[80vh] flex flex-col w-[95vw] p-2 sm:p-4 overflow-hidden">
                    <DialogHeader className="pb-1 pr-2 mb-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <DialogTitle className="text-lg">Rincian Profit</DialogTitle>
                      </div>
                    </DialogHeader>
                    
                    <Tabs defaultValue="sku" className="w-full overflow-hidden">
                      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 mb-2">
                        <TabsList>
                          <TabsTrigger value="sku">Per SKU</TabsTrigger>
                          <TabsTrigger value="shop">Per Toko</TabsTrigger>
                        </TabsList>
                        
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Cari..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pl-9 h-8 w-full sm:w-[220px]"
                            />
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSearchTerm('')}
                            disabled={!searchTerm}
                            className="h-8 px-4"
                          >
                            Reset
                          </Button>
                        </div>
                      </div>
                      
                      <TabsContent value="sku">
                        {/* Konten tab SKU yang sudah ada */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 p-2 shadow-sm">
                            <div className="flex items-center justify-between mb-0.5">
                              <h3 className="text-xs font-medium text-blue-800 dark:text-blue-300">Total Escrow</h3>
                              <CreditCard className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <p className="text-sm sm:text-lg font-bold text-blue-700 dark:text-blue-400 break-words">
                              Rp {Math.round(Object.values(filteredGroupedDetails).reduce(
                                (sum, item) => sum + (item.pricePerItem * item.quantity), 0
                              )).toLocaleString('id-ID')}
                            </p>
                          </div>
                          
                          <div className="rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/20 p-2 shadow-sm">
                            <div className="flex items-center justify-between mb-0.5">
                              <h3 className="text-xs font-medium text-green-800 dark:text-green-300">Laba Kotor</h3>
                              <DollarSign className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                            </div>
                            <p className="text-sm sm:text-lg font-bold text-green-700 dark:text-green-400 break-words">
                              Rp {Math.round(Object.values(filteredGroupedDetails).reduce(
                                (sum, item) => sum + item.totalProfit, 0
                              )).toLocaleString('id-ID')}
                            </p>
                          </div>
                          
                          <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 p-2 shadow-sm">
                            <div className="flex items-center justify-between mb-0.5">
                              <h3 className="text-xs font-medium text-red-800 dark:text-red-300">Biaya Iklan</h3>
                              <Eye className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                            </div>
                            <p className="text-sm sm:text-lg font-bold text-red-700 dark:text-red-400 break-words">
                              Rp {Math.round(getValidAdsSpend()).toLocaleString('id-ID')}
                            </p>
                          </div>
                          
                          <div className="rounded-lg border border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-900/20 p-2 shadow-sm">
                            <div className="flex items-center justify-between mb-0.5">
                              <h3 className="text-xs font-medium text-purple-800 dark:text-purple-300">Total Profit</h3>
                              <BarChart3 className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <p className="text-sm sm:text-lg font-bold text-purple-700 dark:text-purple-400 break-words">
                              Rp {Math.round(Object.values(filteredGroupedDetails).reduce(
                                (sum, item) => sum + item.totalProfit, 0
                              ) - getValidAdsSpend()).toLocaleString('id-ID')}
                            </p>
                          </div>
                        </div>
                        
                        <ScrollArea className="flex-1 overflow-y-auto pr-0 sm:pr-4 min-h-[200px] max-h-[50vh] mb-4">
                          <div className="overflow-x-auto mb-4">
                            <Table className="w-full">
                              <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow className="border-b border-primary/20">
                                  <TableHead className="w-10 py-1.5 text-center font-medium px-1">#</TableHead>
                                  <TableHead className="py-1.5 font-medium px-1 w-[40%] sm:w-[30%]">SKU</TableHead>
                                  <TableHead className="py-1.5 text-center font-medium px-1 w-[15%] sm:w-[8%]">Qty</TableHead>
                                  <TableHead className="hidden sm:table-cell py-1.5 font-medium px-1 w-[22%]">Metode</TableHead>
                                  <TableHead className="hidden sm:table-cell py-1.5 text-right font-medium px-1 w-[20%]">Harga/Item</TableHead>
                                  <TableHead className="py-1.5 text-right font-medium px-1 w-[45%] sm:w-[20%]">Profit</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {Object.entries(filteredGroupedDetails)
                                  .sort(([, a], [, b]) => b.totalProfit - a.totalProfit)
                                  .slice(0, windowWidth < 768 ? 10 : undefined)
                                  .map(([sku, detail], index) => (
                                  <TableRow key={sku} className={index % 2 === 0 ? 'bg-muted/30' : ''}>
                                    <TableCell className="py-1 text-center font-medium px-1">{index + 1}</TableCell>
                                    {/* SKU - Untuk mobile dan desktop */}
                                    <TableCell className="py-1 font-mono text-xs px-1">
                                      <div className="flex flex-col">
                                        <span className="truncate max-w-[150px]">{detail.sku}</span>
                                        {/* Harga per item hanya ditampilkan di mobile */}
                                        <span className="sm:hidden text-xs text-muted-foreground mt-0.5">
                                          Rp {Math.round(detail.pricePerItem).toLocaleString('id-ID')}
                                        </span>
                                      </div>
                                    </TableCell>
                                    
                                    {/* Quantity - Untuk mobile dan desktop */}
                                    <TableCell className="py-1 text-center font-medium px-1">{detail.quantity}</TableCell>
                                    
                                    {/* Metode - Hanya untuk desktop */}
                                    <TableCell className="hidden sm:table-cell py-1 px-1">
                                      <div className="flex items-center space-x-2">
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                          detail.method === 'modal' 
                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' 
                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                        }`}>
                                          {detail.method === 'modal' ? 'Modal' : 'Margin'}
                                        </span>
                                        <span className="text-sm">
                                          {detail.method === 'modal' 
                                            ? `Rp ${detail.value?.toLocaleString('id-ID') || '-'}`
                                            : `${(detail.value * 100).toFixed(1)}%`
                                          }
                                        </span>
                                      </div>
                                    </TableCell>
                                    
                                    {/* Harga rata-rata per item - Hanya untuk desktop */}
                                    <TableCell className="hidden sm:table-cell py-1 text-right px-1">
                                      <span className="text-sm">
                                        Rp {Math.round(detail.pricePerItem).toLocaleString('id-ID')}
                                      </span>
                                    </TableCell>
                                    
                                    {/* Profit - Untuk mobile dan desktop */}
                                    <TableCell className="py-0.5 sm:py-1 text-right px-0.5 sm:px-1">
                                      <div className="flex flex-col items-end">
                                        {/* Label metode dan nilainya hanya di mobile */}
                                        <span className={`sm:hidden px-1 py-0.5 rounded-full text-[10px] font-medium ${
                                          detail.method === 'modal' 
                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' 
                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                        }`}>
                                          {detail.method === 'modal' ? 'Modal' : 'Margin'}
                                        </span>
                                        <span className="sm:hidden text-xs mt-0.5">
                                          {detail.method === 'modal' 
                                            ? `Rp ${detail.value?.toLocaleString('id-ID') || '-'}`
                                            : `${(detail.value * 100).toFixed(1)}%`
                                          }
                                        </span>
                                        {/* Nilai profit selalu ditampilkan */}
                                        <span className={`text-sm font-medium mt-0.5 ${detail.totalProfit > 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                          Rp {Math.round(detail.totalProfit).toLocaleString('id-ID')}
                                        </span>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </ScrollArea>
                      </TabsContent>
                      
                      <TabsContent value="shop">
                        {/* Ringkasan statistik untuk tab toko */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 p-2 shadow-sm">
                            <div className="flex items-center justify-between mb-0.5">
                              <h3 className="text-xs font-medium text-blue-800 dark:text-blue-300">Total Escrow</h3>
                              <CreditCard className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <p className="text-sm sm:text-lg font-bold text-blue-700 dark:text-blue-400 break-words">
                              Rp {Math.round(Object.values(shopProfitData).reduce(
                                (sum, shop) => sum + shop.totalEscrow, 0
                              )).toLocaleString('id-ID')}
                            </p>
                          </div>
                          
                          <div className="rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/20 p-2 shadow-sm">
                            <div className="flex items-center justify-between mb-0.5">
                              <h3 className="text-xs font-medium text-green-800 dark:text-green-300">Laba Kotor</h3>
                              <DollarSign className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                            </div>
                            <p className="text-sm sm:text-lg font-bold text-green-700 dark:text-green-400 break-words">
                              Rp {Math.round(Object.values(shopProfitData).reduce(
                                (sum, shop) => sum + shop.totalProfit, 0
                              )).toLocaleString('id-ID')}
                            </p>
                          </div>
                          
                          <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 p-2 shadow-sm">
                            <div className="flex items-center justify-between mb-0.5">
                              <h3 className="text-xs font-medium text-red-800 dark:text-red-300">Biaya Iklan</h3>
                              <Eye className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                            </div>
                            <p className="text-sm sm:text-lg font-bold text-red-700 dark:text-red-400 break-words">
                              Rp {Math.round(Object.values(shopProfitData).reduce(
                                (sum, shop) => sum + shop.adsSpend, 0
                              )).toLocaleString('id-ID')}
                            </p>
                          </div>
                          
                          <div className="rounded-lg border border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-900/20 p-2 shadow-sm">
                            <div className="flex items-center justify-between mb-0.5">
                              <h3 className="text-xs font-medium text-purple-800 dark:text-purple-300">Total Profit</h3>
                              <BarChart3 className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <p className="text-sm sm:text-lg font-bold text-purple-700 dark:text-purple-400 break-words">
                              Rp {Math.round(Object.values(shopProfitData).reduce(
                                (sum, shop) => sum + shop.netProfit, 0
                              )).toLocaleString('id-ID')}
                            </p>
                          </div>
                        </div>
                        
                        <ScrollArea className="flex-1 overflow-y-auto pr-0 sm:pr-4 min-h-[200px] max-h-[50vh] mb-4">
                          <div className="overflow-x-auto mb-4">
                            {/* Versi desktop - tabel normal */}
                            <div className="hidden sm:block">
                              <Table className="w-full mb-11">
                                <TableHeader className="sticky top-0 bg-background z-10">
                                  <TableRow className="border-b border-primary/20">
                                    <TableHead className="w-8 py-1.5 text-center font-medium px-1">#</TableHead>
                                    <TableHead className="py-1.5 font-medium px-1 w-[30%]">Toko</TableHead>
                                    <TableHead className="py-1.5 text-right font-medium px-1 w-[17%]">Escrow</TableHead>
                                    <TableHead className="py-1.5 text-right font-medium px-1 w-[17%]">Laba Kotor</TableHead>
                                    <TableHead className="py-1.5 text-right font-medium px-1 w-[17%]">Biaya Iklan</TableHead>
                                    <TableHead className="py-1.5 text-right font-medium px-1 w-[19%]">Profit</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {Object.entries(shopProfitData).length === 0 ? (
                                    <TableRow>
                                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-sm">
                                        {searchTerm 
                                          ? `Tidak ada toko yang cocok dengan pencarian "${searchTerm}"`
                                          : 'Belum ada data profit. Klik tombol "Hitung Profit" untuk mulai.'}
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    Object.values(shopProfitData)
                                      .filter(shop => 
                                        shop.shopName.toLowerCase().includes(searchTerm.toLowerCase())
                                      )
                                      .sort((a, b) => b.netProfit - a.netProfit) // Urutkan berdasarkan netProfit
                                      .map((shop, index) => (
                                      <TableRow key={shop.shopId} className={index % 2 === 0 ? 'bg-muted/30' : 'hover:bg-muted/20'}>
                                        <TableCell className="py-1.5 text-center font-medium px-1">{index + 1}</TableCell>
                                        <TableCell className="py-1.5 px-2">
                                          <div className="flex flex-col">
                                            <span className="truncate max-w-[250px] font-medium text-primary">
                                              {shop.shopName}
                                            </span>
                                            <span className="text-xs text-muted-foreground">ID: {shop.shopId}</span>
                                          </div>
                                        </TableCell>
                                        <TableCell className="py-1.5 text-right px-2">
                                          <span className="text-sm font-medium">
                                            Rp {Math.round(shop.totalEscrow).toLocaleString('id-ID')}
                                          </span>
                                          <div className="text-xs text-muted-foreground">
                                            {(shop.totalEscrow / escrowTotal * 100).toFixed(1)}% dari total
                                          </div>
                                        </TableCell>
                                        <TableCell className="py-1.5 text-right px-2">
                                          <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                            Rp {Math.round(shop.totalProfit).toLocaleString('id-ID')}
                                          </span>
                                          <div className="text-xs text-muted-foreground">
                                            {(shop.totalProfit / shop.totalEscrow * 100).toFixed(1)}% margin
                                          </div>
                                        </TableCell>
                                        <TableCell className="py-1.5 text-right px-2">
                                          <span className="text-sm font-medium text-red-600 dark:text-red-400">
                                            Rp {Math.round(shop.adsSpend).toLocaleString('id-ID')}
                                          </span>
                                          <div className="text-xs text-muted-foreground">
                                            {shop.totalProfit > 0 ? (shop.adsSpend / shop.totalProfit * 100).toFixed(1) : '0'}% dari laba
                                          </div>
                                        </TableCell>
                                        <TableCell className="py-1.5 text-right px-2">
                                          <span className={`text-sm font-bold ${shop.netProfit >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                            Rp {Math.round(shop.netProfit).toLocaleString('id-ID')}
                                          </span>
                                          <div className="text-xs text-muted-foreground">
                                            {shop.totalEscrow > 0 ? (shop.netProfit / shop.totalEscrow * 100).toFixed(1) : '0'}% ROI
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                            
                            {/* Versi mobile - tampilan kartu */}
                            <div className="sm:hidden mb-11">
                              {Object.values(shopProfitData)
                                .filter(shop => shop.shopName.toLowerCase().includes(searchTerm.toLowerCase()))
                                .sort((a, b) => b.netProfit - a.netProfit)
                                .map((shop, index) => (
                                  <div key={shop.shopId} className={`mb-2 p-2 rounded-lg ${index % 2 === 0 ? 'bg-muted/30' : ''}`}>
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="font-medium text-sm">{shop.shopName.split(' ')[0]}</span>
                                      <span className={`text-sm font-bold ${shop.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                        {formatCompactNumber(shop.netProfit)}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1 text-xs">
                                      <div>
                                        <div className="text-muted-foreground">Escrow</div>
                                        <div>{formatCompactNumber(shop.totalEscrow)}</div>
                                      </div>
                                      <div>
                                        <div className="text-muted-foreground">Laba</div>
                                        <div>{formatCompactNumber(shop.totalProfit)}</div>
                                      </div>
                                      <div>
                                        <div className="text-muted-foreground">Iklan</div>
                                        <div className="text-red-700">{formatCompactNumber(shop.adsSpend)}</div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </ScrollArea>
                      </TabsContent>
                    </Tabs>
                    
                    <DialogFooter className="pt-1 border-t mt-1">
                      <div className="w-full flex items-center justify-between">
                        <div className="flex items-center text-xs text-muted-foreground gap-1">
                          <div className="flex items-center gap-1">
                            <ListIcon className="h-3 w-3" />
                            <span className="font-medium">{Object.keys(filteredGroupedDetails).length}</span> SKU
                            <span className="text-green-700 dark:text-green-400">
                              (<span className="font-medium">{Object.values(filteredGroupedDetails).reduce((sum, item) => sum + item.quantity, 0)}</span>)
                            </span>
                          </div>
                        </div>
                        <DialogClose asChild>
                          <Button type="button" size="sm" className="h-8">
                            Tutup
                          </Button>
                        </DialogClose>
                      </div>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                
                <ProfitabilitySettingsDialog 
                  onChange={() => { /* do not immediately trigger calculation - user can click refresh button */ }}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xl font-bold text-teal-700 dark:text-teal-400 truncate pr-2">
              Rp {isCalculating 
                  ? "Menghitung..." 
                  : Math.max(0, totalProfit).toLocaleString('id-ID')
                }
            </p>
            <div className="p-1.5 rounded-lg bg-teal-100 dark:bg-teal-800/40 flex-shrink-0">
              <Wallet className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            </div>
          </div>
          <div className="flex justify-between text-xs text-teal-600 dark:text-teal-500 pt-1">
            <span>~{estimatedMargin}% margin</span>
            {lastCalcTime && (
              <span>
                Update: {lastCalcTime.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
} 