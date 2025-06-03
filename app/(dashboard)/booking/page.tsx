'use client'
import { useBookings } from '@/app/hooks/useBookings'
import type { Booking } from '@/app/hooks/useBookings'
import { useState, useEffect, useCallback, useMemo } from 'react'
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
  Clock, 
  Truck, 
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
  Ban,
  MapPin,
  CreditCard,
  Eye,
  SendHorizonal,
  Loader2
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
import { toast } from 'sonner'
import { useTheme } from "next-themes"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

function formatDate(booking: Booking): string {
  try {
    const timestamp = booking.create_time;
    
    // Validasi timestamp
    if (!timestamp || timestamp <= 0) {
      return '-';
    }
    
    // Konversi timestamp ke Date object
    const date = new Date(timestamp * 1000);
    
    // Validasi apakah Date object valid
    if (isNaN(date.getTime())) {
      return '-';
    }
    
    return date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.warn('Error formatting date for booking:', booking.booking_sn, error);
    return '-';
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function getBuyerName(booking: Booking): string {
  // Coba ambil dari recipient_address karena buyer_username mungkin tidak ada
  if (booking.recipient_address?.name) {
    return booking.recipient_address.name;
  }
  
  if (booking.buyer_username) {
    return booking.buyer_username;
  }
  
  return '-';
}

function getTotalAmount(booking: Booking): string {
  // Jika ada total_amount langsung
  if (booking.total_amount) {
    return formatCurrency(booking.total_amount);
  }
  
  // Coba hitung dari item_list jika ada
  if (booking.item_list && booking.item_list.length > 0) {
    // Untuk booking order, biasanya tidak ada harga di item_list
    // Karena ini data dari database lokal
    return '-';
  }
  
  return '-';
}

function getPaymentMethod(booking: Booking): string {
  if (booking.payment_method) {
    return booking.payment_method;
  }
  
  // Default untuk booking orders
  return 'COD/Transfer';
}

interface BookingStatusCardProps {
  title: string
  count: number
  icon: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'total' | 'ready_to_ship'
  onClick: () => void
  isActive: boolean
}

function BookingStatusCard({ title, count, icon, onClick, isActive }: BookingStatusCardProps) {
  const getIcon = () => {
    switch (icon) {
      case 'pending':
        return <Clock className="w-5 h-5" />
      case 'confirmed':
        return <PackageCheck className="w-5 h-5" />
      case 'cancelled':
        return <Ban className="w-5 h-5" />
      case 'completed':
        return <CheckSquare className="w-5 h-5" />
      case 'ready_to_ship':
        return <Truck className="w-5 h-5" />
      case 'total':
        return <ShoppingBag className="w-5 h-5" />
      default:
        return null
    }
  }

  const getActiveColors = () => {
    switch (icon) {
      case 'pending':
        return 'bg-amber-500 text-white'
      case 'confirmed':
        return 'bg-blue-600 text-white'
      case 'cancelled':
        return 'bg-rose-600 text-white'
      case 'completed':
        return 'bg-emerald-600 text-white'
      case 'ready_to_ship':
        return 'bg-purple-600 text-white'
      case 'total':
        return 'bg-indigo-600 text-white'
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
                  icon === 'confirmed' ? 'text-blue-600' :
                  icon === 'cancelled' ? 'text-rose-600' :
                  icon === 'completed' ? 'text-emerald-600' :
                  icon === 'ready_to_ship' ? 'text-purple-600' :
                  'text-indigo-600'
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
      <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-32" /></TableCell>
    </TableRow>
  )
}

export default function BookingPage() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 7)),
    to: new Date(),
  })
  
  const [selectedBookingStatus, setSelectedBookingStatus] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'READY_TO_SHIP'>('ALL')
  const [selectedMatchStatus, setSelectedMatchStatus] = useState<'ALL' | 'MATCH_PENDING' | 'MATCH_SUCCESSFUL' | 'MATCH_FAILED'>('ALL')
  const [selectedBookings, setSelectedBookings] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBookingDetail, setSelectedBookingDetail] = useState<Booking | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [shippingBooking, setShippingBooking] = useState<string | null>(null)

  const {
    bookings,
    summary,
    loading,
    error,
    refetch,
    getBookingDetail,
    shipBooking,
    getTrackingNumber
  } = useBookings(date)

  // Filter bookings berdasarkan status dan search term
  const filteredBookings = useMemo(() => {
    let filtered = bookings;
    
    // Filter berdasarkan booking status
    if (selectedBookingStatus !== 'ALL') {
      filtered = filtered.filter(booking => booking.booking_status === selectedBookingStatus);
    }
    
    // Filter berdasarkan match status
    if (selectedMatchStatus !== 'ALL') {
      filtered = filtered.filter(booking => booking.match_status === selectedMatchStatus);
    }
    
    // Filter berdasarkan search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(booking => 
        booking.booking_sn.toLowerCase().includes(term) ||
        booking.buyer_username?.toLowerCase().includes(term) ||
        booking.shop_name?.toLowerCase().includes(term)
      );
    }
    
    return filtered;
  }, [bookings, selectedBookingStatus, selectedMatchStatus, searchTerm]);

  // Handle status card click
  const handleStatusCardClick = (status: 'ALL' | 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'READY_TO_SHIP') => {
    setSelectedBookingStatus(status);
    setSelectedMatchStatus('ALL'); // Reset match status filter
    setSelectedBookings([]);
  };

  // Handle checkbox selection
  const handleBookingSelect = (bookingSn: string) => {
    setSelectedBookings(prev => 
      prev.includes(bookingSn) 
        ? prev.filter(sn => sn !== bookingSn)
        : [...prev, bookingSn]
    );
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedBookings.length === filteredBookings.length) {
      setSelectedBookings([]);
    } else {
      setSelectedBookings(filteredBookings.map(booking => booking.booking_sn));
    }
  };

  // Handle search
  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Search sudah otomatis karena menggunakan useMemo
    }
  };

  // Handle date preset
  const handlePresetDate = (days: number) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    setDate({
      from: startDate,
      to: endDate
    });
  };

  // Handle date apply
  const handleApplyDate = () => {
    if (date?.from) {
      refetch();
    }
  };

  // Handle booking detail
  const handleViewDetail = async (booking: Booking) => {
    setLoadingDetail(true);
    setIsDetailDialogOpen(true);
    
    try {
      const detail = await getBookingDetail(booking.booking_sn);
      setSelectedBookingDetail({ ...booking, ...detail });
    } catch (error) {
      toast.error('Gagal mengambil detail booking');
      setIsDetailDialogOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Handle ship booking
  const handleShipBooking = async (bookingSn: string, method: 'pickup' | 'dropoff' = 'dropoff') => {
    setShippingBooking(bookingSn);
    try {
      await shipBooking(bookingSn, method);
    } catch (error) {
      // Error sudah ditangani di hook
    } finally {
      setShippingBooking(null);
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Menunggu</Badge>;
      case 'CONFIRMED':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Dikonfirmasi</Badge>;
      case 'CANCELLED':
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Dibatalkan</Badge>;
      case 'COMPLETED':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Selesai</Badge>;
      case 'READY_TO_SHIP':
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800">Siap Kirim</Badge>;
      case 'SHIPPED':
        return <Badge variant="secondary" className="bg-teal-100 text-teal-800">Dikirim</Badge>;
      case 'DELIVERED':
        return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">Terkirim</Badge>;
      case 'PROCESSING':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Diproses</Badge>;
      case 'UNPAID':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Belum Bayar</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Get match status badge
  const getMatchStatusBadge = (matchStatus: string | undefined) => {
    if (!matchStatus) return <Badge variant="outline" className="text-xs">-</Badge>;
    
    switch (matchStatus) {
      case 'MATCH_PENDING':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">Pending</Badge>;
      case 'MATCH_SUCCESSFUL':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">Berhasil</Badge>;
      case 'MATCH_FAILED':
        return <Badge variant="secondary" className="bg-red-100 text-red-800 text-xs">Gagal</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{matchStatus}</Badge>;
    }
  };

  const TimeoutMessage = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <AlertCircle className="w-12 h-12 text-muted-foreground" />
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium">Request Timeout</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Permintaan memakan waktu terlalu lama. Silahkan coba kurangi rentang tanggal atau coba lagi nanti.
        </p>
        <Button
          onClick={() => window.location.reload()}
          className="mt-4"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Coba Lagi
        </Button>
      </div>
    </div>
  )

  if (error?.includes('timeout') || error?.includes('Request timeout')) {
    return <TimeoutMessage />
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Booking Orders</h1>
          <p className="text-muted-foreground">
            Kelola booking orders dari semua toko Anda
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={refetch}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Date Range Picker */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            <div className="flex flex-col sm:flex-row gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant="outline"
                    className={cn(
                      "w-[280px] justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (
                      date.to ? (
                        <>
                          {format(date.from, "LLL dd, y", { locale: id })} -{" "}
                          {format(date.to, "LLL dd, y", { locale: id })}
                        </>
                      ) : (
                        format(date.from, "LLL dd, y", { locale: id })
                      )
                    ) : (
                      <span>Pilih tanggal</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={2}
                    locale={id}
                  />
                  <div className="p-3 border-t">
                    <Button onClick={handleApplyDate} className="w-full">
                      Terapkan Filter
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => handlePresetDate(1)}>
                  1 Hari
                </Button>
                <Button variant="outline" size="sm" onClick={() => handlePresetDate(7)}>
                  7 Hari
                </Button>
                <Button variant="outline" size="sm" onClick={() => handlePresetDate(30)}>
                  30 Hari
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <BookingStatusCard
          title="Total Booking"
          count={summary.total}
          icon="total"
          onClick={() => handleStatusCardClick('ALL')}
          isActive={selectedBookingStatus === 'ALL'}
        />
        <BookingStatusCard
          title="Menunggu"
          count={summary.pending}
          icon="pending"
          onClick={() => handleStatusCardClick('PENDING')}
          isActive={selectedBookingStatus === 'PENDING'}
        />
        <BookingStatusCard
          title="Dikonfirmasi"
          count={summary.confirmed}
          icon="confirmed"
          onClick={() => handleStatusCardClick('CONFIRMED')}
          isActive={selectedBookingStatus === 'CONFIRMED'}
        />
        <BookingStatusCard
          title="Siap Kirim"
          count={summary.ready_to_ship}
          icon="ready_to_ship"
          onClick={() => handleStatusCardClick('READY_TO_SHIP')}
          isActive={selectedBookingStatus === 'READY_TO_SHIP'}
        />
        <BookingStatusCard
          title="Dibatalkan"
          count={summary.cancelled}
          icon="cancelled"
          onClick={() => handleStatusCardClick('CANCELLED')}
          isActive={selectedBookingStatus === 'CANCELLED'}
        />
        <BookingStatusCard
          title="Selesai"
          count={summary.completed}
          icon="completed"
          onClick={() => handleStatusCardClick('COMPLETED')}
          isActive={selectedBookingStatus === 'COMPLETED'}
        />
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input
                type="text"
                placeholder="Cari nomor booking, pembeli, atau toko..."
                className="w-full pl-10 pr-4 py-2 border border-input rounded-lg bg-background"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearch}
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-auto p-1"
                  onClick={() => setSearchTerm('')}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            
            <Select value={selectedMatchStatus} onValueChange={(value) => setSelectedMatchStatus(value as any)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter Match Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Match Status</SelectItem>
                <SelectItem value="MATCH_PENDING">Match Pending</SelectItem>
                <SelectItem value="MATCH_SUCCESSFUL">Match Berhasil</SelectItem>
                <SelectItem value="MATCH_FAILED">Match Gagal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Booking Table */}
      <Card>
        <CardContent className="p-0">
          <div className="border rounded-lg">
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-[50px] p-2">
                      <Checkbox
                        checked={selectedBookings.length === filteredBookings.length && filteredBookings.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="p-2">No. Booking</TableHead>
                    <TableHead className="p-2">Toko</TableHead>
                    <TableHead className="p-2">Status</TableHead>
                    <TableHead className="p-2">Match Status</TableHead>
                    <TableHead className="p-2">Pembeli</TableHead>
                    <TableHead className="p-2">Total</TableHead>
                    <TableHead className="p-2">Metode Bayar</TableHead>
                    <TableHead className="p-2">Tanggal</TableHead>
                    <TableHead className="p-2">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 10 }).map((_, index) => (
                      <TableRowSkeleton key={index} />
                    ))
                  ) : filteredBookings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8">
                        <div className="flex flex-col items-center space-y-2">
                          <ShoppingBag className="w-8 h-8 text-muted-foreground" />
                          <p className="text-muted-foreground">
                            {searchTerm ? 'Tidak ada booking yang sesuai dengan pencarian' : 'Tidak ada booking ditemukan'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBookings.map((booking) => (
                      <TableRow key={booking.booking_sn} className="hover:bg-muted/50">
                        <TableCell className="p-2">
                          <Checkbox
                            checked={selectedBookings.includes(booking.booking_sn)}
                            onCheckedChange={() => handleBookingSelect(booking.booking_sn)}
                          />
                        </TableCell>
                        <TableCell className="p-2 font-mono text-sm">
                          {booking.booking_sn}
                        </TableCell>
                        <TableCell className="p-2">
                          <div className="flex items-center space-x-2">
                            <Store className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm truncate max-w-[120px]">
                              {booking.shop_name || `Shop ${booking.shop_id}`}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="p-2">
                          {getStatusBadge(booking.booking_status)}
                        </TableCell>
                        <TableCell className="p-2">
                          {getMatchStatusBadge(booking.match_status)}
                        </TableCell>
                        <TableCell className="p-2">
                          <span className="text-sm truncate max-w-[100px]">
                            {getBuyerName(booking)}
                          </span>
                        </TableCell>
                        <TableCell className="p-2">
                          <span className="font-medium">
                            {getTotalAmount(booking)}
                          </span>
                        </TableCell>
                        <TableCell className="p-2">
                          <div className="flex items-center space-x-1">
                            <CreditCard className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs">
                              {getPaymentMethod(booking)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="p-2 text-sm">
                          {formatDate(booking)}
                        </TableCell>
                        <TableCell className="p-2">
                          <div className="flex space-x-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetail(booking)}
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                            {(booking.booking_status === 'CONFIRMED' || booking.booking_status === 'READY_TO_SHIP') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleShipBooking(booking.booking_sn)}
                                disabled={shippingBooking === booking.booking_sn}
                              >
                                {shippingBooking === booking.booking_sn ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <SendHorizonal className="w-3 h-3" />
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Booking</DialogTitle>
            <DialogDescription>
              Informasi lengkap booking order
            </DialogDescription>
          </DialogHeader>
          
          {loadingDetail ? (
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : selectedBookingDetail && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Informasi Booking</h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>No. Booking:</strong> {selectedBookingDetail.booking_sn}</div>
                    <div><strong>Status:</strong> {getStatusBadge(selectedBookingDetail.booking_status)}</div>
                    <div><strong>Match Status:</strong> {getMatchStatusBadge(selectedBookingDetail.match_status)}</div>
                    <div><strong>Dibuat:</strong> {formatDate(selectedBookingDetail)}</div>
                    <div><strong>Diupdate:</strong> {new Date(selectedBookingDetail.update_time * 1000).toLocaleString('id-ID')}</div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Informasi Pembeli</h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>Nama:</strong> {getBuyerName(selectedBookingDetail)}</div>
                    <div><strong>Dropshipper:</strong> {selectedBookingDetail.dropshipper || '-'}</div>
                    <div><strong>Phone:</strong> {selectedBookingDetail.dropshipper_phone || '-'}</div>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <h4 className="font-medium mb-2">Alamat Pengiriman</h4>
                <div className="text-sm">
                  {selectedBookingDetail.recipient_address ? (
                    <>
                      <div><strong>Nama:</strong> {selectedBookingDetail.recipient_address.name}</div>
                      <div><strong>Telepon:</strong> {selectedBookingDetail.recipient_address.phone}</div>
                      <div><strong>Alamat:</strong> {selectedBookingDetail.recipient_address.full_address}</div>
                      <div><strong>Kota:</strong> {selectedBookingDetail.recipient_address.city}</div>
                      <div><strong>Provinsi:</strong> {selectedBookingDetail.recipient_address.state}</div>
                      <div><strong>Kode Pos:</strong> {selectedBookingDetail.recipient_address.zipcode}</div>
                    </>
                  ) : (
                    <div className="text-muted-foreground">Alamat tidak tersedia</div>
                  )}
                </div>
              </div>

              {/* Items */}
              {selectedBookingDetail.item_list && selectedBookingDetail.item_list.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Daftar Item</h4>
                  <div className="space-y-2">
                    {selectedBookingDetail.item_list?.map((item, index) => (
                      <div key={index} className="border rounded p-2 text-sm">
                        <div><strong>Nama:</strong> {item.item_name}</div>
                        <div><strong>SKU:</strong> {item.item_sku || '-'}</div>
                        <div><strong>Model:</strong> {item.model_name || '-'}</div>
                        <div><strong>Model SKU:</strong> {item.model_sku || '-'}</div>
                        <div><strong>Berat:</strong> {item.weight ? `${item.weight}g` : '-'}</div>
                        <div><strong>Lokasi Produk:</strong> {item.product_location_id || '-'}</div>
                      </div>
                    )) || <div className="text-muted-foreground">Tidak ada item</div>}
                  </div>
                </div>
              )}

              {/* Financial Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Informasi Keuangan</h4>
                  <div className="space-y-2 text-sm">
                    {selectedBookingDetail.total_amount && (
                      <div><strong>Total:</strong> {formatCurrency(selectedBookingDetail.total_amount)}</div>
                    )}
                    <div><strong>Metode Bayar:</strong> {selectedBookingDetail.payment_method || 'COD/Transfer'}</div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Informasi Pengiriman</h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>Kurir:</strong> {selectedBookingDetail.shipping_carrier || '-'}</div>
                    <div><strong>No. Tracking:</strong> {selectedBookingDetail.tracking_number || 'Belum tersedia'}</div>
                    <div><strong>Status Dokumen:</strong> {selectedBookingDetail.document_status || '-'}</div>
                    <div><strong>Sudah Dicetak:</strong> {selectedBookingDetail.is_printed ? 'Ya' : 'Tidak'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedBookingDetail(null);
                setIsDetailDialogOpen(false);
              }}
            >
              Tutup
            </Button>
            
            {/* Ship booking button */}
            {selectedBookingDetail && (selectedBookingDetail.booking_status === 'CONFIRMED' || 
              selectedBookingDetail.booking_status === 'READY_TO_SHIP') && (
              <Button
                onClick={() => handleShipBooking(selectedBookingDetail.booking_sn)}
                disabled={shippingBooking === selectedBookingDetail.booking_sn}
                className="min-w-[120px]"
              >
                {shippingBooking === selectedBookingDetail.booking_sn ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Mengirim...
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4 mr-2" />
                    Kirim Booking
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 