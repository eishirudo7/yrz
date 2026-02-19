'use client'
import { useOrders } from '@/app/hooks/useOrders'
import type { Order } from '@/app/hooks/useOrders'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import {
  Calendar as CalendarIcon,
  RefreshCw,
  AlertCircle,
  Search,
  X,
  ChevronDown,
  Store,
  BarChart3,
  FileText,
} from "lucide-react"
import { format } from "date-fns"
import { id } from 'date-fns/locale'
import { cn } from "@/lib/utils"
import { DateRange } from "react-day-picker"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useOrderSearch } from '@/app/hooks/useOrderSearch'
import { toast } from 'sonner'
import { OrderDetails } from '../dashboard/OrderDetails'
import { OrderHistory } from '../dashboard/OrderHistory'
import { OrderTrendChart } from './components/OrderTrendChart'
import { SKUSalesChart } from "./components/SKUSalesChart"
import { ShopOrderChart } from "./components/ShopOrderChart"
import { OrderStatusCard } from './components/OrderStatusCard'
import { useTheme } from "next-themes"
import ChatButton from '@/components/ChatButton'
import ProfitCalculator from './components/ProfitCalculator'

// Extracted components and utilities
import { SummaryCards } from './components/SummaryCards'
import { SkuSummaryCard, ShopSummaryCard } from './components/SkuSummaryCard'
import {
  formatDate,
  isFakeOrder,
  calculateOrderStats,
  getShopsSummary,
  getAllTopSkus,
  type SkuSummary,
  type ShopSummary,
} from './utils/orderUtils'

// TableRowSkeleton component for loading state
function TableRowSkeleton() {
  return (
    <TableRow>
      <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-6" /></TableCell>
      <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-20" /></TableCell>
    </TableRow>
  )
}

