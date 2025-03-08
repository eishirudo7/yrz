'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { getAllShops } from '@/app/services/shopeeService';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { format } from 'date-fns';
import { X, AlertTriangle, Plus, CalendarDays, Clock, Eye, Bell, MoreVertical, Check, Trash2, Copy, RefreshCcw } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { Checkbox } from "@/components/ui/checkbox"
import { InactiveFlashSaleIndicator } from "./components/InactiveFlashSaleIndicator"

interface FlashSale {
  flash_sale_id: number;
  timeslot_id: number;
  status: number;
  start_time: number;
  end_time: number;
  enabled_item_count: number;
  item_count: number;
  type: number;
  click_count: number;
  remindme_count: number;
}



interface TimeSlot {
  timeslot_id: number;
  start_time: number;
  end_time: number;
}

interface TimeSlotsByDate {
  [date: string]: TimeSlot[];
}

// Tambahkan type untuk status
type FlashSaleStatus = 1 | 2;

// Definisikan interface untuk progress detail
interface ProgressDetail {
  flash_sale_id: number;
  timeslot_id?: number;
  step: 'create' | 'register' | 'complete';
  status: string;
  total_items: number;
  successful_items: number;
  error?: string;
}

interface StepStatus {
  create: 'pending' | 'processing' | 'success' | 'error';
  register: 'pending' | 'processing' | 'success' | 'error';
  complete: 'pending' | 'processing' | 'success' | 'error';
}

// Update class untuk animasi dengan dukungan dark mode
const progressItemClass = `
  transition-all duration-300 ease-in-out
  transform hover:scale-[1.02]
  dark:border-gray-800
`;

// Definisikan interface untuk duplicateProgress
interface DuplicateProgress {
  total: number;
  current: number;
  status: string;
}

// Buat komponen ErrorBoundary
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback: ReactNode;
}

interface State {
  hasError: boolean;
}


// Tambahkan interface untuk StepIndicator
interface StepIndicatorProps {
  step: 'create' | 'register' | 'complete';
  currentStep: 'create' | 'register' | 'complete';
  success: boolean;
  error: boolean;
}

// Pindahkan fungsi getStatusBadge ke luar komponen
const getStatusBadge = (status: number, type: number) => {
  switch (type) {
    case 1:
      return <Badge variant="secondary">Akan Datang</Badge>
    case 2:
      return <Badge className="bg-green-500">Sedang Berlangsung</Badge>
    case 3:
      return <Badge variant="destructive">Berakhir</Badge>
    default:
      return null;
  }
};

