'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Wallet, RefreshCw, List, Search, CreditCard, DollarSign, Eye, BarChart3, CalendarIcon, ListIcon, Tag, FileSpreadsheet, AlertTriangle, Check } from 'lucide-react'
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
import { Badge } from "@/components/ui/badge"

interface ProfitCalculatorProps {
  orders: Order[]
  escrowTotal: number
  adsSpend: number | string | { ads_data: any[], total_cost: string, raw_cost: number }
  dateRange?: { from: Date | undefined, to?: Date | undefined } | undefined
  onMissingHppChange?: (items: MissingHppItem[]) => void
  adsLoading?: boolean
}

// Interface untuk item rincian profit
interface ProfitDetailItem {
  sku: string
  tier1: string
  quantity: number
  pricePerItem: number
  method: 'modal' | 'margin'
  value: number
  profitPerItem: number
  totalProfit: number
  shopName?: string
  orderSn?: string
}

interface MissingHppItem {
  sku: string
  tier1: string
  orderSn: string
  shopName: string
  item_id?: number
  shop_id?: number
}

export type { MissingHppItem }

// Tambahkan fungsi formatCompactNumber di dalam komponen ProfitCalculator
// atau di luar jika Anda ingin menggunakannya di komponen lain
const formatCompactNumber = (number: number): string => {
  if (number < 1000) return `Rp ${Math.round(number)}`;
  if (number < 1000000) return `Rp ${(number / 1000).toFixed(1)}rb`;
  return `Rp ${(number / 1000000).toFixed(1)}jt`;
};

