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
  Loader2,
  Printer,
  Download,
  CheckCircle
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
import { Input } from "@/components/ui/input"

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
  
  const [selectedBookingStatus, setSelectedBookingStatus] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'READY_TO_SHIP' | 'SHIPPED' | 'PROCESSED'>('ALL')
  const [selectedMatchStatus, setSelectedMatchStatus] = useState<'ALL' | 'MATCH_PENDING' | 'MATCH_SUCCESSFUL' | 'MATCH_FAILED'>('ALL')
  const [selectedDocumentStatus, setSelectedDocumentStatus] = useState<'ALL' | 'PENDING' | 'READY' | 'PRINTED' | 'ERROR'>('ALL')
  const [selectedBookings, setSelectedBookings] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBookingDetail, setSelectedBookingDetail] = useState<Booking | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [shippingBooking, setShippingBooking] = useState<string | null>(null)
  const [printingBookings, setPrintingBookings] = useState<string[]>([])
  const [creatingDocuments, setCreatingDocuments] = useState<string[]>([])
  const [failedTrackingFetch, setFailedTrackingFetch] = useState<string[]>([])

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
    
    // Filter berdasarkan document status
    if (selectedDocumentStatus !== 'ALL') {
      if (selectedDocumentStatus === 'PRINTED') {
        filtered = filtered.filter(booking => booking.is_printed === true);
      } else if (selectedDocumentStatus === 'PENDING') {
        filtered = filtered.filter(booking => !booking.document_status || booking.document_status === 'PENDING');
      } else {
        filtered = filtered.filter(booking => booking.document_status === selectedDocumentStatus);
      }
    }
    
    // Filter berdasarkan search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(booking => 
        booking.booking_sn.toLowerCase().includes(term) ||
        booking.buyer_username?.toLowerCase().includes(term) ||
        booking.shop_name?.toLowerCase().includes(term) ||
        booking.tracking_number?.toLowerCase().includes(term)
      );
    }
    
    return filtered;
  }, [bookings, selectedBookingStatus, selectedMatchStatus, selectedDocumentStatus, searchTerm]);

  // Derived data untuk print
  const printableBookings = useMemo(() => {
    return filteredBookings.filter(booking => 
      booking.document_status === 'READY' && !booking.is_printed
    );
  }, [filteredBookings]);

  // Handle status card click
  const handleStatusCardClick = (status: 'ALL' | 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'READY_TO_SHIP' | 'SHIPPED' | 'PROCESSED') => {
    setSelectedBookingStatus(status);
    setSelectedMatchStatus('ALL'); // Reset match status filter
    setSelectedDocumentStatus('ALL'); // Reset document status filter
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

  // Handle print documents
  const handlePrintDocuments = async (bookingList?: Booking[]) => {
    const bookingsToPrint = bookingList || (
      selectedBookings.length > 0 
        ? filteredBookings.filter(booking => selectedBookings.includes(booking.booking_sn))
        : printableBookings
    );

    // Filter only bookings with READY document status
    const readyBookings = bookingsToPrint.filter(booking => 
      booking.document_status === 'READY' && !booking.is_printed
    );

    if (readyBookings.length === 0) {
      toast.info('Tidak ada dokumen yang siap dicetak. Pastikan status dokumen adalah "READY"');
      return;
    }

    // Show warning if some bookings were filtered out
    if (bookingsToPrint.length > readyBookings.length) {
      const filteredCount = bookingsToPrint.length - readyBookings.length;
      toast.warning(`${filteredCount} booking dilewati karena dokumen belum siap`);
    }

    const bookingSns = readyBookings.map(b => b.booking_sn);
    setPrintingBookings(bookingSns);

    try {
      // Group by shop_id untuk batch download
      const bookingsByShop = readyBookings.reduce((groups: { [key: number]: Booking[] }, booking) => {
        if (!groups[booking.shop_id]) {
          groups[booking.shop_id] = [];
        }
        groups[booking.shop_id].push(booking);
        return groups;
      }, {});

      for (const [shopId, shopBookings] of Object.entries(bookingsByShop)) {
        const bookingList = shopBookings.map(booking => ({
          booking_sn: booking.booking_sn,
          shipping_document_type: 'THERMAL_AIR_WAYBILL'
        }));

        // Download document
        const response = await fetch('/api/shopee/download-booking-shipping-document', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shopId: parseInt(shopId),
            bookingList
          })
        });

        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `booking-documents-${shopId}-${new Date().toISOString().split('T')[0]}.pdf`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);

          // Mark as printed
          await fetch('/api/bookings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'mark_printed',
              shop_id: parseInt(shopId),
              booking_sn_list: shopBookings.map(b => b.booking_sn)
            })
          });

          toast.success(`Dokumen berhasil diunduh untuk ${shopBookings.length} booking`);
        } else {
          const errorData = await response.json();
          toast.error(`Gagal mengunduh dokumen: ${errorData.message}`);
        }
      }

      // Refresh data
      await refetch();
      setSelectedBookings([]);

    } catch (error) {
      console.error('Error printing documents:', error);
      toast.error('Gagal mencetak dokumen');
    } finally {
      setPrintingBookings([]);
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

  // Get document status badge
  const getDocumentStatusBadge = (booking: Booking) => {
    // Show creating indicator if document is being created by backup system
    if (creatingDocuments.includes(booking.booking_sn)) {
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Backup Creating...
        </Badge>
      );
    }

    if (booking.is_printed) {
      return <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">Sudah Dicetak</Badge>;
    }

    // Show status based on booking workflow
    switch (booking.document_status) {
      case 'READY':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">Siap Cetak</Badge>;
      case 'PENDING':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">Menunggu</Badge>;
      case 'ERROR':
        return <Badge variant="secondary" className="bg-red-100 text-red-800 text-xs">Error</Badge>;
      default:
        // Show different status based on booking status
        if (booking.booking_status === 'READY_TO_SHIP') {
          return <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">Perlu Ship</Badge>;
        } else if (booking.booking_status === 'PROCESSED' && booking.tracking_number) {
          return <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-xs">Perlu Dokumen</Badge>;
        } else if (booking.booking_status === 'SHIPPED' || booking.booking_status === 'PROCESSED') {
          return <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-xs">Tunggu Webhook</Badge>;
        } else {
          return <Badge variant="outline" className="text-xs">-</Badge>;
        }
    }
  };

  // Backup auto-create documents for bookings that webhook might have missed
  const backupCreateDocuments = useCallback(async () => {
    if (loading || bookings.length === 0) return;

    console.log('📊 Starting auto-create document scan...');
    console.log(`📋 Total bookings loaded: ${bookings.length}`);

    // Short delay to let webhook process first (webhook is primary, this is backup)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 1: Find PROCESSED bookings without tracking numbers
    const processedWithoutTracking = bookings.filter(booking => {
      return booking.booking_status === 'PROCESSED' && 
        (!booking.tracking_number || booking.tracking_number.trim() === '') &&
        !failedTrackingFetch.includes(booking.booking_sn); // Skip previously failed bookings
    });

    if (processedWithoutTracking.length > 0) {
      console.log(`📞 Found ${processedWithoutTracking.length} PROCESSED bookings without tracking numbers`);
      console.log('🔍 Fetching missing tracking numbers:', processedWithoutTracking.map(b => b.booking_sn));

      const successfulUpdates: string[] = [];
      const failedUpdates: string[] = [];

      // Fetch tracking numbers for bookings that don't have them
      for (const booking of processedWithoutTracking) {
        try {
          console.log(`📞 Fetching tracking number for booking ${booking.booking_sn}...`);
          
          const trackingResult = await getTrackingNumber(booking.booking_sn);
          
          if (trackingResult.success && trackingResult.data?.tracking_number) {
            console.log(`✅ Got tracking number for ${booking.booking_sn}: ${trackingResult.data.tracking_number}`);
            
            // Update database with tracking number
            try {
              const updateResponse = await fetch('/api/bookings', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  action: 'update_tracking',
                  shop_id: booking.shop_id, // IMPORTANT: Include shop_id!
                  booking_sn: booking.booking_sn,
                  tracking_number: trackingResult.data.tracking_number
                })
              });

              const updateResult = await updateResponse.json();
              
              if (updateResponse.ok && updateResult.success) {
                console.log(`💾 Database updated for ${booking.booking_sn} with tracking: ${trackingResult.data.tracking_number}`);
                // Update local booking data
                booking.tracking_number = trackingResult.data.tracking_number;
                successfulUpdates.push(booking.booking_sn);
              } else {
                console.error(`❌ Failed to update database for ${booking.booking_sn}:`, updateResult.message);
                console.error('❌ Update response:', updateResult);
                failedUpdates.push(booking.booking_sn);
              }
            } catch (updateError) {
              console.error(`💥 Database update error for ${booking.booking_sn}:`, updateError);
              failedUpdates.push(booking.booking_sn);
            }
          } else {
            console.log(`❌ Failed to get tracking number for ${booking.booking_sn}:`, trackingResult.message);
            failedUpdates.push(booking.booking_sn);
          }
        } catch (error) {
          console.error(`💥 Error fetching tracking for ${booking.booking_sn}:`, error);
          failedUpdates.push(booking.booking_sn);
        }
      }

      // Update failed tracking list to prevent infinite retries
      if (failedUpdates.length > 0) {
        console.log(`🚫 Adding ${failedUpdates.length} bookings to failed list to prevent infinite retries:`, failedUpdates);
        setFailedTrackingFetch(prev => [...prev, ...failedUpdates]);
      }

      if (successfulUpdates.length > 0) {
        console.log(`✅ Successfully updated ${successfulUpdates.length} bookings with tracking numbers`);
        console.log('📞 Tracking number fetch completed, waiting before refresh...');
        // Longer wait to ensure database updates are committed
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('🔄 Refreshing booking data to get updated tracking numbers...');
        // Refresh bookings data to get updated tracking numbers
        refetch();
      } else {
        console.log('❌ No successful tracking updates, skipping refresh');
      }
    }

    // Step 2: Find bookings that need document creation (webhook might have missed)
    const bookingsNeedingDocuments = bookings.filter(booking => {
      const needsDocument = booking.booking_status === 'PROCESSED' && // Only PROCESSED status
        booking.document_status !== 'READY' && // Document not ready yet
        !booking.is_printed && // Not printed yet
        !creatingDocuments.includes(booking.booking_sn) && // Not currently being processed
        booking.tracking_number && // Must have tracking number
        booking.tracking_number.trim() !== ''; // Tracking number must not be empty
      
      if (booking.booking_status === 'PROCESSED') {
        console.log(`🔍 Booking ${booking.booking_sn}:`, {
          status: booking.booking_status,
          doc_status: booking.document_status || 'null',
          is_printed: booking.is_printed,
          has_tracking: !!booking.tracking_number,
          tracking_number: booking.tracking_number,
          needs_document: needsDocument
        });
      }
      
      return needsDocument;
    });

    console.log(`🎯 Found ${bookingsNeedingDocuments.length} bookings needing document creation`);

    if (bookingsNeedingDocuments.length === 0) {
      console.log('✅ No bookings need document creation - all good!');
      return;
    }

    console.log(`🚀 Auto-creating documents for ${bookingsNeedingDocuments.length} bookings yang webhook missed`);
    console.log('📦 Bookings to process:', bookingsNeedingDocuments.map(b => ({
      booking_sn: b.booking_sn,
      shop_id: b.shop_id,
      tracking_number: b.tracking_number
    })));

    // Mark bookings as being processed
    const bookingSns = bookingsNeedingDocuments.map(b => b.booking_sn);
    setCreatingDocuments(prev => [...prev, ...bookingSns]);

    // Group by shop_id for batch processing
    const bookingsByShop = bookingsNeedingDocuments.reduce((groups: { [key: number]: Booking[] }, booking) => {
      if (!groups[booking.shop_id]) {
        groups[booking.shop_id] = [];
      }
      groups[booking.shop_id].push(booking);
      return groups;
    }, {});

    console.log('🏪 Grouped by shops:', Object.entries(bookingsByShop).map(([shopId, bookings]) => ({
      shop_id: shopId,
      booking_count: bookings.length,
      booking_sns: bookings.map(b => b.booking_sn)
    })));

    // Process each shop - ONE TIME ONLY, no retry
    for (const [shopId, shopBookings] of Object.entries(bookingsByShop)) {
      console.log(`🔄 Processing shop ${shopId} with ${shopBookings.length} bookings...`);
      
      try {
        const requestPayload = {
          shopId: parseInt(shopId),
          bookingList: shopBookings.map(booking => ({ 
            booking_sn: booking.booking_sn,
            tracking_number: booking.tracking_number,
            shipping_document_type: 'THERMAL_AIR_WAYBILL'
          })),
          documentType: 'THERMAL_AIR_WAYBILL'
        };
        
        console.log('📤 API Request payload:', requestPayload);
        
        const response = await fetch('/api/shopee/create-booking-shipping-document', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestPayload)
        });

        const result = await response.json();
        console.log('📥 API Response:', result);
        
        if (result.success) {
          console.log(`✅ SUCCESS: Documents created for ${shopBookings.length} bookings in shop ${shopId}`);
          toast.success(`Dokumen auto-created untuk ${shopBookings.length} booking`);
          // Refresh data to get updated document status
          setTimeout(() => {
            console.log('🔄 Refreshing data to get updated document status...');
            refetch();
          }, 1000);
        } else {
          console.log(`❌ FAILED: Shop ${shopId} document creation failed:`, result.message);
          
          // Handle specific errors but NO RETRY - no spam logging
          if (result.response?.result_list) {
            const failedItems = result.response.result_list.filter((item: any) => item.fail_error);
            
            console.log('📊 Failed items breakdown:', failedItems.map((item: any) => ({
              booking_sn: item.booking_sn,
              error: item.fail_error,
              message: item.fail_message
            })));
            
            const cannotPrintCount = result.response.result_list.filter(
              (item: any) => item.fail_error === 'logistics.booking_can_not_print'
            ).length;
            
            const invalidTrackingCount = result.response.result_list.filter(
              (item: any) => item.fail_error === 'logistics.tracking_number_invalid'
            ).length;
            
            if (cannotPrintCount > 0) {
              console.log(`⏰ ${cannotPrintCount} booking sudah terlambat untuk create document (logistics.booking_can_not_print)`);
            }
            
            if (invalidTrackingCount > 0) {
              console.log(`📋 ${invalidTrackingCount} booking dengan tracking number invalid (logistics.tracking_number_invalid)`);
            }
          }
        }
      } catch (error) {
        console.error(`💥 ERROR: Network/server error for shop ${shopId}:`, error);
      }
    }

    // Remove from creating list
    setCreatingDocuments(prev => prev.filter(sn => !bookingSns.includes(sn)));
    console.log('🏁 Auto-create documents process completed');
  }, [bookings, loading, creatingDocuments, refetch, getTrackingNumber]);

  // Run backup document creation immediately after bookings data is loaded
  useEffect(() => {
    if (bookings.length > 0 && !loading) {
      console.log('🎬 Bookings data loaded, starting auto-create process...');
      // Run immediately after data is available
      backupCreateDocuments();
    }
  }, [bookings.length, loading]); // Run when bookings first load and loading finished

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
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Booking Orders</h1>
          <div className="flex items-center space-x-2">
            {/* Print Actions */}
            {(selectedBookings.length > 0 || printableBookings.length > 0) && (
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => handlePrintDocuments()}
                  disabled={printingBookings.length > 0}
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  {printingBookings.length > 0 ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Printer className="w-4 h-4" />
                  )}
                  <span>
                    Print {selectedBookings.length > 0 ? `Selected (${selectedBookings.length})` : `All Ready (${printableBookings.length})`}
                  </span>
                </Button>
              </div>
            )}
            
            <Button
              onClick={() => refetch()}
              disabled={loading}
              size="sm"
              variant="outline"
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <BookingStatusCard
            title="Total"
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
            title="Selesai"
            count={summary.completed}
            icon="completed"
            onClick={() => handleStatusCardClick('COMPLETED')}
            isActive={selectedBookingStatus === 'COMPLETED'}
          />
          <BookingStatusCard
            title="Dibatalkan"
            count={summary.cancelled}
            icon="cancelled"
            onClick={() => handleStatusCardClick('CANCELLED')}
            isActive={selectedBookingStatus === 'CANCELLED'}
          />
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Date Filter */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Rentang Tanggal</h4>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (
                      date.to ? (
                        <>
                          {format(date.from, "dd MMM", { locale: id })} -{" "}
                          {format(date.to, "dd MMM", { locale: id })}
                        </>
                      ) : (
                        format(date.from, "dd MMM", { locale: id })
                      )
                    ) : (
                      <span>Pilih tanggal</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="flex">
                    <div className="flex flex-col space-y-2 p-3 border-r">
                      <h4 className="font-medium text-sm">Preset</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start h-8"
                        onClick={() => handlePresetDate(1)}
                      >
                        Hari ini
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start h-8"
                        onClick={() => handlePresetDate(7)}
                      >
                        7 hari terakhir
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start h-8"
                        onClick={() => handlePresetDate(30)}
                      >
                        30 hari terakhir
                      </Button>
                    </div>
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={date?.from}
                      selected={date}
                      onSelect={setDate}
                      numberOfMonths={2}
                    />
                  </div>
                  <div className="p-3 border-t">
                    <Button
                      onClick={handleApplyDate}
                      className="w-full"
                      size="sm"
                    >
                      Terapkan Filter
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Booking Status Filter */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Status Booking</h4>
              <Select
                value={selectedBookingStatus}
                onValueChange={(value: typeof selectedBookingStatus) =>
                  setSelectedBookingStatus(value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih status booking" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Status</SelectItem>
                  <SelectItem value="PENDING">Menunggu</SelectItem>
                  <SelectItem value="CONFIRMED">Dikonfirmasi</SelectItem>
                  <SelectItem value="READY_TO_SHIP">Siap Kirim</SelectItem>
                  <SelectItem value="SHIPPED">Dikirim</SelectItem>
                  <SelectItem value="PROCESSED">Diproses</SelectItem>
                  <SelectItem value="COMPLETED">Selesai</SelectItem>
                  <SelectItem value="CANCELLED">Dibatalkan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Match Status Filter */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Status Match</h4>
              <Select
                value={selectedMatchStatus}
                onValueChange={(value: typeof selectedMatchStatus) =>
                  setSelectedMatchStatus(value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih status match" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Status</SelectItem>
                  <SelectItem value="MATCH_PENDING">Pending</SelectItem>
                  <SelectItem value="MATCH_SUCCESSFUL">Berhasil</SelectItem>
                  <SelectItem value="MATCH_FAILED">Gagal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Document Status Filter */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Status Dokumen</h4>
              <Select
                value={selectedDocumentStatus}
                onValueChange={(value: typeof selectedDocumentStatus) =>
                  setSelectedDocumentStatus(value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih status dokumen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Status</SelectItem>
                  <SelectItem value="PENDING">Menunggu</SelectItem>
                  <SelectItem value="READY">Siap Cetak</SelectItem>
                  <SelectItem value="PRINTED">Sudah Dicetak</SelectItem>
                  <SelectItem value="ERROR">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Pencarian</h4>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari booking SN, nama pembeli..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleSearch}
                  className="pl-10"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                    onClick={() => setSearchTerm('')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedBookings.length === filteredBookings.length && filteredBookings.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Booking SN</TableHead>
                  <TableHead>Pembeli</TableHead>
                  <TableHead>Toko</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Dokumen</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, index) => (
                    <TableRowSkeleton key={index} />
                  ))
                ) : filteredBookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center">
                      <div className="flex flex-col items-center space-y-2">
                        <ShoppingBag className="w-8 h-8 text-muted-foreground" />
                        <p className="text-muted-foreground">Tidak ada booking ditemukan</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBookings.map((booking) => (
                    <TableRow key={booking.booking_sn} className="hover:bg-muted/50">
                      <TableCell>
                        <Checkbox
                          checked={selectedBookings.includes(booking.booking_sn)}
                          onCheckedChange={() => handleBookingSelect(booking.booking_sn)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {booking.booking_sn}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{getBuyerName(booking)}</span>
                          {booking.recipient_address?.phone && (
                            <span className="text-xs text-muted-foreground">
                              {booking.recipient_address.phone}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Store className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{booking.shop_name || `Shop ${booking.shop_id}`}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(booking.booking_status)}
                      </TableCell>
                      <TableCell>
                        {getMatchStatusBadge(booking.match_status)}
                      </TableCell>
                      <TableCell>
                        {getDocumentStatusBadge(booking)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(booking)}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetail(booking)}
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                          
                          {/* Ship Button */}
                          {(booking.booking_status === 'CONFIRMED' || booking.booking_status === 'READY_TO_SHIP') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleShipBooking(booking.booking_sn)}
                              disabled={shippingBooking === booking.booking_sn}
                              title="Ship Booking"
                            >
                              {shippingBooking === booking.booking_sn ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <SendHorizonal className="w-3 h-3" />
                              )}
                            </Button>
                          )}

                          {/* Print Button - Only show if document status is READY */}
                          {booking.document_status === 'READY' && !booking.is_printed && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePrintDocuments([booking])}
                              disabled={printingBookings.includes(booking.booking_sn)}
                              title="Print Dokumen"
                            >
                              {printingBookings.includes(booking.booking_sn) ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Printer className="w-3 h-3" />
                              )}
                            </Button>
                          )}

                          {/* Printed Status */}
                          {booking.is_printed && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled
                              title="Sudah Dicetak"
                            >
                              <CheckCircle className="w-3 h-3 text-green-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : selectedBookingDetail && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div>
                <h4 className="font-medium mb-2">Informasi Booking</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>Booking SN:</strong> {selectedBookingDetail.booking_sn}</div>
                  <div><strong>Order SN:</strong> {selectedBookingDetail.order_sn || '-'}</div>
                  <div><strong>Status:</strong> {getStatusBadge(selectedBookingDetail.booking_status)}</div>
                  <div><strong>Match Status:</strong> {getMatchStatusBadge(selectedBookingDetail.match_status)}</div>
                  <div><strong>Toko:</strong> {selectedBookingDetail.shop_name || `Shop ${selectedBookingDetail.shop_id}`}</div>
                  <div><strong>Kurir:</strong> {selectedBookingDetail.shipping_carrier || '-'}</div>
                </div>
              </div>

              {/* Address Info */}
              {selectedBookingDetail.recipient_address && (
                <div>
                  <h4 className="font-medium mb-2">Alamat Penerima</h4>
                  <div className="bg-muted p-3 rounded text-sm">
                    <div><strong>Nama:</strong> {selectedBookingDetail.recipient_address.name}</div>
                    <div><strong>Telepon:</strong> {selectedBookingDetail.recipient_address.phone}</div>
                    <div><strong>Alamat:</strong> {selectedBookingDetail.recipient_address.full_address}</div>
                  </div>
                </div>
              )}

              {/* Items */}
              {selectedBookingDetail.item_list && selectedBookingDetail.item_list.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Items</h4>
                  <div className="space-y-2">
                    {selectedBookingDetail.item_list.map((item: any, index: number) => (
                      <div key={index} className="border p-3 rounded text-sm">
                        <div><strong>Nama:</strong> {item.item_name}</div>
                        <div><strong>SKU:</strong> {item.item_sku || '-'}</div>
                        <div><strong>Berat:</strong> {item.weight || '-'} gram</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Financial & Shipping Info */}
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
                    <div><strong>Status Dokumen:</strong> {getDocumentStatusBadge(selectedBookingDetail)}</div>
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

            {/* Print button */}
            {selectedBookingDetail && selectedBookingDetail.document_status === 'READY' && !selectedBookingDetail.is_printed && (
              <Button
                onClick={() => handlePrintDocuments([selectedBookingDetail])}
                disabled={printingBookings.includes(selectedBookingDetail.booking_sn)}
                className="min-w-[120px]"
              >
                {printingBookings.includes(selectedBookingDetail.booking_sn) ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Mencetak...
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4 mr-2" />
                    Print Dokumen
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