export default function OrdersPage() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  })
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>(date)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string | null>('total')
  const [selectedShops, setSelectedShops] = useState<string[]>([])
  const [isShopFilterOpen, setIsShopFilterOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchType, setSearchType] = useState("order_sn")

  // Tambahkan state untuk timeout handling
  const [apiTimeout, setApiTimeout] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [timeoutDuration, setTimeoutDuration] = useState(30) // dalam detik

  const {
    orders,
    ordersWithoutEscrow,
    loading: ordersLoading,
    error: ordersError,
    syncMissingEscrowData,
    syncingEscrow,
    syncType,
    syncProgress,
    adsData,
    totalAdsSpend,
    refetch // Tambahkan fungsi refetch dari useOrders jika tersedia, atau implementasikan di hook
  } = useOrders(selectedDateRange)
  const [visibleOrders, setVisibleOrders] = useState<Order[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const loadingRef = useRef<HTMLDivElement>(null)
  const ITEMS_PER_PAGE = 50 // Increased from 20 for better performance
  const { searchOrders, searchResults, loading: searchLoading } = useOrderSearch()



  // Tambahkan state untuk tracking toko yang sedang dibuka
  const [expandedShop, setExpandedShop] = useState<string | null>(null);

  // Tambahkan state untuk tracking SKU yang sedang diperluas
  const [expandedSku, setExpandedSku] = useState<string | null>(null);

  // Tambahkan state untuk tracking apakah pencarian baru saja dilakukan
  const [isSearching, setIsSearching] = useState(false)

  // Tambahkan state untuk loading pencarian
  const [isSearchLoading, setIsSearchLoading] = useState(false)

  // Ubah state untuk menyimpan orderSn saja
  const [selectedOrderSn, setSelectedOrderSn] = useState<string | null>(null)

  // Tambahkan state untuk mengontrol apakah modal detail terbuka
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  // Tambahkan state untuk OrderHistory
  const [isOrderHistoryOpen, setIsOrderHistoryOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string>('')

  // Tambahkan state untuk mengontrol mode tampilan
  const [viewMode, setViewMode] = useState<'chart' | 'text'>('chart')

  // Tambahkan hook useTheme
  const { theme } = useTheme()
  const isDarkMode = theme === 'dark'

  // Tambahkan state untuk menampilkan/menyembunyikan detail iklan
  const [showAdsDetails, setShowAdsDetails] = useState(false);

  // Tambahkan useEffect untuk mendeteksi timeout (FIXED: proper cleanup)
  useEffect(() => {
    if (!ordersLoading) {
      // Reset timeout jika tidak loading
      setApiTimeout(false);
      return;
    }

    if (apiTimeout) {
      // Sudah timeout, jangan set timer lagi
      return;
    }

    // Set timeout hanya jika loading dan belum timeout
    const timeoutId = setTimeout(() => {
      setApiTimeout(true);
    }, timeoutDuration * 1000);

    // Cleanup: timeoutId PASTI ada karena kode di atas
    return () => {
      clearTimeout(timeoutId);
    };
  }, [ordersLoading, apiTimeout, timeoutDuration]);

  // Fungsi untuk mencoba lagi dengan timeout yang lebih lama
  const handleRetryWithLongerTimeout = () => {
    setRetryCount(prev => prev + 1);
    setApiTimeout(false);
    setTimeoutDuration(prev => prev + 30); // Tambah 30 detik setiap retry

    // Jika ada fungsi refetch di hook useOrders, panggil di sini
    if (typeof refetch === 'function') {
      refetch();
    } else {
      // Gunakan cara alternatif untuk mem-fetch ulang data
      if (selectedDateRange?.from) {
        setSelectedDateRange({
          from: selectedDateRange.from,
          to: selectedDateRange.to
        }); // Trigger re-fetch dengan mengubah state
      }
    }
  };

  // Komponen UI untuk menampilkan pesan timeout
  const TimeoutMessage = () => (
    <div className="w-full p-6 flex flex-col items-center justify-center">
      <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-6 max-w-lg w-full">
        <div className="flex flex-col items-center text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
          <div>
            <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">
              Request Timeout
            </h3>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              Data pesanan membutuhkan waktu yang lama untuk dimuat. Rentang tanggal yang dipilih mungkin terlalu luas atau database sedang sibuk.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => {
                setDate({
                  from: new Date(),
                  to: new Date(),
                });
                setSelectedDateRange({
                  from: new Date(),
                  to: new Date(),
                });
                setApiTimeout(false);
                setRetryCount(0);
                setTimeoutDuration(30);
              }}
              className="border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/40"
            >
              Pilih Hari Ini
            </Button>
            <Button
              onClick={handleRetryWithLongerTimeout}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Coba Lagi ({timeoutDuration}s)
            </Button>
          </div>
          {retryCount > 0 && (
            <p className="text-xs text-red-500 dark:text-red-400">
              Percobaan ke-{retryCount}. Setiap percobaan menambah waktu timeout 30 detik.
            </p>
          )}
        </div>
      </div>
    </div>
  );



  // Dapatkan daftar unik toko dari orders
  const uniqueShops = Array.from(new Set(orders.map(order => order.shop_name))).sort()

  // Optimalkan dengan useMemo untuk menghindari kalkulasi ulang yang tidak perlu
  const filteredOrdersByShop = useMemo(() => {
    return orders.filter(order => {
      if (selectedShops.length === 0) return true
      return selectedShops.includes(order.shop_name)
    })
  }, [orders, selectedShops])

  // Hitung statistik berdasarkan pesanan yang sudah difilter berdasarkan toko (OPTIMIZED: using memoized function)
  const filteredOrderStats = useMemo(
    () => calculateOrderStats(filteredOrdersByShop),
    [filteredOrdersByShop]
  )

  // Optimalkan filtered orders dengan useMemo
  const filteredOrders = useMemo(() => {
    if (searchResults.length > 0) return searchResults;

    return filteredOrdersByShop.filter(order => {
      if (!activeFilter) return true;

      if (activeFilter === 'fake') {
        return isFakeOrder(order);
      }

      if (activeFilter === 'failed') {
        return order.cancel_reason === 'Failed Delivery';
      }

      // Jika ini fake order, jangan tampilkan di filter lain
      if (isFakeOrder(order)) return false;

      switch (activeFilter) {
        case 'pending':
          return order.order_status === 'UNPAID';
        case 'process':
          return order.order_status === 'PROCESSED';
        case 'shipping':
          return order.order_status === 'SHIPPED';
        case 'completed':
          return order.order_status === 'COMPLETED' &&
            !(order.escrow_amount_after_adjustment !== undefined &&
              order.escrow_amount_after_adjustment !== null &&
              order.escrow_amount_after_adjustment < 0);
        case 'confirm':
          return order.order_status === 'TO_CONFIRM_RECEIVE';
        case 'return':
          return order.order_status === 'TO_RETURN' ||
            (order.order_status === 'COMPLETED' &&
              order.escrow_amount_after_adjustment !== undefined &&
              order.escrow_amount_after_adjustment !== null &&
              order.escrow_amount_after_adjustment < 0);
        case 'cancel':
          return order.order_status === 'CANCELLED';
        case 'total':
          if (order.cancel_reason === 'Failed Delivery') return false;
          if (order.order_status === 'TO_RETURN') return false;
          if (order.order_status === 'COMPLETED' &&
            order.escrow_amount_after_adjustment !== undefined &&
            order.escrow_amount_after_adjustment !== null &&
            order.escrow_amount_after_adjustment < 0) return false;
          return !['CANCELLED', 'UNPAID'].includes(order.order_status);
        default:
          return true;
      }
    }).sort((a, b) => {
      // Urutkan berdasarkan pay_time (dari baru ke lama)
      const aTime = a.cod ? a.create_time : (a.pay_time || a.create_time);
      const bTime = b.cod ? b.create_time : (b.pay_time || b.create_time);
      return bTime - aTime;
    });
  }, [searchResults, filteredOrdersByShop, activeFilter]);

  // Optimisasi fungsi format dengan useCallback
  // Tambahkan useEffect untuk memantau hasil pencarian
  useEffect(() => {
    if (isSearching && !searchLoading) {
      if (searchResults.length === 0) {
        toast.error(`Tidak ditemukan hasil untuk pencarian "${searchQuery}" pada ${searchType === "order_sn" ? "nomor pesanan" :
          searchType === "tracking_number" ? "nomor resi" :
            "username"
          }`)
      }
      setIsSearching(false)
    }
  }, [searchResults, searchLoading, isSearching, searchQuery, searchType])

  const handleSearch = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (searchQuery.length < 4) {
        toast.error(`Minimal 4 karakter untuk melakukan pencarian ${searchType === "order_sn" ? "nomor pesanan" :
          searchType === "tracking_number" ? "nomor resi" :
            "username"
          }`)
        return
      }

      // Set loading state sebelum pencarian
      setIsSearchLoading(true)
      setActiveFilter(null)
      setSelectedShops([])
      setIsSearching(true)

      const searchParams = {
        [searchType]: searchQuery
      }

      try {
        await searchOrders(searchParams)
      } finally {
        // Reset loading state setelah pencarian selesai
        setIsSearchLoading(false)
      }
    }
  }

  // Fungsi untuk memuat data secara bertahap
  const loadMoreOrders = useCallback(() => {
    const startIndex = (page - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    const newOrders = filteredOrders.slice(startIndex, endIndex)

    if (newOrders.length > 0) {
      setVisibleOrders(prev => [...prev, ...newOrders])
      setPage(prev => prev + 1)
    }

    if (endIndex >= filteredOrders.length) {
      setHasMore(false)
    }
  }, [page, filteredOrders])

  // Setup Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMoreOrders()
        }
      },
      { threshold: 0.1 }
    )

    if (loadingRef.current) {
      observer.observe(loadingRef.current)
    }

    return () => observer.disconnect()
  }, [loadMoreOrders, hasMore])

  // Reset pagination ketika filter berubah
  useEffect(() => {
    setVisibleOrders([])
    setPage(1)
    setHasMore(true)
  }, [activeFilter, selectedShops, selectedDateRange, orders])

  const handleDateSelect = (dateRange: DateRange | undefined) => {
    setDate(dateRange)
  }

  // Kembalikan handleApplyDate ke versi asli
  const handleApplyDate = () => {
    // Jika date.from ada tapi date.to tidak ada, set date.to sama dengan date.from
    const finalDateRange = {
      from: date?.from,
      to: date?.to || date?.from // Gunakan date.from jika date.to tidak ada
    };

    setSelectedDateRange(finalDateRange as DateRange);
    setIsCalendarOpen(false);
  }

  const handlePresetDate = (days: number) => {
    const now = new Date()
    let from: Date
    let to: Date

    if (days === -1) {
      from = new Date(now.getFullYear(), now.getMonth(), 1)
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    } else if (days === -2) {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      to = new Date(now.getFullYear(), now.getMonth(), 0)
    } else if (days === 1) {
      from = new Date(now)
      from.setDate(now.getDate() - 1)
      to = new Date(from)
    } else {
      to = new Date(now)
      from = new Date(now)
      from.setDate(now.getDate() - days)
    }

    from.setHours(0, 0, 0, 0)
    to.setHours(23, 59, 59, 999)

    const newDateRange = { from, to }
    setDate(newDateRange)
    setSelectedDateRange(newDateRange)
    setIsCalendarOpen(false)
  }

  // Tambahkan fungsi untuk menghitung ringkasan toko
  const getShopsSummary = useCallback((): ShopSummary[] => {
    const summary = orders.reduce((acc: { [key: string]: ShopSummary }, order) => {
      if (!['PROCESSED', 'SHIPPED', 'COMPLETED', 'IN_CANCEL', 'TO_CONFIRM_RECEIVE', 'TO_RETURN'].includes(order.order_status)) {
        return acc
      }

      if (!acc[order.shop_name]) {
        acc[order.shop_name] = {
          name: order.shop_name,
          totalOrders: 0,
          totalAmount: 0,
          pendingOrders: 0,
          processOrders: 0,
          shippingOrders: 0,
          cancelledOrders: 0,
          failedOrders: 0,
          topSkus: []
        }
      }

      const shop = acc[order.shop_name]

      shop.totalOrders++
      shop.totalAmount += parseFloat(order.total_amount)

      if (order.sku_qty) {
        const skuEntries = order.sku_qty.split(',').map(entry => entry.trim())

        skuEntries.forEach(entry => {
          const match = entry.match(/(.*?)\s*\((\d+)\)/)
          if (match) {
            const [, skuName, quantityStr] = match
            const quantity = parseInt(quantityStr)
            const estimatedUnitAmount = parseFloat(order.total_amount) / skuEntries.length / quantity

            const normalizedSkuName = skuName.toLowerCase()

            const existingSku = shop.topSkus.find(sku => sku.sku_name.toLowerCase() === normalizedSkuName)
            if (existingSku) {
              existingSku.quantity += quantity
              existingSku.total_amount += estimatedUnitAmount * quantity
            } else {
              shop.topSkus.push({
                sku_name: normalizedSkuName,
                quantity: quantity,
                total_amount: estimatedUnitAmount * quantity
              })
            }
          }
        })
      }

      return acc
    }, {})

    Object.values(summary).forEach(shop => {
      shop.topSkus.sort((a, b) => b.quantity - a.quantity)
      shop.topSkus = shop.topSkus.slice(0, 5)
    })

    // Urutkan berdasarkan totalOrders
    return Object.values(summary).sort((a, b) => b.totalOrders - a.totalOrders)
  }, [orders])

  // Tambahkan fungsi untuk menghitung total SKU dari semua toko
  const getAllTopSkus = useCallback(() => {
    const allSkus: { [key: string]: SkuSummary } = {}

    getShopsSummary().forEach(shop => {
      shop.topSkus.forEach(sku => {
        if (allSkus[sku.sku_name]) {
          allSkus[sku.sku_name].quantity += sku.quantity
          allSkus[sku.sku_name].total_amount += sku.total_amount
        } else {
          allSkus[sku.sku_name] = {
            sku_name: sku.sku_name,
            quantity: sku.quantity,
            total_amount: sku.total_amount
          }
        }
      })
    })

    return Object.values(allSkus)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10) // Ambil 10 SKU teratas
  }, [getShopsSummary])



  const handleSkuClick = (skuName: string) => {
    setExpandedSku(expandedSku === skuName ? null : skuName);
  };

  const getSkuDetails = (skuName: string) => {
    return getShopsSummary().map(shop => {
      const sku = shop.topSkus.find(s => s.sku_name === skuName);
      return sku ? { shopName: shop.name, quantity: sku.quantity } : null;
    }).filter(Boolean);
  };

  // Fungsi untuk menangani klik pada nomor pesanan
  const handleOrderClick = (orderSn: string) => {
    setSelectedOrderSn(orderSn)
    setIsDetailsOpen(true)
  }

  // Fungsi untuk menutup modal detail
  const handleCloseDetails = () => {
    setIsDetailsOpen(false)
  }

  // Update fungsi handleUsernameClick
  const handleUsernameClick = (userId: number, username: string) => {
    if (!userId) {
      console.warn('User ID tidak valid');
      toast.error('User ID tidak valid');
      return;
    }

    // Set user ID dan buka dialog riwayat pesanan
    setSelectedUserId(userId.toString());
    setIsOrderHistoryOpen(true);
  }

  // Hitung omset dan escrow berdasarkan orders yang sudah difilter
  const getFilteredOmset = useMemo(() => {
    return filteredOrders.reduce((total, order) => {
      // Skip pesanan yang dibatalkan atau gagal COD
      if (order.order_status === 'CANCELLED' || order.cancel_reason === 'Failed Delivery')
        return total

      // Selalu gunakan recalculated_total_amount jika tersedia
      const orderAmount = order.recalculated_total_amount !== undefined ?
        order.recalculated_total_amount :
        parseFloat(order.total_amount)

      return total + orderAmount
    }, 0)
  }, [filteredOrders])

  // Hitung total escrow (selisih) berdasarkan orders yang sudah difilter
  const getFilteredEscrow = useMemo(() => {
    return filteredOrders.reduce((total, order) => {
      if (!order.escrow_amount_after_adjustment ||
        order.order_status === 'UNPAID' ||
        order.order_status === 'CANCELLED' ||
        order.cancel_reason === 'Failed Delivery') return total;
      return total + order.escrow_amount_after_adjustment;
    }, 0);
  }, [filteredOrders]);

  // Komponen untuk Profit Calculator
  const profitCalculatorComponent = useMemo(() => (
    <ProfitCalculator
      orders={filteredOrders}
      escrowTotal={getFilteredEscrow}
      adsSpend={{
        ads_data: adsData,
        total_cost: `Rp ${totalAdsSpend.toLocaleString('id-ID')}`,
        raw_cost: totalAdsSpend
      }}
      dateRange={selectedDateRange}
    />
  ), [filteredOrders, getFilteredEscrow, totalAdsSpend, selectedDateRange])

  // Fungsi untuk menampilkan/menyembunyikan detail iklan
  const toggleAdsDetails = () => {
    setShowAdsDetails(!showAdsDetails);
  }

  if (ordersLoading) {
    // Tampilkan pesan timeout jika terdeteksi timeout
    if (apiTimeout) {
      return <TimeoutMessage />;
    }

    // Tampilkan loading UI normal
    return (
      <div className="w-full p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="shadow-sm">
              <div className="p-4">
                <div className="space-y-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        </Card>

        <div className="rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="dark:border-gray-700">
                <TableHead className="font-bold uppercase text-xs text-black dark:text-white w-10 text-center whitespace-nowrap">#</TableHead>
                <TableHead className="font-bold uppercase text-xs text-black dark:text-white whitespace-nowrap min-w-[80px] sm:min-w-[100px]">Toko</TableHead>
                <TableHead className="font-bold uppercase text-xs text-black dark:text-white whitespace-nowrap min-w-[120px]">Tanggal</TableHead>
                <TableHead className="font-bold uppercase text-xs text-black dark:text-white whitespace-nowrap min-w-[150px]">No. Pesanan</TableHead>
                <TableHead className="font-bold uppercase text-xs text-black dark:text-white whitespace-nowrap min-w-[100px]">Username</TableHead>
                <TableHead className="font-bold uppercase text-xs text-black dark:text-white whitespace-nowrap min-w-[100px]">Harga</TableHead>
                <TableHead className="font-bold uppercase text-xs text-black dark:text-white whitespace-nowrap min-w-[100px]">Escrow Final</TableHead>
                <TableHead className="font-bold uppercase text-xs text-black dark:text-white whitespace-nowrap min-w-[100px]">SKU (Qty)</TableHead>
                <TableHead className="font-bold uppercase text-xs text-black dark:text-white whitespace-nowrap min-w-[150px]">Kurir</TableHead>
                <TableHead className="font-bold uppercase text-xs text-black dark:text-white whitespace-nowrap min-w-[100px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isSearchLoading ? (
                // Tampilkan skeleton loader saat pencarian
                Array(10).fill(0).map((_, i) => (
                  <TableRowSkeleton key={`search-skeleton-${i}`} />
                ))
              ) : (
                // Tampilkan data normal
                <>
                  {[...Array(10)].map((_, i) => (
                    <TableRowSkeleton key={`loading-skeleton-${i}`} />
                  ))}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  // Menampilkan pesan error dengan opsi untuk mencoba lagi
  if (ordersError) {
    return (
      <div className="w-full p-6 flex flex-col items-center justify-center">
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-6 max-w-lg w-full">
          <div className="flex flex-col items-center text-center space-y-4">
            <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
            <div>
              <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">
                Terjadi Kesalahan
              </h3>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {ordersError}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDate({
                    from: new Date(),
                    to: new Date(),
                  });
                  setSelectedDateRange({
                    from: new Date(),
                    to: new Date(),
                  });
                  setApiTimeout(false);
                  setRetryCount(0);
                  setTimeoutDuration(30);
                }}
                className="border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/40"
              >
                Pilih Hari Ini
              </Button>
              <Button
                onClick={handleRetryWithLongerTimeout}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Coba Lagi
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full p-4 sm:p-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCards
          omset={getFilteredOmset}
          escrow={getFilteredEscrow}
          totalAdsSpend={totalAdsSpend}
          adsData={adsData}
          selectedDateRange={selectedDateRange}
        />
        {profitCalculatorComponent}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-10 gap-2">
        <OrderStatusCard
          title="Total"
          count={filteredOrderStats.total}
          icon="total"
          onClick={() => setActiveFilter(activeFilter === 'total' ? null : 'total')}
          isActive={activeFilter === 'total'}
        />
        <OrderStatusCard
          title="Belum Dibayar"
          count={filteredOrderStats.pending}
          icon="pending"
          onClick={() => setActiveFilter(activeFilter === 'pending' ? null : 'pending')}
          isActive={activeFilter === 'pending'}
        />
        <OrderStatusCard
          title="Diproses"
          count={filteredOrderStats.process}
          icon="process"
          onClick={() => setActiveFilter(activeFilter === 'process' ? null : 'process')}
          isActive={activeFilter === 'process'}
        />
        <OrderStatusCard
          title="Dikirim"
          count={filteredOrderStats.shipping}
          icon="shipping"
          onClick={() => setActiveFilter(activeFilter === 'shipping' ? null : 'shipping')}
          isActive={activeFilter === 'shipping'}
        />
        <OrderStatusCard
          title="Diterima"
          count={filteredOrderStats.confirm}
          icon="confirm"
          onClick={() => setActiveFilter(activeFilter === 'confirm' ? null : 'confirm')}
          isActive={activeFilter === 'confirm'}
        />
        <OrderStatusCard
          title="Pengembalian"
          count={filteredOrderStats.return}
          icon="return"
          onClick={() => setActiveFilter(activeFilter === 'return' ? null : 'return')}
          isActive={activeFilter === 'return'}
        />
        <OrderStatusCard
          title="Selesai"
          count={filteredOrderStats.completed}
          icon="completed"
          onClick={() => setActiveFilter(activeFilter === 'completed' ? null : 'completed')}
          isActive={activeFilter === 'completed'}
        />
        <OrderStatusCard
          title="Dibatalkan"
          count={filteredOrderStats.cancel}
          icon="cancel"
          onClick={() => setActiveFilter(activeFilter === 'cancel' ? null : 'cancel')}
          isActive={activeFilter === 'cancel'}
        />
        <OrderStatusCard
          title="COD Gagal"
          count={filteredOrderStats.failed}
          icon="failed"
          onClick={() => setActiveFilter(activeFilter === 'failed' ? null : 'failed')}
          isActive={activeFilter === 'failed'}
        />
        <OrderStatusCard
          title="Fake Order"
          count={filteredOrderStats.fake}
          icon="fake"
          onClick={() => setActiveFilter(activeFilter === 'fake' ? null : 'fake')}
          isActive={activeFilter === 'fake'}
        />
      </div>

      <Card className="shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-2">
          <div>
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal h-9",
                    !selectedDateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDateRange?.from ? (
                    selectedDateRange.to ? (
                      <>
                        {format(selectedDateRange.from, "dd MMM yyyy", { locale: id })} -{" "}
                        {format(selectedDateRange.to, "dd MMM yyyy", { locale: id })}
                      </>
                    ) : (
                      format(selectedDateRange.from, "dd MMM yyyy", { locale: id })
                    )
                  ) : (
                    <span>Pilih tanggal</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto h-auto p-0" align="center">
                <div className="space-y-3 p-3">
                  <div className="grid grid-cols-2 xs:grid-cols-3 sm:flex sm:flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePresetDate(0)}
                      className="w-full sm:w-auto"
                    >
                      Hari Ini
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePresetDate(1)}
                      className="w-full sm:w-auto"
                    >
                      Kemarin
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePresetDate(7)}
                      className="w-full sm:w-auto"
                    >
                      1 Minggu
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePresetDate(30)}
                      className="w-full sm:w-auto"
                    >
                      1 Bulan
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePresetDate(-1)}
                      className="w-full sm:w-auto"
                    >
                      Bulan Ini
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePresetDate(-2)}
                      className="w-full sm:w-auto"
                    >
                      Bulan Kemarin
                    </Button>
                  </div>
                  <div className="border-t pt-3">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={date?.from}
                      selected={date}
                      onSelect={handleDateSelect}
                      numberOfMonths={2}
                      locale={id}
                      className="sm:block hidden"
                    />
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={date?.from}
                      selected={date}
                      onSelect={handleDateSelect}
                      numberOfMonths={1}
                      locale={id}
                      className="sm:hidden block w-full [&_table]:w-full [&_table]:mx-auto [&_.rdp-cell]:w-[40px] [&_.rdp-cell]:h-[40px] [&_.rdp-head_th]:w-[40px] [&_.rdp-head_th]:h-[20px] [&_.rdp-button]:w-[40px] [&_.rdp-button]:h-[25px] flex justify-center"
                    />
                  </div>
                  <div className="flex justify-end border-t pt-3">
                    <Button
                      onClick={handleApplyDate}
                      disabled={!date?.from}
                    >
                      Terapkan
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Popover open={isShopFilterOpen} onOpenChange={setIsShopFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal h-9",
                    !selectedShops.length && "text-muted-foreground"
                  )}
                >
                  <Store className="mr-2 h-4 w-4" />
                  {selectedShops.length === 0 && "Semua Toko"}
                  {selectedShops.length === 1 && selectedShops[0]}
                  {selectedShops.length > 1 && `${selectedShops.length} toko dipilih`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <div className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Filter Toko</p>
                    {selectedShops.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedShops([])}
                        className="h-8 px-2 text-xs"
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                  <div className="border-t -mx-3" />
                  <ScrollArea className="h-[280px] -mx-3 px-3">
                    <div className="space-y-2">
                      {uniqueShops.map((shop) => (
                        <div key={shop} className="flex items-center space-x-2">
                          <Checkbox
                            id={shop}
                            checked={selectedShops.includes(shop)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedShops([...selectedShops, shop])
                              } else {
                                setSelectedShops(selectedShops.filter(s => s !== shop))
                              }
                            }}
                          />
                          <label
                            htmlFor={shop}
                            className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer w-full truncate"
                          >
                            {shop}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex gap-2 flex-col sm:flex-row">
            <Select
              value={searchType}
              onValueChange={setSearchType}
            >
              <SelectTrigger className="w-full sm:w-[140px] h-9">
                <SelectValue placeholder="Pilih Tipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="order_sn">No. Pesanan</SelectItem>
                <SelectItem value="tracking_number">No. Resi</SelectItem>
                <SelectItem value="buyer_username">Username</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={
                  searchType === "order_sn" ? "Cari no pesanan (min. 4 karakter)..." :
                    searchType === "tracking_number" ? "Cari no resi (min. 4 karakter)..." :
                      "Cari username (min. 4 karakter)..."
                }
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  if (e.target.value === "" && searchResults.length >= 0) {
                    setActiveFilter(null)
                    setSelectedShops([])
                    searchOrders({ [searchType]: "" })
                  }
                }}
                onKeyDown={handleSearch}
                className={cn(
                  "w-full h-9 pl-8 pr-8 rounded-md border bg-background text-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  searchQuery.length > 0 && searchQuery.length < 4 && "border-red-500"
                )}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("")
                    if (searchResults.length >= 0) {
                      setActiveFilter(null)
                      setSelectedShops([])
                      searchOrders({ [searchType]: "" })
                    }
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-sm hover:bg-muted"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>


        </div>
      </Card>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex items-center gap-2">
          <div className={`flex gap-1 border rounded-md p-1 ${isDarkMode
            ? "border-gray-700 bg-[#1a1a1a]"
            : "border-gray-200 bg-gray-50"
            }`}>
            <Button
              variant={viewMode === 'chart' ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode('chart')}
              className="h-8 px-4 text-xs flex items-center gap-2"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Chart
            </Button>
            <Button
              variant={viewMode === 'text' ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode('text')}
              className="h-8 px-4 text-xs flex items-center gap-2"
            >
              <FileText className="w-3.5 h-3.5" />
              Ringkasan
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          {ordersWithoutEscrow.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMissingEscrowData()}
              disabled={syncingEscrow}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncType === 'missing' ? 'animate-spin' : ''}`} />
              {syncType === 'missing'
                ? `${Math.round((syncProgress.completed / syncProgress.total) * 100)}%`
                : `Sync Escrow (${ordersWithoutEscrow.length})`
              }
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMissingEscrowData(true)}
            disabled={syncingEscrow}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${syncType === 'all' ? 'animate-spin' : ''}`} />
            {syncType === 'all'
              ? `${Math.round((syncProgress.completed / syncProgress.total) * 100)}%`
              : `Sync All (${orders.filter(o => o.order_status !== 'CANCELLED' && o.order_status !== 'UNPAID').length})`
            }
          </Button>
        </div>
      </div>

      {/* Tampilkan chart ATAU ringkasan teks berdasarkan mode yang dipilih */}
      {viewMode === 'chart' ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          <OrderTrendChart orders={filteredOrders} />
          <SKUSalesChart orders={filteredOrders} />
          <ShopOrderChart orders={filteredOrders} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SkuSummaryCard
            topSkus={getAllTopSkus()}
            getSkuDetails={getSkuDetails}
          />
          <ShopSummaryCard shopsSummary={getShopsSummary()} />
        </div>
      )}

      <div className="rounded-lg border shadow-sm overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="dark:border-gray-700">
              <TableHead className="font-bold uppercase text-xs text-black dark:text-white w-10 text-center whitespace-nowrap">#</TableHead>
              <TableHead className="font-bold uppercase text-xs text-black dark:text-white whitespace-nowrap min-w-[80px] sm:min-w-[100px]">Toko</TableHead>
              <TableHead className="font-bold uppercase text-xs text-black dark:text-white whitespace-nowrap min-w-[120px]">Tanggal</TableHead>
              <TableHead className="font-bold uppercase text-xs text-black dark:text-white whitespace-nowrap min-w-[150px]">No. Pesanan</TableHead>
              <TableHead className="font-bold uppercase text-xs text-black dark:text-white whitespace-nowrap min-w-[100px]">Username</TableHead>
              <TableHead className="font-bold uppercase text-xs text-black dark:text-white whitespace-nowrap min-w-[100px]">Harga</TableHead>
              <TableHead className="font-bold uppercase text-xs text-black dark:text-white whitespace-nowrap min-w-[100px]">Escrow Final</TableHead>
              <TableHead className="font-bold uppercase text-xs text-black dark:text-white whitespace-nowrap min-w-[100px]">SKU (Qty)</TableHead>
              <TableHead className="font-bold uppercase text-xs text-black dark:text-white whitespace-nowrap min-w-[150px]">Kurir</TableHead>
              <TableHead className="font-bold uppercase text-xs text-black dark:text-white whitespace-nowrap min-w-[100px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(searchLoading || isSearchLoading) ? (
              // Loading state hanya untuk tabel saat pencarian
              Array(10).fill(0).map((_, i) => (
                <TableRowSkeleton key={`search-skeleton-${i}`} />
              ))
            ) : visibleOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-4">
                  <span className="text-sm text-muted-foreground">
                    {searchQuery.length >= 4
                      ? `Tidak ditemukan hasil untuk pencarian "${searchQuery}" pada ${searchType === "order_sn" ? "nomor pesanan" :
                        searchType === "tracking_number" ? "nomor resi" :
                          "username"
                      }`
                      : "Tidak ada data pesanan"}
                  </span>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {visibleOrders.map((order, index) => (
                  <TableRow
                    key={order.order_sn}
                    className={index % 2 === 0 ? 'bg-muted dark:bg-gray-800/50' : 'bg-gray-100/20 dark:bg-gray-900'}
                  >
                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white text-center">{index + 1}</TableCell>
                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap max-w-[80px] sm:max-w-none overflow-hidden text-ellipsis">{order.shop_name}</TableCell>
                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">{formatDate(order)}</TableCell>
                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Popover>
                          <PopoverTrigger asChild>
                            <span
                              className="cursor-pointer hover:underline hover:text-primary"
                              onClick={() => handleOrderClick(order.order_sn)}
                            >
                              {order.order_sn}
                            </span>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-0" align="start">
                            {selectedOrderSn && selectedOrderSn === order.order_sn && (
                              <OrderDetails
                                orderSn={selectedOrderSn}
                                isOpen={isDetailsOpen}
                                onClose={handleCloseDetails}
                              />
                            )}
                          </PopoverContent>
                        </Popover>
                        {order.cod && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-600 text-white dark:bg-red-500">
                            COD
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUsernameClick(order.buyer_user_id ?? 0, order.buyer_username)}
                          className="hover:text-primary"
                        >
                          {order.buyer_username}
                        </button>

                        <ChatButton
                          shopId={order.shop_id ?? 0}
                          toId={order.buyer_user_id ?? 0}
                          toName={order.buyer_username || "Pembeli"}
                          toAvatar={""}
                          shopName={order.shop_name}
                          iconSize={14}
                          iconOnly={true}
                          orderId={order.order_sn}
                          orderStatus={order.order_status}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">
                      {order.recalculated_total_amount !== undefined ?
                        `Rp ${Math.round(order.recalculated_total_amount).toLocaleString('id-ID')}` :
                        `Rp ${parseInt(order.total_amount).toLocaleString('id-ID')}`
                      }
                    </TableCell>
                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">
                      {order.escrow_amount_after_adjustment !== undefined && order.escrow_amount_after_adjustment !== null
                        ? `Rp ${parseInt(order.escrow_amount_after_adjustment.toString()).toLocaleString('id-ID')}`
                        : 'Rp -'}
                    </TableCell>
                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">{order.sku_qty}</TableCell>
                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">
                      {order.shipping_carrier || '-'} ({order.tracking_number || '-'})
                    </TableCell>
                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${order.order_status === 'READY_TO_SHIP' ? 'bg-green-600 text-white' :
                        order.order_status === 'PROCESSED' ? 'bg-blue-600 text-white' :
                          order.order_status === 'SHIPPED' ? 'bg-indigo-600 text-white' :
                            order.order_status === 'CANCELLED' ? 'bg-red-600 text-white' :
                              order.order_status === 'IN_CANCEL' ? 'bg-yellow-600 text-white' :
                                order.order_status === 'TO_RETURN' ? 'bg-purple-600 text-white' :
                                  'bg-gray-600 text-white'
                        }`}>
                        {order.order_status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {hasMore && (
                  Array(3).fill(0).map((_, i) => (
                    <TableRowSkeleton key={`load-more-skeleton-${i}`} />
                  ))
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Loading indicator */}
      <div ref={loadingRef} className="flex justify-center items-center p-4">
        {visibleOrders.length === 0 && !(searchLoading || isSearchLoading) && (
          <span className="text-sm text-muted-foreground">
            {searchQuery.length >= 4
              ? `Tidak ditemukan hasil untuk pencarian "${searchQuery}" pada ${searchType === "order_sn" ? "nomor pesanan" :
                searchType === "tracking_number" ? "nomor resi" :
                  "username"
              }`
              : "Tidak ada data pesanan"}
          </span>
        )}
      </div>

      {/* Tambahkan komponen OrderHistory */}
      <OrderHistory
        userId={selectedUserId}
        isOpen={isOrderHistoryOpen}
        onClose={() => setIsOrderHistoryOpen(false)}
      />
    </div>
  )
}