export default function ProfitCalculator({
  orders,
  escrowTotal,
  adsSpend,
  dateRange,
  onMissingHppChange,
  adsLoading = false
}: ProfitCalculatorProps) {
  const [totalProfit, setTotalProfit] = useState<number>(0)
  const [isCalculating, setIsCalculating] = useState<boolean>(false)
  const [lastCalcTime, setLastCalcTime] = useState<Date | null>(null)
  const [defaultMargin] = useState<number>(0.15) // 25% default margin
  const [skuProfitData, setSkuProfitData] = useState<{
    [key: string]: {
      cost_price: number | null
    }
  }>({})
  // State untuk dialog rincian
  const [showProfitDetails, setShowProfitDetails] = useState(false)
  const [profitDetails, setProfitDetails] = useState<ProfitDetailItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [groupedDetails, setGroupedDetails] = useState<{ [key: string]: ProfitDetailItem }>({})
  const [dataLoaded, setDataLoaded] = useState(false)
  const [shopProfitData, setShopProfitData] = useState<{
    [key: number]: {
      shopId: number,
      shopName: string,
      totalEscrow: number,
      totalProfit: number,
      adsSpend: number,
      netProfit: number
    }
  }>({})
  const [autoCalculated, setAutoCalculated] = useState(false)

  // Missing HPP tracking
  const [missingHppItems, setMissingHppItems] = useState<MissingHppItem[]>([])

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
      !isCalculating // Tidak sedang menghitung
    ) {
      // Jalankan kalkulasi otomatis (tanpa menunggu ads data)
      calculateTotalProfit();
      setAutoCalculated(true); // Tandai sudah kalkulasi otomatis
    }
  }, [dataLoaded, orders, escrowTotal, isCalculating, autoCalculated]);

  // Recalculate ketika ads data selesai loading
  useEffect(() => {
    if (!adsLoading && autoCalculated && dataLoaded && orders.length > 0) {
      calculateTotalProfit();
    }
  }, [adsLoading]);

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

  // Fungsi untuk mengambil semua data HPP sekaligus dari hpp_master
  const fetchAllSkuData = async (orders: Order[]) => {
    try {
      const { data: { user } } = await createClient().auth.getUser()

      if (!user) {
        toast.error('Anda harus login untuk mengakses fitur ini')
        return
      }

      // Query hpp_master
      const { data, error } = await createClient()
        .from('hpp_master')
        .select('item_sku, tier1_variation, cost_price')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching HPP data:', error);
        return;
      }

      // Build lookup map keyed by "SKU|TIER1"
      const skuMap: { [key: string]: { cost_price: number | null } } = {};
      data?.forEach(item => {
        const key = `${item.item_sku.toUpperCase()}|${(item.tier1_variation || '').toUpperCase()}`;
        skuMap[key] = { cost_price: item.cost_price };
      });

      setSkuProfitData(skuMap);

      // Detect missing SKUs/tier1s and trigger sync
      await syncMissingSkus(orders, skuMap, user.id);

    } catch (error) {
      console.error('Error in fetchAllSkuData:', error);
    }
  };

  // Sync missing SKU variations from Shopee API
  const syncMissingSkus = async (
    orders: Order[],
    currentMap: { [key: string]: any },
    userId: string
  ) => {
    // Collect SKUs that are in orders but not in hpp_master
    const missingSkus = new Map<string, { sku: string, shop_id: number, item_id: number }>();

    for (const order of orders) {
      if (!order.items || !order.shop_id) continue;
      for (const item of order.items) {
        const key = `${item.sku.toUpperCase()}|${(item.tier1_variation || '').toUpperCase()}`;
        if (!currentMap[key] && item.item_id) {
          // Use SKU as dedup key (only need to sync once per SKU)
          const skuKey = item.sku.toUpperCase();
          if (!missingSkus.has(skuKey)) {
            missingSkus.set(skuKey, {
              sku: item.sku,
              shop_id: order.shop_id,
              item_id: item.item_id
            });
          }
        }
      }
    }

    if (missingSkus.size === 0) return;

    try {
      const response = await fetch('/api/hpp/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skus: Array.from(missingSkus.values()) })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.inserted > 0) {
          console.log(`Synced ${result.inserted} new SKU variations`);
          // Refetch HPP data after sync
          const { data: newData } = await createClient()
            .from('hpp_master')
            .select('item_sku, tier1_variation, cost_price')
            .eq('user_id', userId);

          if (newData) {
            const newMap: { [key: string]: { cost_price: number | null } } = {};
            newData.forEach(item => {
              const k = `${item.item_sku.toUpperCase()}|${(item.tier1_variation || '').toUpperCase()}`;
              newMap[k] = { cost_price: item.cost_price };
            });
            setSkuProfitData(newMap);
          }
        }
      }
    } catch (err) {
      console.error('Error syncing missing SKUs:', err);
    }
  };

  // Lookup HPP data with priority: exact SKU+tier1 → fallback SKU only → default
  const getSkuProfitData = (sku: string, tier1: string = ''): {
    cost_price: number | null
  } => {
    const normalizedSku = sku.toUpperCase();
    const normalizedTier1 = tier1.toUpperCase().trim();

    // 1. Exact match: SKU + tier1
    const exactKey = `${normalizedSku}|${normalizedTier1}`;
    if (skuProfitData[exactKey]?.cost_price !== undefined) {
      return skuProfitData[exactKey];
    }

    // 2. Fallback: any entry for this SKU that has cost_price set
    const fallbackEntry = Object.entries(skuProfitData).find(
      ([key, val]) => key.startsWith(`${normalizedSku}|`) && val.cost_price !== null && val.cost_price > 0
    );
    if (fallbackEntry) {
      return fallbackEntry[1];
    }

    // 3. Default
    return { cost_price: null };
  };

  // Fungsi calculateOrderProfit — sekarang matching per tier1 variation
  const calculateOrderProfit = (order: Order): { profit: number, details: ProfitDetailItem[] } => {
    if (!order.escrow_amount_after_adjustment ||
      order.escrow_amount_after_adjustment <= 0) {
      return { profit: 0, details: [] };
    }

    const escrowAmount = order.escrow_amount_after_adjustment;

    if (!order.items || order.items.length === 0) {
      return {
        profit: escrowAmount * defaultMargin,
        details: [{
          sku: 'Unknown',
          tier1: '',
          quantity: 1,
          pricePerItem: escrowAmount,
          method: 'margin' as const,
          value: defaultMargin,
          profitPerItem: escrowAmount * defaultMargin,
          totalProfit: escrowAmount * defaultMargin,
          shopName: order.shop_name,
          orderSn: order.order_sn
        }]
      };
    }

    const totalOrderPrice = order.items.reduce((sum, item) => sum + item.total_price, 0);
    let totalProfit = 0;
    const details: ProfitDetailItem[] = [];

    for (const item of order.items) {
      const itemEscrowProportion = item.total_price / totalOrderPrice;
      const itemEscrow = escrowAmount * itemEscrowProportion;

      // Lookup HPP by SKU + tier1
      const { cost_price } = getSkuProfitData(item.sku, item.tier1_variation || '');

      let profitPerItem = 0;
      let method: 'modal' | 'margin';
      let value = defaultMargin;

      if (cost_price !== null && cost_price > 0) {
        method = 'modal';
        value = cost_price;
        profitPerItem = Math.max(0, (itemEscrow / item.quantity) - cost_price);
      } else {
        method = 'margin';
        value = defaultMargin;
        profitPerItem = (itemEscrow / item.quantity) * value;
      }

      const itemTotalProfit = profitPerItem * item.quantity;
      totalProfit += itemTotalProfit;

      details.push({
        sku: item.sku,
        tier1: item.tier1_variation || '',
        quantity: item.quantity,
        pricePerItem: itemEscrow / item.quantity,
        method,
        value,
        profitPerItem,
        totalProfit: itemTotalProfit,
        shopName: order.shop_name,
        orderSn: order.order_sn
      });
    }

    return { profit: totalProfit, details };
  };

  // Fungsi calculateTotalProfit tetap sama, tapi sekarang menggunakan calculateOrderProfit yang dioptimasi
  const calculateTotalProfit = async () => {
    if (orders.length === 0) return;

    setIsCalculating(true);
    setProfitDetails([]);

    try {
      const { data: { user } } = await createClient().auth.getUser();

      if (!user) {
        toast.error('Anda harus login untuk menghitung profit');
        setIsCalculating(false);
        return;
      }

      await fetchAllSkuData(orders);
      setDataLoaded(true);

      let profit = 0;
      let allDetails: ProfitDetailItem[] = [];

      // Proses setiap order
      for (const order of orders) {
        const result = calculateOrderProfit(order);
        profit += result.profit;
        allDetails = [...allDetails, ...result.details];
      }

      // Dapatkan nilai adsSpend yang valid
      const validAdsSpend = getValidAdsSpend();
      const profitAfterAds = profit - validAdsSpend;

      setTotalProfit(profitAfterAds);
      setLastCalcTime(new Date());
      setProfitDetails(allDetails);

      // Buat data yang dikelompokkan berdasarkan SKU + tier1
      const grouped: { [key: string]: ProfitDetailItem } = {};
      allDetails.forEach(detail => {
        const key = `${detail.sku}|${detail.tier1 || ''}`;
        if (!grouped[key]) {
          grouped[key] = {
            sku: detail.sku,
            tier1: detail.tier1 || '',
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

      // Collect missing HPP items per order (not per unique SKU)
      const missing: MissingHppItem[] = [];
      const seenPerOrder = new Set<string>();
      allDetails.forEach(detail => {
        if (detail.method === 'margin' && detail.sku !== 'Unknown') {
          const dedupKey = `${detail.orderSn}|${detail.sku}|${detail.tier1}`;
          if (!seenPerOrder.has(dedupKey)) {
            seenPerOrder.add(dedupKey);
            const srcOrder = orders.find(o => o.order_sn === detail.orderSn);
            const srcItem = srcOrder?.items?.find(i => i.sku === detail.sku);
            missing.push({
              sku: detail.sku,
              tier1: detail.tier1 || '',
              orderSn: detail.orderSn || '',
              shopName: detail.shopName || '',
              item_id: srcItem?.item_id,
              shop_id: srcOrder?.shop_id,
            });
          }
        }
      });
      setMissingHppItems(missing);
      if (onMissingHppChange) onMissingHppChange(missing);

      // Hitung profit per toko
      const shopProfits: {
        [key: number]: {
          shopId: number,
          shopName: string,
          totalEscrow: number,
          totalProfit: number,
          adsSpend: number,
          netProfit: number
        }
      } = {};

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
    (detail.tier1 && detail.tier1.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (detail.shopName && detail.shopName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredGroupedDetails = Object.entries(groupedDetails)
    .filter(([key, val]) => {
      const searchLower = searchTerm.toLowerCase();
      return key.toLowerCase().includes(searchLower) ||
        val.sku.toLowerCase().includes(searchLower) ||
        (val.tier1 && val.tier1.toLowerCase().includes(searchLower));
    })
    .reduce((obj, [key, value]) => {
      obj[key] = value;
      return obj;
    }, {} as { [key: string]: ProfitDetailItem });

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
                                          {detail.tier1 && (
                                            <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                                              {detail.tier1}
                                            </span>
                                          )}
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
                                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${detail.method === 'modal'
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
                                          <span className={`sm:hidden px-1 py-0.5 rounded-full text-[10px] font-medium ${detail.method === 'modal'
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