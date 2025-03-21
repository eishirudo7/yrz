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
  CheckCircle, 
  RefreshCw, 
  AlertCircle, 
  RotateCcw, 
  TrendingUp,
  MegaphoneIcon,
  CreditCard, 
  Wallet, 
  AlertTriangle,
  Package, 
  Clock, 
  Truck, 
  XCircle, 
  ShoppingCart, 
  ShoppingBag,
  Search, 
  X, 
  ChevronDown,
  Store,
  BarChart3,
  FileText,
  DollarSign,
  ClipboardList,
  CheckSquare,
  PackageCheck,
  PackageX,
  Ban
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
import { useTheme } from "next-themes"
import ChatButton from '@/components/ChatButton'
import ProfitCalculator from './components/ProfitCalculator'

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

interface OrderStatusCardProps {
  title: string
  count: number
  icon: 'pending' | 'process' | 'shipping' | 'cancel' | 'total' | 'failed' | 'completed' | 'confirm' | 'return' | 'fake'
  onClick: () => void
  isActive: boolean
}

function OrderStatusCard({ title, count, icon, onClick, isActive }: OrderStatusCardProps) {
  const getIcon = () => {
    switch (icon) {
      case 'pending':
        return <Clock className="w-5 h-5" />
      case 'process':
        return <PackageCheck className="w-5 h-5" />
      case 'shipping':
        return <Truck className="w-5 h-5" />
      case 'cancel':
        return <Ban className="w-5 h-5" />
      case 'total':
        return <ShoppingBag className="w-5 h-5" />
      case 'failed':
        return <PackageX className="w-5 h-5" />
      case 'completed':
        return <CheckSquare className="w-5 h-5" />
      case 'confirm':
        return <ClipboardList className="w-5 h-5" />
      case 'return':
        return <RotateCcw className="w-5 h-5" />
      case 'fake':
        return <AlertTriangle className="w-5 h-5" />
      default:
        return null
    }
  }

  const getActiveColors = () => {
    switch (icon) {
      case 'pending':
        return 'bg-amber-500 text-white'
      case 'process':
        return 'bg-blue-600 text-white'
      case 'shipping':
        return 'bg-teal-600 text-white'
      case 'cancel':
        return 'bg-rose-600 text-white'
      case 'total':
        return 'bg-indigo-600 text-white'
      case 'failed':
        return 'bg-orange-600 text-white'
      case 'completed':
        return 'bg-emerald-600 text-white'
      case 'confirm':
        return 'bg-sky-600 text-white'
      case 'return':
        return 'bg-violet-600 text-white'
      case 'fake':
        return 'bg-fuchsia-600 text-white'
      default:
        return 'bg-background'
    }
  }

  return (
    <Card 
      className={`transition-all duration-300 cursor-pointer ${
        isActive 
          ? `${getActiveColors()} shadow-lg scale-[1.02]` 
          : 'hover:bg-muted/50 hover:scale-[1.02]'
      }`}
      onClick={onClick}
    >
      <div className="p-2.5">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className={`text-xs font-medium ${isActive ? 'text-white/80' : 'text-muted-foreground'} line-clamp-1`}>
              {title}
            </p>
            <p className={`text-lg sm:text-xl font-bold tracking-tight ${isActive ? 'text-white' : ''}`}>
              {count}
            </p>
          </div>
          <div className={`p-1.5 rounded-lg ${
            isActive 
              ? 'bg-white/20' 
              : `bg-background ${
                  icon === 'pending' ? 'text-amber-500' :
                  icon === 'process' ? 'text-blue-600' :
                  icon === 'shipping' ? 'text-teal-600' :
                  icon === 'cancel' ? 'text-rose-600' :
                  icon === 'total' ? 'text-indigo-600' :
                  icon === 'failed' ? 'text-orange-600' :
                  icon === 'confirm' ? 'text-sky-600' :
                  icon === 'completed' ? 'text-emerald-600' :
                  icon === 'return' ? 'text-violet-600' :
                  'text-fuchsia-600'
                }`
          }`}>
            {getIcon()}
          </div>
        </div>
      </div>
    </Card>
  )
}

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