// Update interface FlashSaleCard
const FlashSaleCard = ({ 
  sale, 
  onStatusChange, 
  onDelete, 
  onDuplicate, 
  shopName,
  selectedShop 
}: {
  sale: FlashSale;
  onStatusChange: (id: number, status: FlashSaleStatus) => void;
  onDelete: (id: number) => void;
  onDuplicate: (id: number) => void;
  shopName?: string;
  selectedShop: number;
}) => {
  const router = useRouter();

  return (
    <div className="p-3 border rounded-lg space-y-2.5 dark:border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">#{sale.flash_sale_id}</span>
          {getStatusBadge(sale.status, sale.type)}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => {
              router.push(`/flashsale/detail?shop_id=${selectedShop}&shop_name=${encodeURIComponent(shopName || '')}&flash_sale_id=${sale.flash_sale_id}`);
            }}>
              <Eye className="w-4 h-4 mr-2" />
              Detail
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(sale.flash_sale_id)}>
              <Copy className="w-4 h-4 mr-2" />
              Duplikat
            </DropdownMenuItem>
            {sale.status !== 3 && (
              <DropdownMenuItem 
                onClick={() => onDelete(sale.flash_sale_id)}
                className="text-red-600"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Hapus
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Periode dan Statistik */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <div className="flex items-center text-sm">
            <CalendarDays className="w-4 h-4 mr-1.5 text-muted-foreground" />
            {dayjs(sale.start_time * 1000).format('DD/MM/YYYY')}
          </div>
          <div className="flex items-center text-sm">
            <Clock className="w-4 h-4 mr-1.5 text-muted-foreground" />
            <span className="font-semibold text-blue-600">
              {dayjs(sale.start_time * 1000).format('HH:mm')} - {dayjs(sale.end_time * 1000).format('HH:mm')}
            </span>
          </div>
        </div>

        <div className="space-y-1 text-right">
          <div className="text-sm">
            <span className="font-medium">{sale.enabled_item_count}</span>
            <span className="text-muted-foreground"> / {sale.item_count} item</span>
          </div>
          <div className="flex items-center justify-end gap-3 text-sm text-muted-foreground">
            <span className="flex items-center">
              <Eye className="w-3.5 h-3.5 mr-1" />
              {sale.click_count}
            </span>
            <span className="flex items-center">
              <Bell className="w-3.5 h-3.5 mr-1" />
              {sale.remindme_count}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Komponen untuk dialog mobile
const MobileCreateFlashSaleDialog = ({
  isOpen,
  onClose,
  selectedShop,
  shops,
  onShopChange,
  timeSlots,
  selectedTimeSlot,
  onTimeSlotSelect,
  onConfirm
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedShop?: number;
  shops: Array<{ shop_id: number; shop_name: string }>;
  onShopChange: (value: string) => void;
  timeSlots: TimeSlot[];
  selectedTimeSlot?: TimeSlot;
  onTimeSlotSelect: (slot: TimeSlot) => void;
  onConfirm: () => void;
}) => {
  console.log('Mobile dialog timeSlots:', timeSlots); // Untuk debugging

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="p-0 dark:border-gray-800 dark:bg-gray-950">
        {/* Header */}
        <div className="p-4 border-b dark:border-gray-800">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold dark:text-white">
              Buat Flash Sale Baru
            </h2>
            <Select
              value={selectedShop?.toString()}
              onValueChange={onShopChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih Toko" />
              </SelectTrigger>
              <SelectContent>
                {shops.map(shop => (
                  <SelectItem key={shop.shop_id} value={shop.shop_id.toString()}>
                    {shop.shop_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Warning jika toko belum dipilih */}
        {!selectedShop && (
          <div className="px-4 py-3 bg-yellow-50 dark:bg-yellow-900/30 border-b dark:border-gray-800">
            <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
              <AlertTriangle className="h-4 w-4" />
              <span>Silakan pilih toko terlebih dahulu</span>
            </div>
          </div>
        )}

        {/* Daftar slot waktu */}
        <div className="p-4 max-h-[400px] overflow-y-auto">
          {timeSlots.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              Tidak ada slot waktu tersedia
            </div>
          ) : (
            <RadioGroup
              value={selectedTimeSlot?.timeslot_id.toString()}
              onValueChange={(value) => {
                const slot = timeSlots.find(s => s.timeslot_id === parseInt(value));
                if (slot) onTimeSlotSelect(slot);
              }}
              className="space-y-2"
            >
              {timeSlots.map((slot) => (
                <div
                  key={slot.timeslot_id}
                  className="flex items-center p-3 rounded-md border dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <RadioGroupItem
                    value={slot.timeslot_id.toString()}
                    id={`slot-${slot.timeslot_id}`}
                    className="mr-3"
                  />
                  <div>
                    <p className="text-sm font-medium dark:text-gray-200">
                      {dayjs(slot.start_time * 1000).format('DD/MM/YYYY')}
                    </p>
                    <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                      {dayjs(slot.start_time * 1000).format('HH:mm')} - {dayjs(slot.end_time * 1000).format('HH:mm')}
                    </p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t dark:border-gray-800">
          <Button
            variant="outline"
            onClick={onClose}
            className="dark:border-gray-700 dark:text-gray-300"
          >
            Batal
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!selectedTimeSlot}
            className="bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90"
          >
            Buat Flash Sale
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Tambahkan opsi ukuran halaman
const pageSizeOptions = [10, 25, 50, 100];

export default function FlashSalePage() {
  const [loading, setLoading] = useState(false);
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedShop, setSelectedShop] = useState<number>();
  const [shops, setShops] = useState<Array<{ shop_id: number; shop_name: string }>>([]);
  const [selectedType, setSelectedType] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.ceil(totalCount / pageSize);
  const router = useRouter();
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot>();
  const [date, setDate] = useState<Date>();
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [timeSlotsByDate, setTimeSlotsByDate] = useState<TimeSlotsByDate>({});
  const [showStatusConfirmDialog, setShowStatusConfirmDialog] = useState(false);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{
    flashSaleId: number;
    newStatus: FlashSaleStatus;
  } | null>(null);
  const [selectedDialogShop, setSelectedDialogShop] = useState<number>();
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<number[]>([]);
  const [duplicatingFlashSaleId, setDuplicatingFlashSaleId] = useState<number | null>(null);
  const [duplicateProgress, setDuplicateProgress] = useState<DuplicateProgress | null>(null);
  const [progressDetails, setProgressDetails] = useState<Record<number, ProgressDetail>>({});
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [isDeletingItems, setIsDeletingItems] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [deletingFlashSale, setDeletingFlashSale] = useState<number | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);
 
  const [isDesktopDialogOpen, setIsDesktopDialogOpen] = useState(false);
  const [isMobileDialogOpen, setIsMobileDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tambahkan fungsi helper untuk mengambil slot waktu
  const fetchTimeSlots = async (shopId: number) => {
    try {
      const response = await fetch(`/api/flashsale/timeslot?shop_id=${shopId}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        // Organisir time slots berdasarkan tanggal
        const slotsByDate: TimeSlotsByDate = {};
        data.data.forEach((slot: TimeSlot) => {
          const date = format(new Date(slot.start_time * 1000), 'yyyy-MM-dd');
          if (!slotsByDate[date]) {
            slotsByDate[date] = [];
          }
          slotsByDate[date].push(slot);
        });
        return slotsByDate;
      }
      throw new Error(data.message || 'Gagal mendapatkan slot waktu');
    } catch (error) {
      throw error;
    }
  };

  // Mengambil daftar toko
  useEffect(() => {
    const fetchShops = async () => {
      try {
        const shops = await getAllShops();
        if (shops && shops.length > 0) {
          // Urutkan toko berdasarkan nama secara ascending
          const sortedShops = shops.sort((a, b) => 
            a.shop_name.localeCompare(b.shop_name, 'id', { sensitivity: 'base' })
          );
          setShops(sortedShops);
          setSelectedShop(sortedShops[0].shop_id);
        }
      } catch (error) {
        toast.error('Gagal mengambil daftar toko', {
          description: 'Terjadi kesalahan saat mengambil daftar toko'
        });
        console.error('Error fetching shops:', error);
      }
    };
    fetchShops();
  }, []);

  // Mengambil daftar flash sale ketika toko dipilih
  useEffect(() => {
    if (selectedShop) {
      fetchFlashSales(currentPage, pageSize);
    }
  }, [selectedShop, selectedType, currentPage, pageSize]);

  const fetchFlashSales = async (page: number = 1, pageSize: number = 10) => {
    if (!selectedShop) return;
    
    setLoading(true);
    setError(null); // Reset error state
    try {
      const offset = (page - 1) * pageSize;
      const response = await fetch(`/api/flashsale/list?shop_id=${selectedShop}&type=${selectedType}&offset=${offset}&limit=${pageSize}`);
      const data = await response.json();
      if (data.success) {
        setFlashSales(data.data.flash_sale_list || []);
        setTotalCount(data.data.total_count || 0);
      } else {
        setError(data.message || 'Gagal mengambil daftar flash sale');
        toast.error('Gagal mengambil daftar flash sale');
      }
    } catch (error) {
      setError('Terjadi kesalahan saat mengambil data. Periksa koneksi internet Anda.');
      toast.error('Terjadi kesalahan', {
        description: 'Gagal mengambil daftar flash sale'
      });
    } finally {
      setLoading(false);
    }
  };

  // Update fungsi handleShopChange
  const handleShopChange = (value: string) => {
    const shopId = parseInt(value);
    setSelectedShop(shopId);
  };

  // Tambahkan handler khusus untuk dropdown di dialog
  const handleDialogShopChange = async (value: string) => {
    const shopId = parseInt(value);
    setSelectedDialogShop(shopId);
    setSelectedTimeSlot(undefined);
    setDate(undefined);
    
    try {
      const slots = await fetchTimeSlots(shopId);
      setTimeSlotsByDate(slots);
      
      // Tambahkan ini untuk mengatur timeSlots untuk tampilan mobile
      const allSlots = Object.values(slots).flat();
      setTimeSlots(allSlots);
      
      console.log('Mobile time slots:', allSlots); // Untuk debugging
    } catch (error) {
      toast.error('Error', {
        description: 'Gagal mengambil slot waktu yang tersedia'
      });
    }
  };

  // Update fungsi handleCreateFlashSale
  const handleCreateFlashSale = async () => {
    if (!selectedShop) {
      toast.error('Pilih Toko', {
        description: 'Silakan pilih toko terlebih dahulu'
      });
      return;
    }
    
    setSelectedDialogShop(selectedShop);
    setSelectedTimeSlot(undefined);
    setDate(undefined);
    setTimeSlots([]); // Reset timeSlots
    
    setCalendarLoading(true);
    try {
      const slots = await fetchTimeSlots(selectedShop);
      setTimeSlotsByDate(slots);

      // Tambahkan ini untuk mengatur timeSlots awal untuk tampilan mobile
      const allSlots = Object.values(slots).flat();
      setTimeSlots(allSlots);
      
      // Buka dialog berdasarkan ukuran layar
      if (window.innerWidth >= 768) { // md breakpoint
        setIsDesktopDialogOpen(true);
      } else {
        setIsMobileDialogOpen(true);
      }
    } catch (error) {
      toast.error('Error', {
        description: 'Gagal mengambil slot waktu yang tersedia'
      });
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleDateChange = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
      setTimeSlots([]); // Reset timeSlots jika tidak ada tanggal yang dipilih
      setDate(undefined);
      return;
    }
    
    setDate(selectedDate);
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const slotsForDate = timeSlotsByDate[dateKey] || [];
    setTimeSlots(slotsForDate);
  };

  const handleConfirmTimeSlot = async () => {
    if (!selectedTimeSlot || !selectedDialogShop) {
      toast.error('Error', {
        description: 'Silakan pilih slot waktu terlebih dahulu'
      });
      return;
    }

    // Dapatkan nama toko yang dipilih
    const selectedShopName = shops.find(shop => shop.shop_id === selectedDialogShop)?.shop_name;
    if (!selectedShopName) {
      toast.error('Error', {
        description: 'Data toko tidak ditemukan'
      });
      return;
    }

    try {
      const response = await fetch('/api/flashsale/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: selectedDialogShop,
          timeslot_id: selectedTimeSlot.timeslot_id
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Berhasil', {
          description: 'Flash sale berhasil dibuat'
        });
        // Tambahkan shop_name ke URL
        router.push(`/flashsale/detail?shop_id=${selectedDialogShop}&shop_name=${encodeURIComponent(selectedShopName)}&flash_sale_id=${data.data.flash_sale_id}`);
      } else {
        toast.error('Gagal', {
          description: data.message || 'Gagal membuat flash sale'
        });
      }
    } catch (error) {
      toast.error('Error', {
        description: 'Terjadi kesalahan saat membuat flash sale'
      });
    } finally {
      setIsDesktopDialogOpen(false);
      setIsMobileDialogOpen(false);
    }
  };

  const handleUpdateStatus = async (flashSaleId: number, newStatus: FlashSaleStatus) => {
    // Jika akan menonaktifkan (status 2), tampilkan konfirmasi
    if (newStatus === 2) {
      setPendingStatusUpdate({ flashSaleId, newStatus });
      setShowStatusConfirmDialog(true);
      return;
    }
    
    // Jika mengaktifkan, langsung proses
    await updateFlashSaleStatus(flashSaleId, newStatus);
  };

  // Fungsi untuk memproses update status
  const updateFlashSaleStatus = async (flashSaleId: number, newStatus: FlashSaleStatus) => {
    try {
      const response = await fetch('/api/flashsale/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: selectedShop,
          flash_sale_id: flashSaleId,
          status: newStatus
        })
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success(newStatus === 1 ? 'Flash sale berhasil diaktifkan' : 'Flash sale berhasil dinonaktifkan', {
          description: newStatus === 2 ? 'Semua produk dalam sesi ini telah dinonaktifkan' : undefined
        });
        fetchFlashSales();
      } else {
        toast.error('Gagal memperbarui status flash sale', {
          description: data.message || 'Gagal memperbarui status flash sale'
        });
      }
    } catch (error) {
      toast.error('Terjadi kesalahan', {
        description: 'Gagal memperbarui status flash sale'
      });
    }
  };

  const handleDelete = async (flashSaleId: number) => {
    // Tampilkan dialog konfirmasi dulu
    setDeletingFlashSale(flashSaleId);
    setShowDeleteConfirmDialog(true);
  };

  const confirmDelete = async () => {
    if (!deletingFlashSale) return;
    
    setIsDeletingSingle(true);
    try {
      const response = await fetch(`/api/flashsale/delete?shop_id=${selectedShop}&flash_sale_id=${deletingFlashSale}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      if (data.success) {
        // Dapatkan informasi flash sale yang dihapus
        const deletedFlashSale = flashSales.find(sale => sale.flash_sale_id === deletingFlashSale);
        const startTime = dayjs(deletedFlashSale?.start_time ? deletedFlashSale.start_time * 1000 : undefined);
        
        toast.success(`Flash sale ${deletingFlashSale} berhasil dihapus`, {
          description: (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Periode: {startTime.format('DD/MM/YYYY HH:mm')}
              </p>
            </div>
          )
        });
        fetchFlashSales();
      } else {
        toast.error('Gagal menghapus flash sale', {
          description: data.message || 'Gagal menghapus flash sale'
        });
      }
    } catch (error) {
      toast.error('Terjadi kesalahan', {
        description: 'Gagal menghapus flash sale'
      });
    } finally {
      setIsDeletingSingle(false);
      setDeletingFlashSale(null);
      setShowDeleteConfirmDialog(false);
    }
  };

  const handleDuplicate = async (flashSaleId: number) => {
    setDuplicatingFlashSaleId(flashSaleId);
    setSelectedSlots([]); // Reset selected slots
    
    try {
      const response = await fetch(`/api/flashsale/timeslot?shop_id=${selectedShop}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setTimeSlots(data.data);
        setIsDuplicateDialogOpen(true);
      } else {
        toast.error('Error', {
          description: 'Gagal mengambil slot waktu yang tersedia'
        });
      }
    } catch (error) {
      toast.error('Error', {
        description: 'Terjadi kesalahan saat mengambil slot waktu'
      });
    }
  };

  const handleConfirmDuplicate = async () => {
    if (!selectedSlots.length || !duplicatingFlashSaleId) {
      toast.warning('Pilih Slot', {
        description: 'Silakan pilih minimal satu slot waktu'
      });
      return;
    }

    setDuplicateProgress({
      total: selectedSlots.length,
      current: 0,
      status: 'Memulai proses duplikasi...'
    });
    setProgressDetails({}); // Reset progress details

    try {
      const response = await fetch('/api/flashsale/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: selectedShop,
          flash_sale_id: duplicatingFlashSaleId,
          timeslot_ids: selectedSlots
        })
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Tidak dapat membaca response');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.progress?.detail) {
                const { flash_sale_id, ...rest } = data.progress.detail;
                if (flash_sale_id) {
                  setProgressDetails(prev => ({
                    ...prev,
                    [flash_sale_id]: {
                      ...rest,
                      flash_sale_id,
                    }
                  }));
                }
              }

              if (data.progress) {
                setDuplicateProgress(prev => ({
                  total: selectedSlots.length, // Pastikan total sesuai slot yang dipilih
                  current: data.progress.current,
                  status: data.progress.status
                }));
              }
            } catch (error) {
              console.error('Error parsing progress:', error);
            }
          }
        }
      }
    } catch (error) {
      setDuplicateProgress(prev => ({
        total: prev?.total || selectedSlots.length,
        current: prev?.current || 0,
        status: 'Terjadi kesalahan saat menduplikasi flash sale'
      }));
      toast.error('Error', {
        description: 'Terjadi kesalahan saat menduplikasi flash sale'
      });
    }
  };

  const columns = [
    {
      title: 'Periode',
      key: 'period',
      render: (_: any, record: FlashSale) => (
        <div className="space-y-1">
          <div className="flex items-center text-sm">
            <CalendarDays className="w-4 h-4 mr-2 text-muted-foreground" />
            {dayjs(record.start_time * 1000).format('DD/MM/YYYY')}
          </div>
          <div className="flex items-center text-sm">
            <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
            <span className="font-semibold text-blue-600">
              {dayjs(record.start_time * 1000).format('HH:mm')} - {dayjs(record.end_time * 1000).format('HH:mm')}
            </span>
          </div>
        </div>
      )
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: FlashSale) => getStatusBadge(record.status, record.type)
    },
    {
      title: 'Statistik',
      key: 'stats',
      render: (_: any, record: FlashSale) => (
        <div className="space-y-1">
          <div className="text-sm">
            <span className="font-medium">{record.enabled_item_count}</span>
            <span className="text-muted-foreground"> / {record.item_count} item aktif</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center">
              <Eye className="w-4 h-4 mr-1" />
              {record.click_count} klik
            </span>
            <span className="flex items-center">
              <Bell className="w-4 h-4 mr-1" />
              {record.remindme_count} pengingat
            </span>
          </div>
        </div>
      )
    },
    {
      title: 'Status Aktif',
      key: 'activeStatus',
      render: (_: any, record: FlashSale) => (
        <div className="flex items-center space-x-2">
          <Switch
            checked={record.status === 1}
            disabled={record.status === 3}
            onCheckedChange={(checked) => {
              handleUpdateStatus(record.flash_sale_id, checked ? 1 : 2);
            }}
          />
          <span className="text-sm text-muted-foreground">
            {record.status === 1 ? 'Aktif' : 'Nonaktif'}
          </span>
        </div>
      )
    },
    {
      title: 'ID Flash Sale',
      dataIndex: 'flash_sale_id',
      key: 'flash_sale_id',
      render: (_: any, record: FlashSale) => record.flash_sale_id
    },
    {
      title: 'Aksi',
      key: 'action',
      render: (_: any, record: FlashSale) => (
        <div className="text-right">
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const shopName = shops.find(shop => shop.shop_id === selectedShop)?.shop_name;
                router.push(`/flashsale/detail?shop_id=${selectedShop}&shop_name=${encodeURIComponent(shopName || '')}&flash_sale_id=${record.flash_sale_id}`);
              }}
            >
              Detail
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDuplicate(record.flash_sale_id)}
            >
              Duplikat
            </Button>
            {record.status !== 3 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(record.flash_sale_id)}
              >
                Hapus
              </Button>
            )}
          </div>
        </div>
      )
    }
  ];

  const typeOptions = [
    { value: 0, label: 'Semua Status' },
    { value: 1, label: 'Akan Datang' },
    { value: 2, label: 'Sedang Berlangsung' },
    { value: 3, label: 'Berakhir' }
  ];

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const hasSlots = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return timeSlotsByDate[dateKey]?.length > 0;
  };

  const getSlotCount = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const slots = timeSlotsByDate[dateKey] || [];
    return slots.length > 0 ? `${slots.length} slot` : "";
  };

  const handleBulkDelete = async () => {
    setShowDeleteConfirmDialog(true);
  };

  const confirmBulkDelete = async () => {
    if (!selectedItems.length) return;
    
    setIsDeletingItems(true);
    try {
      const promises = selectedItems.map(flashSaleId =>
        fetch(`/api/flashsale/delete?shop_id=${selectedShop}&flash_sale_id=${flashSaleId}`, {
          method: 'DELETE'
        }).then(res => res.json())
      );

      const results = await Promise.all(promises);
      const successCount = results.filter(result => result.success).length;
      const failCount = selectedItems.length - successCount;

      // Dapatkan total produk yang terdampak
      const affectedItems = selectedItems
        .map(id => flashSales.find(sale => sale.flash_sale_id === id))
        .reduce((total, sale) => total + (sale?.item_count || 0), 0);

      if (successCount > 0) {
        toast.success('Flash sale berhasil dihapus', {
          description: (
            <div className="space-y-1 mt-1">
              <p>{successCount} flash sale telah dihapus</p>
              {failCount > 0 && (
                <p className="text-sm text-yellow-600">
                  {failCount} flash sale gagal dihapus
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Total {affectedItems} produk telah dikeluarkan dari flash sale
              </p>
            </div>
          )
        });
        fetchFlashSales();
      } else {
        toast.error('Gagal menghapus flash sale', {
          description: 'Semua operasi penghapusan gagal'
        });
      }
      
      setSelectedItems([]);
    } catch (error) {
      toast.error('Terjadi kesalahan', {
        description: 'Gagal menghapus flash sale'
      });
    } finally {
      setIsDeletingItems(false);
      setShowDeleteConfirmDialog(false);
    }
  };

  // Update dialog konfirmasi untuk mendukung single dan bulk delete
  const DeleteConfirmDialog = () => (
    <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
      <DialogContent>
        <DialogTitle>Konfirmasi Penghapusan</DialogTitle>
        <DialogDescription className="space-y-3">
          <div className="flex items-center gap-2 text-yellow-600">
            <AlertTriangle className="h-5 w-5" />
            {deletingFlashSale ? (
              <p>Peringatan: Anda akan menghapus Flash Sale #{deletingFlashSale}.</p>
            ) : (
              <p>Peringatan: Anda akan menghapus {selectedItems.length} flash sale.</p>
            )}
          </div>
          <p>Tindakan ini tidak dapat dibatalkan. Apakah Anda yakin ingin melanjutkan?</p>
        </DialogDescription>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setShowDeleteConfirmDialog(false);
              setDeletingFlashSale(null);
            }}
            disabled={isDeletingSingle || isDeletingItems}
          >
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={deletingFlashSale ? confirmDelete : confirmBulkDelete}
            disabled={isDeletingSingle || isDeletingItems}
          >
            {isDeletingSingle || isDeletingItems ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Menghapus...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Ya, Hapus
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const ProgressItem = ({ detail }: { detail: ProgressDetail }) => {
    const hasError = Boolean(detail.error);
    const isSuccess = detail.step === 'complete' && !hasError;

    return (
      <div className={`p-4 border rounded-lg mb-2 ${progressItemClass}`}>
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <div className="font-medium">
            {detail.flash_sale_id ? (
              `Flash Sale #${detail.flash_sale_id}`
            ) : (
              <span className="text-muted-foreground">Membuat Flash Sale...</span>
            )}
          </div>
          {detail.total_items > 0 && (
            <div className="text-sm text-muted-foreground">
              {detail.successful_items} / {detail.total_items} items
            </div>
          )}
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-6 mb-2">
          <StepIndicator 
            step="create"
            currentStep={detail.step}
            success={isSuccess || detail.flash_sale_id !== null}
            error={hasError}
          />
          <StepIndicator 
            step="register"
            currentStep={detail.step}
            success={isSuccess}
            error={hasError}
          />
          <StepIndicator 
            step="complete"
            currentStep={detail.step}
            success={isSuccess}
            error={hasError}
          />
        </div>

        {/* Status message */}
        <p className={`text-sm ${hasError ? 'text-red-600' : 'text-muted-foreground'}`}>
          {detail.error || (
            isSuccess 
              ? `Berhasil mendaftarkan ${detail.successful_items} items ke Flash Sale #${detail.flash_sale_id}`
              : detail.status
          )}
        </p>
      </div>
    );
  };

  // Update StepIndicator untuk menangani status pembuatan flash sale
  const StepIndicator = ({ 
    step, 
    currentStep,
    success,
    error 
  }: StepIndicatorProps) => {
    const getStatus = () => {
      if (error) return 'error';
      if (step === 'create' && success) return 'success'; // Khusus untuk step create
      if (step === currentStep) return 'processing';
      if (success && ['create', 'register', 'complete'].indexOf(step) <= ['create', 'register', 'complete'].indexOf(currentStep)) {
        return 'success';
      }
      return 'pending';
    };

    return (
      <div className="flex items-center gap-1">
        <div className={`h-2 w-2 rounded-full ${
          getStatus() === 'error' ? 'bg-red-500' :
          getStatus() === 'pending' ? 'bg-gray-200' :
          getStatus() === 'processing' ? 'bg-blue-400 animate-pulse' :
          'bg-green-500'
        }`} />
        <span className="text-xs text-muted-foreground">
          {step === 'create' ? 'Membuat' :
           step === 'register' ? 'Mendaftarkan' :
           'Selesai'}
        </span>
      </div>
    );
  };

  const ProgressList = () => {
    const sortedProgressDetails = useMemo(() => {
      if (!duplicateProgress) return [];
      
      return Object.values(progressDetails)
        .filter(detail => detail.flash_sale_id)
        .sort((a, b) => b.flash_sale_id - a.flash_sale_id)
        .slice(0, duplicateProgress.total);
    }, [duplicateProgress]);

    if (!duplicateProgress) return null;

    return (
      <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto pr-2">
        {sortedProgressDetails.map((detail) => (
          <ProgressItem 
            key={detail.flash_sale_id} 
            detail={detail}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Header yang lebih compact untuk mobile */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold dark:text-white">Manajemen Flash Sale</h1>
        <div className="flex gap-2">
          {selectedItems.length > 0 && (
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              size="sm"
              className="flex items-center gap-2 md:size-default"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden md:inline">Hapus</span> {selectedItems.length}
            </Button>
          )}
          <Button 
            className="bg-primary flex-1 md:flex-none" 
            size="sm" 
            onClick={handleCreateFlashSale}
          >
            {calendarLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Buat Flash Sale
          </Button>
        </div>
      </div>

      {/* Filter dengan Indicator baru */}
      <div className="flex flex-col md:flex-row gap-3 md:gap-4 mb-4 md:mb-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4 w-full">
          <Select value={selectedShop?.toString()} onValueChange={handleShopChange}>
            <SelectTrigger className="w-full md:w-[250px]">
              <SelectValue placeholder="Pilih Toko" />
            </SelectTrigger>
            <SelectContent>
              {shops.map(shop => (
                <SelectItem key={shop.shop_id} value={shop.shop_id.toString()}>
                  {shop.shop_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedType.toString()} onValueChange={(value) => setSelectedType(Number(value))}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Status Flash Sale" />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map(option => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table dan Card View */}
      <div className="hidden md:block">
        <div className="border rounded-lg dark:border-gray-800">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={
                      flashSales.length > 0 && selectedItems.length === flashSales.length
                    }
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedItems(flashSales.map((sale) => sale.flash_sale_id));
                      } else {
                        setSelectedItems([]);
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Periode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Statistik</TableHead>
                <TableHead>Status Aktif</TableHead>
                <TableHead>ID Flash Sale</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 dark:text-gray-400">
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Memuat data...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="flex flex-col items-center justify-center py-8">
                      <AlertTriangle className="h-8 w-8 text-red-500 mb-2" />
                      <h3 className="text-lg font-medium mb-2 text-red-500">
                        Gagal Memuat Data
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 px-6">
                        {error}
                      </p>
                      <Button 
                        onClick={() => fetchFlashSales(currentPage, pageSize)}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Coba Lagi
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : flashSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-[400px]">
                    <div className="flex flex-col items-center justify-center h-full">
                      <div className="relative mb-4">
                        <CalendarDays className="h-12 w-12 text-gray-400 dark:text-gray-600" strokeWidth={1.5} />
                        <X className="h-6 w-6 text-gray-400 dark:text-gray-600 absolute -top-2 -right-2" strokeWidth={1.5} />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
                        Belum Ada Flash Sale
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center max-w-[300px]">
                        Buat flash sale pertama Anda untuk meningkatkan penjualan dengan penawaran terbatas waktu
                      </p>
                      <Button onClick={handleCreateFlashSale}>
                        <Plus className="w-4 h-4 mr-2" />
                        Buat Flash Sale
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                flashSales.map((sale) => (
                  <TableRow key={sale.flash_sale_id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedItems.includes(sale.flash_sale_id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedItems([...selectedItems, sale.flash_sale_id]);
                          } else {
                            setSelectedItems(selectedItems.filter(id => id !== sale.flash_sale_id));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center text-sm">
                          <CalendarDays className="w-4 h-4 mr-2 text-muted-foreground" />
                          {dayjs(sale.start_time * 1000).format('DD/MM/YYYY')}
                        </div>
                        <div className="flex items-center text-sm">
                          <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
                          <span className="font-semibold text-blue-600">
                            {dayjs(sale.start_time * 1000).format('HH:mm')} - {dayjs(sale.end_time * 1000).format('HH:mm')}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(sale.status, sale.type)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <div className="text-sm">
                          {sale.enabled_item_count} / {sale.item_count} item aktif
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center">
                            <Eye className="w-4 h-4 mr-1" />
                            {sale.click_count} klik
                          </span>
                          <span className="flex items-center">
                            <Bell className="w-4 h-4 mr-1" />
                            {sale.remindme_count} pengingat
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={sale.status === 1}
                          disabled={sale.status === 3}
                          onCheckedChange={(checked) => {
                            handleUpdateStatus(sale.flash_sale_id, checked ? 1 : 2);
                          }}
                        />
                        <span className="text-sm text-muted-foreground">
                          {sale.status === 1 ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{sale.flash_sale_id}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const shopName = shops.find(shop => shop.shop_id === selectedShop)?.shop_name;
                            router.push(`/flashsale/detail?shop_id=${selectedShop}&shop_name=${encodeURIComponent(shopName || '')}&flash_sale_id=${sale.flash_sale_id}`);
                          }}
                        >
                          Detail
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDuplicate(sale.flash_sale_id)}
                        >
                          Duplikat
                        </Button>
                        {sale.status !== 3 && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(sale.flash_sale_id)}
                          >
                            Hapus
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
      </div>

      <div className="md:hidden space-y-3"> {/* Kurangi gap antar card */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="h-12 w-12 text-red-500" />
            </div>
            <h3 className="text-lg font-medium mb-2 text-red-500">
              Gagal Memuat Data
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 px-6">
              {error}
            </p>
            <Button 
              onClick={() => fetchFlashSales(currentPage, pageSize)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCcw className="h-4 w-4" />
              Coba Lagi
            </Button>
          </div>
        ) : flashSales.length === 0 ? (
          <div className="text-center py-12">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <CalendarDays className="h-12 w-12 text-gray-400 dark:text-gray-600" strokeWidth={1.5} />
                <X className="h-6 w-6 text-gray-400 dark:text-gray-600 absolute -top-2 -right-2" strokeWidth={1.5} />
              </div>
            </div>
            <h3 className="text-lg font-medium mb-2">Belum Ada Flash Sale</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center max-w-[300px]">
              Buat flash sale pertama Anda untuk meningkatkan penjualan dengan penawaran terbatas waktu
            </p>
            <Button onClick={handleCreateFlashSale}>
              <Plus className="w-4 h-4 mr-2" />
              Buat Flash Sale
            </Button>
          </div>
        ) : (
          flashSales.map((sale) => (
            <FlashSaleCard
              key={sale.flash_sale_id}
              sale={sale}
              onStatusChange={handleUpdateStatus}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              shopName={shops.find(shop => shop.shop_id === selectedShop)?.shop_name}
              selectedShop={selectedShop!}
            />
          ))
        )}
      </div>

      {/* Pagination yang lebih compact untuk mobile */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-4 text-sm text-muted-foreground">
        <div className="order-2 md:order-1 text-center md:text-left dark:text-gray-400">
          <div className="flex items-center gap-2">
            <span>
              Menampilkan {totalCount === 0 ? 0 : ((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalCount)} dari {totalCount} data
            </span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setCurrentPage(1); // Reset ke halaman pertama
              }}
            >
              <SelectTrigger className="w-[70px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>per halaman</span>
          </div>
        </div>

        <div className="order-1 md:order-2 flex items-center gap-1 md:gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800 dark:disabled:text-gray-700"
          >
            Previous
          </Button>
          
          {Array.from({ length: totalPages }).map((_, index) => {
            const pageNumber = index + 1;
            
            // Tampilkan halaman pertama, terakhir, dan halaman di sekitar halaman aktif
            if (
              pageNumber === 1 ||
              pageNumber === totalPages ||
              (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
            ) {
              return (
                <Button 
                  key={pageNumber}
                  variant="outline" 
                  size="sm"
                  onClick={() => handlePageChange(pageNumber)}
                  className={pageNumber === currentPage 
                    ? "bg-primary text-white hover:bg-primary dark:bg-white dark:text-black dark:hover:bg-white/90" 
                    : "dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"}
                >
                  {pageNumber}
                </Button>
              );
            }

            // Tampilkan ellipsis jika ada gap
            if (
              (pageNumber === currentPage - 2 && pageNumber > 2) ||
              (pageNumber === currentPage + 2 && pageNumber < totalPages - 1)
            ) {
              return <span key={pageNumber} className="px-1 dark:text-gray-400">...</span>;
            }

            return null;
          })}

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800 dark:disabled:text-gray-700"
          >
            Next
          </Button>
        </div>
      </div>

      {/* Dialog untuk desktop */}
      <Dialog open={isDesktopDialogOpen} onOpenChange={setIsDesktopDialogOpen}>
        <DialogContent className="sm:max-w-[900px] p-0 dark:border-gray-800 dark:bg-gray-950">
          <div className="p-6 pb-4 border-b dark:border-gray-800">
            <div className="flex items-center justify-between gap-4 pr-8">
              <h2 className="text-xl font-semibold dark:text-white">
                Buat Flash Sale Baru
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-gray-600 dark:text-gray-400">Toko:</span>
                <Select
                  value={selectedDialogShop?.toString()}
                  onValueChange={handleDialogShopChange}
                >
                  <SelectTrigger className="w-[300px] border-gray-300 bg-white focus:ring-black">
                    <SelectValue placeholder="Pilih Toko" />
                  </SelectTrigger>
                  <SelectContent>
                    {shops.map(shop => (
                      <SelectItem key={shop.shop_id} value={shop.shop_id.toString()}>
                        {shop.shop_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          {!selectedShop && (
            <div className="px-6 py-3 bg-yellow-50 dark:bg-yellow-900/30 border-b dark:border-gray-800">
              <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
                <AlertTriangle className="h-4 w-4" />
                <span>Silakan pilih toko terlebih dahulu untuk melihat slot waktu yang tersedia</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-0">
            {/* Kolom Kalender */}
            <div className="p-8 border-r border-t dark:border-gray-800">
              <Calendar
                mode="single"
                selected={date}
                onSelect={handleDateChange}
                className="w-full dark:bg-gray-950"
                classNames={{
                  months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                  month: "space-y-4 w-full",
                  caption: "flex justify-center pt-1 relative items-center",
                  caption_label: "text-base font-medium dark:text-white",
                  nav: "space-x-1 flex items-center",
                  nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 dark:text-gray-400",
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                  table: "w-full border-collapse space-y-1",
                  head_row: "flex w-full",
                  head_cell: "text-slate-500 dark:text-gray-400 rounded-md w-12 font-normal text-[0.875rem]",
                  row: "flex w-full mt-2",
                  cell: "relative p-0 text-center text-sm w-12 h-12",
                  day: "h-12 w-12 p-0 font-normal text-sm dark:text-gray-300",
                  day_selected: "bg-black dark:bg-white text-white dark:text-black hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black focus:bg-black dark:focus:bg-white focus:text-white dark:focus:text-black",
                }}
                components={{
                  DayContent: ({ date }) => (
                    <div className="flex flex-col items-center justify-center h-12 w-12">
                      <span className="text-sm">{date.getDate()}</span>
                      {hasSlots(date) && (
                        <span className="text-[11px] text-red-500 -mt-0.5">{getSlotCount(date)}</span>
                      )}
                    </div>
                  )
                }}
              />
            </div>

            {/* Kolom Slot Waktu */}
            <div className="p-6 border-t dark:border-gray-800 h-[600px] flex flex-col">
              <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {!date 
                    ? "Pilih tanggal terlebih dahulu"
                    : timeSlots.length > 0 
                      ? "Sesi Flash Sale" 
                      : "Tidak ada slot waktu tersedia"}
                </h3>
              </div>
              
              {date ? (
                <RadioGroup
                  value={selectedTimeSlot?.timeslot_id.toString()}
                  onValueChange={(value) => {
                    const slot = timeSlots.find(s => s.timeslot_id === parseInt(value));
                    if (slot) {
                      setSelectedTimeSlot(slot);
                    }
                  }}
                  className="space-y-2.5 overflow-y-auto pr-2 custom-scrollbar"
                >
                  {timeSlots.map((slot) => (
                    <div
                      key={slot.timeslot_id}
                      className={`flex items-center justify-between p-3 rounded-md border ${
                        selectedTimeSlot?.timeslot_id === slot.timeslot_id
                          ? 'border-primary bg-primary/5 dark:bg-primary/10' 
                          : 'border-gray-200 dark:border-gray-800'
                      } hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer`}
                      onClick={() => setSelectedTimeSlot(slot)}
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem 
                          value={slot.timeslot_id.toString()} 
                          id={`slot-${slot.timeslot_id}`}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div>
                          <p className="text-sm font-medium dark:text-gray-200">
                            {dayjs(slot.start_time * 1000).format('DD/MM/YYYY')}
                          </p>
                          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                            {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-sm text-muted-foreground">
                  <CalendarDays className="h-8 w-8 mb-2 text-gray-400" />
                  <p>Silakan pilih tanggal di kalender</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 p-6 border-t dark:border-gray-800 mt-4">
            <Button
              variant="outline"
              onClick={() => setIsDesktopDialogOpen(false)}
              className="px-6 dark:border-gray-700 dark:text-gray-300"
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmTimeSlot}
              className="px-6 bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90"
            >
              Buat Flash Sale
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog untuk mobile */}
      <MobileCreateFlashSaleDialog
        isOpen={isMobileDialogOpen}
        onClose={() => setIsMobileDialogOpen(false)}
        selectedShop={selectedDialogShop}
        shops={shops}
        onShopChange={handleDialogShopChange}
        timeSlots={timeSlots}
        selectedTimeSlot={selectedTimeSlot}
        onTimeSlotSelect={(slot) => setSelectedTimeSlot(slot)}
        onConfirm={handleConfirmTimeSlot}
      />

      <Dialog open={showStatusConfirmDialog} onOpenChange={setShowStatusConfirmDialog}>
        <DialogContent>
          <DialogTitle>Konfirmasi Nonaktifkan Flash Sale</DialogTitle>
          <DialogDescription className="space-y-3">
            <div className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              <p>Peringatan: Menonaktifkan Flash Sale ini akan menonaktifkan semua produk dalam sesi ini.</p>
            </div>
            <p>Apakah Anda yakin ingin melanjutkan?</p>
          </DialogDescription>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowStatusConfirmDialog(false);
                setPendingStatusUpdate(null);
              }}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (pendingStatusUpdate) {
                  await updateFlashSaleStatus(
                    pendingStatusUpdate.flashSaleId,
                    pendingStatusUpdate.newStatus
                  );
                }
                setShowStatusConfirmDialog(false);
                setPendingStatusUpdate(null);
              }}
            >
              Ya, Nonaktifkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDuplicateDialogOpen} onOpenChange={setIsDuplicateDialogOpen}>
        <DialogContent className="sm:max-w-[600px] dark:border-gray-800 dark:bg-gray-950">
          <DialogTitle className="dark:text-gray-100">Duplikasi Flash Sale</DialogTitle>
          
          {duplicateProgress ? (
            <div className="py-6">
              <div className="space-y-5">
                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="h-2.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-500 ease-in-out"
                      style={{ 
                        width: `${(duplicateProgress.current / duplicateProgress.total) * 100}%` 
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground dark:text-gray-400">
                    <span>Progress</span>
                    <span>{duplicateProgress.current} dari {duplicateProgress.total} slot</span>
                  </div>
                </div>

                {/* Informasi Flash Sale yang diduplikasi */}
                <div className="text-sm text-center">
                  <div className="font-medium dark:text-gray-200">
                    {(() => {
                      const flashSale = flashSales.find(fs => fs.flash_sale_id === duplicatingFlashSaleId);
                      return flashSale ? `Menduplikasi Flash Sale #${duplicatingFlashSaleId} - ${flashSale.item_count} produk` : '-';
                    })()}
                  </div>
                  <div className="text-muted-foreground dark:text-gray-400">
                    {(() => {
                      const flashSale = flashSales.find(fs => fs.flash_sale_id === duplicatingFlashSaleId);
                      if (!flashSale) return '-';
                      
                      return (
                        <>
                          <div>
                            {dayjs(flashSale.start_time * 1000).format('DD/MM/YYYY HH:mm')} - {dayjs(flashSale.end_time * 1000).format('HH:mm')}
                          </div>
                         
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Detail progress */}
                <ProgressList />
              </div>

              {duplicateProgress.current === duplicateProgress.total && (
                <div className="mt-6 flex justify-end">
                  <Button
                    onClick={() => {
                      setIsDuplicateDialogOpen(false);
                      setDuplicateProgress(null);
                      fetchFlashSales();
                    }}
                    className="dark:bg-white dark:text-black dark:hover:bg-white/90"
                  >
                    Selesai
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="py-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-muted-foreground dark:text-gray-400">
                    Pilih slot waktu flash sale(maksimal 20 slot)
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedSlots.length > 0 && selectedSlots.length === Math.min(timeSlots.length, 20)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          const slotsToSelect = timeSlots.slice(0, 20).map(slot => slot.timeslot_id);
                          setSelectedSlots(slotsToSelect);
                        } else {
                          setSelectedSlots([]);
                        }
                      }}
                    />
                   
                  </div>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  <div className="grid grid-cols-2 gap-2">
                    {timeSlots.map((slot) => {
                      const isSelected = selectedSlots.includes(slot.timeslot_id);
                      return (
                        <div
                          key={slot.timeslot_id}
                          className={`flex flex-col items-center justify-center p-2.5 rounded-md border cursor-pointer ${
                            isSelected 
                              ? 'border-primary bg-primary/5 dark:bg-primary/10' 
                              : 'border-gray-200 dark:border-gray-800'
                          } hover:bg-gray-50 dark:hover:bg-gray-800/50`}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedSlots(selectedSlots.filter(id => id !== slot.timeslot_id));
                            } else if (selectedSlots.length < 20) {
                              setSelectedSlots([...selectedSlots, slot.timeslot_id]);
                            } else {
                              toast.warning('Maksimal 20 Slot', {
                                description: 'Anda hanya dapat memilih maksimal 20 slot waktu'
                              });
                            }
                          }}
                        >
                          <p className="text-xs font-medium dark:text-gray-200">
                            {dayjs(slot.start_time * 1000).format('DD/MM/YYYY')}
                          </p>
                          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                            {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <DialogFooter className="border-t dark:border-gray-800 pt-4 -mt-4">
                <div className="flex items-center justify-between w-full">
                  <div className="text-sm text-muted-foreground dark:text-gray-400">
                    {selectedSlots.length} slot dipilih
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsDuplicateDialogOpen(false)}
                      className="dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      Batal
                    </Button>
                    <Button
                      onClick={handleConfirmDuplicate}
                      disabled={selectedSlots.length === 0}
                      className="dark:bg-white dark:text-black dark:hover:bg-white/90 disabled:dark:bg-gray-700"
                    >
                      Duplikasi
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog />
    </div>
  );
}