// Tambahkan interface untuk SKU
interface SkuSummary {
  sku_name: string
  quantity: number
  total_amount: number
}

// Tambahkan interface untuk ringkasan toko
interface ShopSummary {
  name: string
  totalOrders: number
  totalAmount: number
  pendingOrders: number
  processOrders: number
  shippingOrders: number
  cancelledOrders: number
  failedOrders: number
  topSkus: SkuSummary[]
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

  const { 
    orders, 
    ordersWithoutEscrow, 
    loading: ordersLoading, 
    error: ordersError,
    syncMissingEscrowData,
    syncingEscrow,
    syncProgress,
    adsData,
    totalAdsSpend
  } = useOrders(selectedDateRange)
  const [visibleOrders, setVisibleOrders] = useState<Order[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const loadingRef = useRef<HTMLDivElement>(null)
  const ITEMS_PER_PAGE = 20
  const { searchOrders, searchResults, loading: searchLoading } = useOrderSearch()
  
  // Tambahkan state untuk modal ringkasan
  const [showSummary, setShowSummary] = useState(false)

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

  // Fungsi untuk memeriksa apakah suatu pesanan adalah "fake order" (total SKU > 50)
  const isFakeOrder = (order: Order) => {
    if (!order.sku_qty) return false;
    
    const skuEntries = order.sku_qty.split(',').map(entry => entry.trim());
    let totalQuantity = 0;
    
    skuEntries.forEach(entry => {
      const match = entry.match(/(.*?)\s*\((\d+)\)/);
      if (match) {
        const [, , quantityStr] = match;
        totalQuantity += parseInt(quantityStr);
      }
    });
    
    return totalQuantity > 50;
  };

  // Hitung jumlah pesanan berdasarkan status
  const orderStats = orders.reduce((acc, order) => {
    // Cek dulu apakah ini fake order
    if (isFakeOrder(order)) {
      acc.fake++;
      return acc;
    }
    
    if (order.cancel_reason === 'Failed Delivery') {
      acc.failed++;
    } else {
      switch (order.order_status) {
        case 'UNPAID':
          acc.pending++;
          break;
        case 'PROCESSED':
          acc.process++;
          acc.total++;
          break;
        case 'SHIPPED':
          acc.shipping++;
          acc.total++;
          break;
        case 'COMPLETED':
          if (order.escrow_amount_after_adjustment !== undefined && 
              order.escrow_amount_after_adjustment !== null && 
              order.escrow_amount_after_adjustment < 0) {
            acc.return++;
          } else {
            acc.completed++;
          }
          acc.total++;
          break;
        case 'IN_CANCEL':
          acc.total++;
          break;
        case 'TO_CONFIRM_RECEIVE':
          acc.confirm++;
          acc.total++;
          break;
        case 'TO_RETURN':
          acc.return++;
          acc.total++;
          break;
        case 'CANCELLED':
          acc.cancel++;
          break;
      }
    }
    return acc;
  }, {
    pending: 0,
    process: 0,
    shipping: 0,
    cancel: 0,
    total: 0,
    failed: 0,
    completed: 0,
    confirm: 0,
    return: 0,
    fake: 0
  });

  // Dapatkan daftar unik toko dari orders
  const uniqueShops = Array.from(new Set(orders.map(order => order.shop_name))).sort()

  // Optimalkan dengan useMemo untuk menghindari kalkulasi ulang yang tidak perlu
  const filteredOrdersByShop = useMemo(() => {
    return orders.filter(order => {
      if (selectedShops.length === 0) return true
      return selectedShops.includes(order.shop_name)
    })
  }, [orders, selectedShops])

  // Hitung statistik berdasarkan pesanan yang sudah difilter berdasarkan toko
  const filteredOrderStats = filteredOrdersByShop.reduce((acc, order) => {
    // Cek dulu apakah ini fake order
    if (isFakeOrder(order)) {
      acc.fake++;
      return acc;
    }
    
    if (order.cancel_reason === 'Failed Delivery') {
      acc.failed++;
    } else {
      switch (order.order_status) {
        case 'UNPAID':
          acc.pending++;
          break;
        case 'PROCESSED':
          acc.process++;
          acc.total++;
          break;
        case 'SHIPPED':
          acc.shipping++;
          acc.total++;
          break;
        case 'COMPLETED':
          if (order.escrow_amount_after_adjustment !== undefined && 
              order.escrow_amount_after_adjustment !== null && 
              order.escrow_amount_after_adjustment < 0) {
            acc.return++;
          } else {
            acc.completed++;
          }
          acc.total++;
          break;
        case 'IN_CANCEL':
          acc.total++;
          break;
        case 'TO_CONFIRM_RECEIVE':
          acc.confirm++;
          acc.total++;
          break;
        case 'TO_RETURN':
          acc.return++;
          acc.total++;
          break;
        case 'CANCELLED':
          acc.cancel++;
          break;
      }
    }
    return acc;
  }, {
    pending: 0,
    process: 0,
    shipping: 0,
    cancel: 0,
    total: 0,
    failed: 0,
    completed: 0,
    confirm: 0,
    return: 0,
    fake: 0
  })

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
          return !['CANCELLED'].includes(order.order_status);
        default:
          return true;
      }
    });
  }, [searchResults, filteredOrdersByShop, activeFilter]);

  // Optimisasi fungsi format dengan useCallback
  // Tambahkan useEffect untuk memantau hasil pencarian
  useEffect(() => {
    if (isSearching && !searchLoading) {
      if (searchResults.length === 0) {
        toast.error(`Tidak ditemukan hasil untuk pencarian "${searchQuery}" pada ${
          searchType === "order_sn" ? "nomor pesanan" :
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
        toast.error(`Minimal 4 karakter untuk melakukan pencarian ${
          searchType === "order_sn" ? "nomor pesanan" :
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
        
      return total + parseFloat(order.total_amount)
    }, 0)
  }, [filteredOrders])

  // Hitung total escrow (selisih) berdasarkan orders yang sudah difilter
  const getFilteredEscrow = useMemo(() => {
    return filteredOrders.reduce((total, order) => {
      // Skip pesanan yang dibatalkan atau gagal COD
      if (order.order_status === 'CANCELLED' || order.cancel_reason === 'Failed Delivery' || !order.escrow_amount_after_adjustment) 
        return total
        
      return total + order.escrow_amount_after_adjustment
    }, 0)
  }, [filteredOrders])

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

  if (ordersLoading) {
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
                  {visibleOrders.map((order, index) => (
                    <TableRow 
                      key={order.order_sn}
                      className={index % 2 === 0 ? 'bg-muted dark:bg-gray-800/50' : 'bg-gray-100/20 dark:bg-gray-900'}
                    >
                      <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white text-center">{index + 1}</TableCell>
                      <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap max-w-[80px] sm:max-w-none overflow-hidden text-ellipsis">{order.shop_name}</TableCell>
                      <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">{formatDate(order.create_time)}</TableCell>
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
                        Rp {parseInt(order.total_amount).toLocaleString('id-ID')}
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
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          order.order_status === 'READY_TO_SHIP' ? 'bg-green-600 text-white' :
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
      </div>
    )
  }
  if (ordersError) return <div className="container mx-auto p-4 text-red-500">{ordersError}</div>

  return (
    <div className="w-full p-4 sm:p-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <div className="p-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                Total Omset
              </p>
              <div className="flex items-center justify-between">
                <p className="text-xl font-bold text-green-700 dark:text-green-400 truncate pr-2">
                  Rp {getFilteredOmset.toLocaleString('id-ID')}
                </p>
                <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-800/40 flex-shrink-0">
                  <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>
          </div>
        </Card>
        
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="p-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                Total Bersih (Escrow)
              </p>
              <div className="flex items-center justify-between">
                <p className="text-xl font-bold text-blue-700 dark:text-blue-400 truncate pr-2">
                  Rp {getFilteredEscrow.toLocaleString('id-ID')}
                </p>
                <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-800/40 flex-shrink-0">
                  <Wallet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>
          </div>
        </Card>
        
        <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
          <div className="p-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
                Total Iklan
              </p>
              <div className="flex items-center justify-between">
                <p className="text-xl font-bold text-purple-700 dark:text-purple-400 truncate pr-2">
                Rp {totalAdsSpend.toLocaleString('id-ID')}
                </p>
                <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-800/40 flex-shrink-0">
                  <MegaphoneIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </div>
          </div>
        </Card>
        
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
          <div className={`flex gap-1 border rounded-md p-1 ${
            isDarkMode 
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
        
        {ordersWithoutEscrow.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={syncMissingEscrowData}
            disabled={syncingEscrow}
            className="flex items-center gap-2 mt-2 sm:mt-0"
          >
            <RefreshCw className={`h-4 w-4 ${syncingEscrow ? 'animate-spin' : ''}`} />
            {syncingEscrow 
              ? `Sync (${syncProgress.completed}/${syncProgress.total})` 
              : `Sync Escrow (${ordersWithoutEscrow.length})`
            }
          </Button>
        )}
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
          {/* Top SKUs dengan desain yang dioptimalkan */}
          <Card className={`overflow-hidden ${isDarkMode ? "bg-[#121212] border-gray-800" : "bg-white border-gray-200"}`}>
            <CardHeader className={`py-2.5 px-4 flex flex-row items-center justify-between ${isDarkMode ? "text-white" : "text-gray-900"}`}>
              <h3 className="text-sm font-semibold">10 SKU Terlaris</h3>
              <span className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>Total Penjualan</span>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[360px]">
                <div className={`divide-y ${isDarkMode ? "divide-gray-800" : "divide-gray-100"}`}>
                  {getAllTopSkus().map((sku, index) => (
                    <div key={sku.sku_name} className="group">
                      <div 
                        className={`py-2.5 px-4 hover:bg-muted/50 cursor-pointer transition-colors ${isDarkMode ? "hover:bg-gray-800/50" : "hover:bg-gray-100/50"}`}
                        onClick={() => handleSkuClick(sku.sku_name)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              <div className={`w-5 h-5 flex items-center justify-center text-xs font-semibold ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                                {index + 1}
                              </div>
                              <p className={`text-sm font-medium truncate ${isDarkMode ? "text-white" : "text-gray-900"}`}>{sku.sku_name}</p>
                            </div>
                            <div className="text-primary">
                              <span className={`text-xs font-semibold ${isDarkMode ? "text-blue-400" : "text-blue-600"}`}>{sku.quantity} pcs</span>
                            </div>
                          </div>
                          <div className="text-primary ml-4">
                            <span className={`text-xs font-semibold ${isDarkMode ? "text-blue-400" : "text-blue-600"}`}>
                              Rp {sku.total_amount.toLocaleString('id-ID')}
                            </span>
                          </div>
                          <ChevronDown 
                            className={`w-4 h-4 transition-transform ml-3 ${
                              expandedSku === sku.sku_name ? 'rotate-180' : ''
                            } ${expandedSku === sku.sku_name ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${
                              isDarkMode ? "text-gray-400" : "text-gray-500"
                            }`}
                          />
                        </div>
                      </div>
                      
                      {expandedSku === sku.sku_name && (
                        <div className={`divide-y animate-in slide-in-from-top-1 duration-200 ${
                          isDarkMode ? "bg-gray-800/30 divide-gray-700" : "bg-gray-100/30 divide-gray-200"
                        }`}>
                          {getSkuDetails(sku.sku_name).map(detail => detail && (
                            <div key={detail.shopName} className="py-2 px-4 pl-12">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <Store className={`w-3.5 h-3.5 flex-shrink-0 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`} />
                                  <p className={`text-xs truncate ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>{detail.shopName}</p>
                                </div>
                                <div className="ml-2">
                                  <span className={`text-xs font-medium ${isDarkMode ? "text-blue-400" : "text-blue-600"}`}>{detail.quantity} pcs</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Ringkasan Toko dengan desain yang dioptimalkan */}
          <Card className={`overflow-hidden ${isDarkMode ? "bg-[#121212] border-gray-800" : "bg-white border-gray-200"}`}>
            <CardHeader className={`py-2.5 px-4 flex flex-row items-center justify-between ${isDarkMode ? "text-white" : "text-gray-900"}`}>
              <h3 className="text-sm font-semibold">Ringkasan per Toko</h3>
              <span className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>Total Pesanan</span>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[360px]">
                <div className={`divide-y ${isDarkMode ? "divide-gray-800" : "divide-gray-100"}`}>
                  {getShopsSummary().map((shop) => (
                    <div key={shop.name} className="group">
                      <div 
                        className={`py-2.5 px-4 hover:bg-muted/50 cursor-pointer transition-colors ${isDarkMode ? "hover:bg-gray-800/50" : "hover:bg-gray-100/50"}`}
                        onClick={() => setExpandedShop(expandedShop === shop.name ? null : shop.name)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className={`text-sm font-medium truncate flex-1 ${isDarkMode ? "text-white" : "text-gray-900"}`}>{shop.name}</p>
                              <span className={`text-xs font-semibold whitespace-nowrap ${isDarkMode ? "text-blue-400" : "text-blue-600"}`}>
                                {shop.totalOrders} pesanan
                              </span>
                            </div>
                            <p className={`text-xs mt-0.5 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                              Omset: Rp {shop.totalAmount.toLocaleString('id-ID')}
                            </p>
                          </div>
                          <ChevronDown 
                            className={`w-4 h-4 transition-transform ml-3 ${
                              expandedShop === shop.name ? 'rotate-180' : ''
                            } ${expandedShop === shop.name ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${
                              isDarkMode ? "text-gray-400" : "text-gray-500"
                            }`}
                          />
                        </div>
                      </div>
                      
                      {expandedShop === shop.name && (
                        <div className={`divide-y animate-in slide-in-from-top-1 duration-200 ${
                          isDarkMode ? "bg-gray-800/30 divide-gray-700" : "bg-gray-100/30 divide-gray-200"
                        }`}>
                          {shop.topSkus.map((sku, index) => (
                            <div key={sku.sku_name} className="py-2 px-4 pl-8">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                  <div className={`w-5 h-5 flex items-center justify-center text-xs font-semibold ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                                    {index + 1}
                                  </div>
                                  <p className={`text-xs font-medium truncate ${isDarkMode ? "text-white" : "text-gray-900"}`}>{sku.sku_name}</p>
                                </div>
                                <span className={`text-xs font-semibold ml-2 whitespace-nowrap ${isDarkMode ? "text-blue-400" : "text-blue-600"}`}>
                                  {sku.quantity} pcs
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
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
                      ? `Tidak ditemukan hasil untuk pencarian "${searchQuery}" pada ${
                          searchType === "order_sn" ? "nomor pesanan" :
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
                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">{formatDate(order.create_time)}</TableCell>
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
                      Rp {parseInt(order.total_amount).toLocaleString('id-ID')}
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
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        order.order_status === 'READY_TO_SHIP' ? 'bg-green-600 text-white' :
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
              ? `Tidak ditemukan hasil untuk pencarian "${searchQuery}" pada ${
                  searchType === "order_sn" ? "nomor pesanan" :
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
