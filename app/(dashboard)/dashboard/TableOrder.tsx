import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { OrderItem } from '@/app/hooks/useDashboard'
import {
  Table,
  TableBody,
 
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// Impor ikon-ikon yang diperlukan
import { Package, Clock, Truck, XCircle, AlertCircle, RefreshCcw, Search, Filter, Printer, PrinterCheck, CheckSquare, CheckCircle, Send, MessageSquare, Download, Info, X, AlertTriangle } from 'lucide-react'
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { OrderDetails } from './OrderDetails'
import { useShippingDocument } from '@/app/hooks/useShippingDocument';
import { Button } from "@/components/ui/button";
import { mergePDFs } from '@/app/utils/pdfUtils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { OrderHistory } from './OrderHistory';
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ChatButton from '@/components/ChatButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Loader2 } from "lucide-react";

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Fungsi untuk mengecek apakah timestamp adalah hari ini (waktu Jakarta)
function isToday(timestamp: number): boolean {
  if (!timestamp || timestamp === 0) return false;
  
  const today = new Date();
  const jakartaOffset = 7 * 60; // GMT+7 dalam menit
  
  // Menyesuaikan tanggal saat ini ke zona waktu Jakarta
  const jakartaToday = new Date(today.getTime() + (jakartaOffset * 60 * 1000));
  const jakartaDate = new Date(jakartaToday).setHours(0, 0, 0, 0);
  
  // Mengubah timestamp menjadi tanggal dalam zona waktu Jakarta
  const shipDate = new Date(timestamp * 1000);
  const shipDateOnly = new Date(shipDate).setHours(0, 0, 0, 0);
  
  return jakartaDate === shipDateOnly;
}

// Fungsi untuk mengecek apakah pesanan telah melewati batas waktu pengiriman
function isOverdue(timestamp: number): boolean {
  if (!timestamp || timestamp === 0) return false;
  
  // Mendapatkan waktu saat ini dalam detik (UNIX timestamp)
  const now = Math.floor(Date.now() / 1000);
  
  // Jika timestamp (ship_by_date) lebih kecil dari waktu sekarang,
  // berarti sudah melewati batas waktu
  return timestamp < now;
}

type OrdersDetailTableProps = {
  orders: OrderItem[]
  onOrderUpdate?: (orderSn: string, updates: Partial<OrderItem>) => void
  isLoading?: boolean
}

type OrderStatus = "READY_TO_SHIP" | "PROCESSED" | "SHIPPED" | "CANCELLED" | "IN_CANCEL" | "TO_RETURN";

const getStatusColor = (status: OrderStatus): string => {
  switch (status) {
    case "READY_TO_SHIP":
      return "bg-green-600 text-white";
    case "PROCESSED":
      return "bg-blue-600 text-white";
    case "SHIPPED":
      return "bg-indigo-600 text-white";
    case "CANCELLED":
      return "bg-red-600 text-white";
    case "IN_CANCEL":
      return "bg-yellow-600 text-white";
    case "TO_RETURN":
      return "bg-purple-600 text-white";
    default:
      return "bg-gray-600 text-white";
  }
};

const getStatusIcon = (status: OrderStatus) => {
  switch (status) {
    case "READY_TO_SHIP":
      return <Package size={14} className="inline-block mr-1" />;
    case "PROCESSED":
      return <Clock size={14} className="inline-block mr-1" />;
    case "SHIPPED":
      return <Truck size={14} className="inline-block mr-1" />;
    case "CANCELLED":
      return <XCircle size={14} className="inline-block mr-1" />;
    case "IN_CANCEL":
      return <AlertCircle size={14} className="inline-block mr-1" />;
    case "TO_RETURN":
      return <RefreshCcw size={14} className="inline-block mr-1" />;
    default:
      return null;
  }
};

// Update tipe props StatusBadge
type StatusBadgeProps = {
  status: OrderStatus;
  order: OrderItem;
  onProcess: (order: OrderItem) => void;
  onCancellationAction: (orderSn: string, action: 'ACCEPT' | 'REJECT') => void;
};

// Update komponen StatusBadge dengan props baru
const StatusBadge = React.memo(({ status, order, onProcess, onCancellationAction }: StatusBadgeProps) => (
  <div className="flex items-center gap-2">
    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(status)}`}>
      {getStatusIcon(status)}
      {status}
    </span>
    {status === 'READY_TO_SHIP' && (
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30"
        onClick={() => onProcess(order)}
        title="Proses Pesanan"
      >
        <Send size={16} className="text-blue-600 dark:text-blue-400" />
      </Button>
    )}
    {status === 'IN_CANCEL' && (
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0 hover:bg-green-100 dark:hover:bg-green-900/30"
          onClick={() => onCancellationAction(order.order_sn, 'ACCEPT')}
          title="Terima Pembatalan"
        >
          <CheckCircle size={16} className="text-green-600 dark:text-green-400" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0 hover:bg-red-100 dark:hover:bg-red-900/30"
          onClick={() => onCancellationAction(order.order_sn, 'REJECT')}
          title="Tolak Pembatalan"
        >
          <XCircle size={16} className="text-red-600 dark:text-red-400" />
        </Button>
      </div>
    )}
  </div>
));

// Tambahkan baris ini setelah definisi komponen StatusBadge
StatusBadge.displayName = 'StatusBadge';

// Tambahkan interface
interface ShippingDocumentParams {
  order_sn: string;
  package_number?: string;
  shipping_document_type: "THERMAL_AIR_WAYBILL";
  shipping_carrier?: string;
}

// 1. Pindahkan definisi Category dan categories ke atas
interface Category {
  name: string;
  status: OrderStatus;
  count?: number;
}

// 2. Definisikan categories di luar komponen sebagai konstanta
const CATEGORY_LIST: Category[] = [
  { name: "Semua", status: "READY_TO_SHIP" },
  { name: "Siap Kirim", status: "READY_TO_SHIP" },
  { name: "Diproses", status: "PROCESSED" },
  { name: "Dikirim", status: "SHIPPED" },
  { name: "Dibatalkan", status: "CANCELLED" },
  { name: "Permintaan Batal", status: "IN_CANCEL" },
  { name: "Retur", status: "TO_RETURN" }
];

// 1. Buat interface untuk state tabel
interface TableState {
  searchTerm: string;
  selectedShops: string[];
  activeCategory: string;
  showCheckbox: boolean;
  selectedOrders: string[];
  printStatus: 'all' | 'printed' | 'unprinted';
  selectedCouriers: string[];
  paymentType: 'all' | 'cod' | 'non_cod';
}

// 2. Buat interface untuk metrics
interface TableMetrics {
  readyToShipCount: number;
  cancelRequestCount: number;
  unprintedCount: number;
  totalPrintableDocuments: number;
}

// 1. Pisahkan MobileSelect menjadi komponen terpisah untuk mengurangi re-render
const MobileSelect = React.memo(({ 
  activeCategory, 
  categories, 
  onCategoryChange 
}: {
  activeCategory: string;
  categories: Category[];
  onCategoryChange: (value: string) => void;
}) => (
  <Select value={activeCategory} onValueChange={onCategoryChange}>
    <SelectTrigger className="h-8 text-xs w-full text-center flex justify-center">
      <SelectValue>
        {activeCategory} ({categories.find(c => c.name === activeCategory)?.count})
      </SelectValue>
    </SelectTrigger>
    <SelectContent 
      className="w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)]"
      position="popper"
      align="center"
      sideOffset={5}
    >
      {categories.map((category) => (
        <SelectItem 
          key={category.name} 
          value={category.name}
          className="text-center justify-center"
        >
          {category.name} ({category.count})
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
));

MobileSelect.displayName = 'MobileSelect';

// Buat komponen FilterContent yang dapat digunakan ulang
const FilterContent = React.memo(({ 
  tableState, 
  setTableState, 
  shops, 
  availableCouriers,
  onShopFilter,
  onCourierFilter,
  onPrintStatusFilter,
  onPaymentTypeFilter,
  onResetFilter
}: {
  tableState: TableState;
  setTableState: (value: React.SetStateAction<TableState>) => void;
  shops: string[];
  availableCouriers: string[];
  onShopFilter: (shopName: string) => void;
  onCourierFilter: (courier: string) => void;
  onPrintStatusFilter: (status: 'all' | 'printed' | 'unprinted') => void;
  onPaymentTypeFilter: (type: 'all' | 'cod' | 'non_cod') => void;
  onResetFilter: () => void;
}) => (
  <div className="grid gap-4">
    {/* 1. Filter Toko */}
    <div className="space-y-2">
      <h4 className="font-medium leading-none">Pilih Toko</h4>
      <div className="grid gap-2">
        {shops.map((shop) => (
          <div key={shop} className="flex items-center space-x-2">
            <Checkbox
              id={`shop-${shop}`}
              checked={tableState.selectedShops.includes(shop)}
              onCheckedChange={() => onShopFilter(shop)}
            />
            <label htmlFor={`shop-${shop}`} className="text-sm">
              {shop}
            </label>
          </div>
        ))}
      </div>
    </div>

    {/* 2. Filter Status Print */}
    <div className="space-y-2">
      <h4 className="font-medium leading-none">Status Print</h4>
      <Select 
        value={tableState.printStatus}
        onValueChange={(value: typeof tableState.printStatus) => 
          onPrintStatusFilter(value)
        }
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Pilih status print" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua</SelectItem>
          <SelectItem value="printed">Sudah Print</SelectItem>
          <SelectItem value="unprinted">Belum Print</SelectItem>
        </SelectContent>
      </Select>
    </div>

    {/* 3. Filter Kurir */}
    <div className="space-y-2">
      <h4 className="font-medium leading-none">Kurir</h4>
      <div className="grid gap-2">
        {availableCouriers.map((courier) => (
          <div key={courier} className="flex items-center space-x-2">
            <Checkbox
              id={`courier-${courier}`}
              checked={tableState.selectedCouriers.includes(courier)}
              onCheckedChange={() => onCourierFilter(courier)}
            />
            <label htmlFor={`courier-${courier}`} className="text-sm">
              {courier}
            </label>
          </div>
        ))}
      </div>
    </div>

    {/* 4. Filter Jenis Pembayaran */}
    <div className="space-y-2">
      <h4 className="font-medium leading-none">Jenis Pembayaran</h4>
      <Select 
        value={tableState.paymentType}
        onValueChange={(value: typeof tableState.paymentType) => 
          onPaymentTypeFilter(value)
        }
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Pilih jenis pembayaran" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua</SelectItem>
          <SelectItem value="cod">COD</SelectItem>
          <SelectItem value="non_cod">Non-COD</SelectItem>
        </SelectContent>
      </Select>
    </div>

    {/* 5. Tombol Reset Filter */}
    <Button
      variant="outline"
      size="sm"
      onClick={onResetFilter}
      className="mt-2"
    >
      Reset Filter
    </Button>
  </div>
));

FilterContent.displayName = 'FilterContent';

export function OrdersDetailTable({ orders, onOrderUpdate, isLoading }: OrdersDetailTableProps) {
  // Di awal fungsi OrdersDetailTable

  // 3. Gabungkan state yang berkaitan
  const [tableState, setTableState] = useState<TableState>({
    searchTerm: "",
    selectedShops: [],
    activeCategory: "Semua",
    showCheckbox: false,
    selectedOrders: [],
    printStatus: 'all',
    selectedCouriers: [],
    paymentType: 'all'
  });

  // Tambahkan state terpisah untuk input pencarian
  const [searchInput, setSearchInput] = useState("");
  
  // Gunakan debouncing untuk menunda pembaruan searchTerm
  useEffect(() => {
    const timer = setTimeout(() => {
      setTableState(prev => ({
        ...prev,
        searchTerm: searchInput
      }));
    }, 300); // Menunda eksekusi selama 300ms
    
    return () => clearTimeout(timer);
  }, [searchInput]);
  
  // Fungsi untuk menangani input pencarian
  const handleSearchInput = (value: string) => {
    setSearchInput(value);
  };
  
  // Fungsi untuk membersihkan input
  const clearSearch = () => {
    setSearchInput("");
    setTableState(prev => ({
      ...prev,
      searchTerm: ""
    }));
  };

  // Konsolidasikan semua derived data dalam satu useMemo
  const derivedData = useMemo(() => {
    // Fungsi helper untuk menentukan apakah order dapat dicentang
    const isOrderCheckable = (order: OrderItem): boolean => {
      return order.document_status === 'READY' &&
        (order.order_status === 'PROCESSED' || order.order_status === 'IN_CANCEL');
    };

    // Hitung semua data turunan dalam satu iterasi
    const unprintedOrders: OrderItem[] = [];
    const printableOrders: OrderItem[] = [];
    const uniqueShops = new Set<string>();
    const uniqueCouriers = new Set<string>();
    const statusCounts: Record<string, number> = {};
    const usernameCounts: Record<string, number> = {};
    
    // Iterasi orders hanya sekali
    orders.forEach(order => {
      // Hitung status counts
      const status = order.order_status;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      
      // Kumpulkan toko dan kurir unik
      if (order.shop_name) uniqueShops.add(order.shop_name);
      if (order.shipping_carrier) uniqueCouriers.add(order.shipping_carrier);
      
      // Hitung jumlah pesanan per username
      if (order.buyer_username) {
        usernameCounts[order.buyer_username] = (usernameCounts[order.buyer_username] || 0) + 1;
      }
      
      // Cek apakah order printable
      if (order.document_status === 'READY' &&
          (order.order_status === 'PROCESSED' || order.order_status === 'IN_CANCEL')) {
        
        printableOrders.push(order);
        
        // Cek apakah order belum dicetak
        if (!order.is_printed) {
          unprintedOrders.push(order);
        }
      }
    });
    
    // Hitung metrics
    const readyToShipCount = statusCounts['READY_TO_SHIP'] || 0;
    const cancelRequestCount = statusCounts['IN_CANCEL'] || 0;
    const unprintedCount = unprintedOrders.length;
    const totalPrintableDocuments = printableOrders.length;
    
    // Update categories dengan count
    const updatedCategories = CATEGORY_LIST.map(category => ({
      ...category,
      count: category.name === "Semua" 
        ? orders.length 
        : statusCounts[category.status] || 0
    }));
    
    return {
      readyToShipCount,
      cancelRequestCount,
      unprintedCount,
      totalPrintableDocuments,
      unprintedOrders,
      printableOrders,
      shops: Array.from(uniqueShops).sort(),
      availableCouriers: Array.from(uniqueCouriers).sort(),
      updatedCategories,
      isOrderCheckable,
      usernameCounts
    };
  }, [orders]);

  // Optimasi filter chain dengan early return
  const filteredOrders = useMemo(() => {
    // 1. Filter berdasarkan kategori (biasanya paling selektif)
    let result = tableState.activeCategory === "Semua" 
      ? orders 
      : orders.filter(order => 
          order.order_status === CATEGORY_LIST.find(cat => cat.name === tableState.activeCategory)?.status
        );
    
    // Jika tidak ada hasil setelah filter kategori, return early
    if (result.length === 0) return result;
    
    // 2. Filter berdasarkan toko jika dipilih
    if (tableState.selectedShops.length > 0) {
      result = result.filter(order => tableState.selectedShops.includes(order.shop_name));
      if (result.length === 0) return result;
    }
    
    // 3. Filter berdasarkan status print
    if (tableState.printStatus !== 'all') {
      result = result.filter(order => 
        (tableState.printStatus === 'printed' && order.is_printed) ||
        (tableState.printStatus === 'unprinted' && !order.is_printed)
      );
      if (result.length === 0) return result;
    }
    
    // 4. Filter berdasarkan kurir
    if (tableState.selectedCouriers.length > 0) {
      result = result.filter(order => 
        order.shipping_carrier && tableState.selectedCouriers.includes(order.shipping_carrier)
      );
      if (result.length === 0) return result;
    }
    
    // 5. Filter berdasarkan jenis pembayaran
    if (tableState.paymentType !== 'all') {
      result = result.filter(order => 
        (tableState.paymentType === 'cod' && order.cod) ||
        (tableState.paymentType === 'non_cod' && !order.cod)
      );
      if (result.length === 0) return result;
    }
    
    // 6. Filter berdasarkan pencarian (biasanya paling mahal)
    if (tableState.searchTerm) {
      const searchLower = tableState.searchTerm.toLowerCase();
      result = result.filter(order => 
        order.buyer_username?.toLowerCase().includes(searchLower) ||
        order.shipping_carrier?.toLowerCase().includes(searchLower) ||
        order.order_sn.toLowerCase().includes(searchLower)
      );
    }
    
    return result;
  }, [orders, tableState]);

  // 6. Update handlers menggunakan tableState
  const handleCategoryChange = useCallback((categoryName: string) => {
    setTableState(prev => ({ ...prev, activeCategory: categoryName }));
  }, []);

  const handleSearch = useCallback((term: string) => {
    setTableState(prev => ({ ...prev, searchTerm: term }));
  }, []);

  const handleShopFilter = useCallback((shopName: string) => {
    setTableState(prev => ({
      ...prev,
      selectedShops: prev.selectedShops.includes(shopName)
        ? prev.selectedShops.filter(shop => shop !== shopName)
        : [...prev.selectedShops, shopName]
    }));
  }, []);

  const handleToggleCheckbox = useCallback(() => {
    setTableState(prev => {
      const newShowCheckbox = !prev.showCheckbox;
      return {
        ...prev,
        showCheckbox: newShowCheckbox,
        selectedOrders: newShowCheckbox ? prev.selectedOrders : []
      };
    });
  }, []);

  const handleSelectOrder = useCallback((orderSn: string, checked: boolean) => {
    setTableState(prev => ({
      ...prev,
      selectedOrders: checked 
        ? [...prev.selectedOrders, orderSn]
        : prev.selectedOrders.filter(sn => sn !== orderSn)
    }));
  }, []);

  const handleSelectAll = useCallback((checked: boolean) => {
    setTableState(prev => ({
      ...prev,
      selectedOrders: checked
        ? filteredOrders
            .filter(order => derivedData.isOrderCheckable(order))
            .map(order => order.order_sn)
        : []
    }));
  }, [filteredOrders, derivedData.isOrderCheckable]);

  // Tambahkan hook useShippingDocument
  const { 
    downloadDocument, 
    isLoadingForOrder, 
    bulkProgress: documentBulkProgress,
    setBulkProgress: setDocumentBulkProgress,
    error: documentError 
  } = useShippingDocument();

  // Ganti fungsi handleDownloadDocument yang lama
  const handleDownloadDocument = useCallback(async (order: OrderItem) => {
    try {
      const params = {
        order_sn: order.order_sn,
        package_number: order.package_number,
        shipping_document_type: "THERMAL_AIR_WAYBILL" as const,
        shipping_carrier: order.shipping_carrier
      };

      // Destructure response untuk mendapatkan blob
      const { blob } = await downloadDocument(order.shop_id, [params]);
      const url = URL.createObjectURL(blob); // Gunakan blob, bukan seluruh response
      
      window.open(url, '_blank');
      
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);

      if (onOrderUpdate) {
        onOrderUpdate(order.order_sn, { is_printed: true });
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Gagal mengunduh dokumen');
    }
  }, [downloadDocument, onOrderUpdate]);

  // Tambahkan state baru untuk failed orders
  const [failedOrders, setFailedOrders] = useState<{
    orderSn: string;
    shopName: string;
    carrier: string;
    trackingNumber: string;
  }[]>([]);


  // Tambahkan interface untuk menyimpan blob
  interface ShopBlob {
    shopName: string;
    blob: Blob;
  }

  // Tambahkan state untuk menyimpan blob
  const [shopBlobs, setShopBlobs] = useState<ShopBlob[]>([]);

  // Fungsi helper untuk membagi array menjadi chunks
  const chunkArray = <T,>(array: T[], chunkSize: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  };

  // Update fungsi processPrintingAndReport dengan pendekatan paralel
  const processPrintingAndReport = async (ordersToPrint: OrderItem[]) => {
    let totalSuccess = 0;
    let totalFailed = 0;
    const shopReports: {
      shopName: string;
      success: number;
      failed: number;
    }[] = [];
    const newFailedOrders: typeof failedOrders = [];
    const newShopBlobs: ShopBlob[] = [];

    try {
      // Kelompokkan berdasarkan shop_id
      const ordersByShop = ordersToPrint.reduce((groups: { [key: number]: OrderItem[] }, order) => {
        const shopId = order.shop_id;
        if (!groups[shopId]) {
          groups[shopId] = [];
        }
        groups[shopId].push(order);
        return groups;
      }, {});

      // Konversi ke array untuk pemrosesan paralel
      const shopEntries = Object.entries(ordersByShop);
      
      // Batasi jumlah proses paralel (misalnya 3 toko sekaligus)
      const PARALLEL_LIMIT = 3;
      const shopChunks = chunkArray(shopEntries, PARALLEL_LIMIT);
      
      // Inisialisasi progress
      setDocumentBulkProgress(prev => ({
        ...prev,
        total: ordersToPrint.length
      }));

      // Proses setiap chunk secara paralel
      for (const shopChunk of shopChunks) {
        // Proses toko dalam chunk secara paralel
        await Promise.all(shopChunk.map(async ([shopIdStr, shopOrders]) => {
          const shopId = parseInt(shopIdStr);
          const shopName = shopOrders[0].shop_name;
          let shopSuccess = 0;
          let shopFailed = 0;
          const blobs: Blob[] = [];

          setDocumentBulkProgress(prev => ({
            ...prev,
            currentShop: shopName
          }));

          const ordersByCarrier = shopOrders.reduce((groups: { [key: string]: OrderItem[] }, order) => {
            const carrier = order.shipping_carrier || 'unknown';
            if (!groups[carrier]) {
              groups[carrier] = [];
            }
            groups[carrier].push(order);
            return groups;
          }, {});

          // Batasi jumlah proses paralel per kurir (misalnya 2 kurir sekaligus)
          const CARRIER_PARALLEL_LIMIT = 2;
          const carrierEntries = Object.entries(ordersByCarrier);
          const carrierChunks = chunkArray(carrierEntries, CARRIER_PARALLEL_LIMIT);

          for (const carrierChunk of carrierChunks) {
            // Proses kurir dalam chunk secara paralel
            const carrierResults = await Promise.all(carrierChunk.map(async ([carrier, carrierOrders]) => {
              setDocumentBulkProgress(prev => ({
                ...prev,
                currentCarrier: carrier,
                currentShop: shopName
              }));

              const orderParams = carrierOrders.map(order => ({
                order_sn: order.order_sn,
                package_number: order.package_number,
                shipping_document_type: "THERMAL_AIR_WAYBILL" as const,
                shipping_carrier: order.shipping_carrier
              }));

              try {
                const { blob, failedOrders } = await downloadDocument(shopId, orderParams);
                
                return {
                  carrier,
                  blob,
                  failedOrders,
                  successCount: carrierOrders.length - failedOrders.length,
                  failedCount: failedOrders.length,
                  carrierOrders
                };
              } catch (error) {
                console.error(`Error downloading documents for carrier ${carrier}:`, error);
                
                // Kembalikan semua order sebagai gagal
                return {
                  carrier,
                  blob: null,
                  failedOrders: carrierOrders.map(o => o.order_sn),
                  successCount: 0,
                  failedCount: carrierOrders.length,
                  carrierOrders
                };
              }
            }));

            // Proses hasil dari setiap kurir
            for (const result of carrierResults) {
              if (result.blob) {
                blobs.push(result.blob);
              }
              
              shopSuccess += result.successCount;
              shopFailed += result.failedCount;
              totalSuccess += result.successCount;
              totalFailed += result.failedCount;

              // Tambahkan failed orders ke daftar
              result.failedOrders.forEach(failedOrderSn => {
                const orderData = result.carrierOrders.find(o => o.order_sn === failedOrderSn);
                if (orderData) {
                  newFailedOrders.push({
                    orderSn: failedOrderSn,
                    shopName,
                    carrier: result.carrier,
                    trackingNumber: orderData.tracking_number || '-'
                  });
                }
              });

              // Update progress
              setDocumentBulkProgress(prev => ({
                ...prev,
                processed: prev.processed + result.carrierOrders.length
              }));
            }
          }

          // Tambahkan laporan untuk toko ini
          shopReports.push({
            shopName,
            success: shopSuccess,
            failed: shopFailed
          });

          // Gabungkan PDF untuk toko ini jika ada
          if (blobs.length > 0) {
            try {
              const mergedPDF = await mergePDFs(blobs);
              // Simpan blob untuk toko ini
              newShopBlobs.push({
                shopName,
                blob: mergedPDF
              });

              const pdfUrl = URL.createObjectURL(mergedPDF);
              
              const newWindow = window.open('', '_blank');
              if (newWindow) {
                newWindow.document.write(`
                  <!DOCTYPE html>
                  <html>
                    <head><title>${shopName}</title></head>
                    <body style="margin:0;padding:0;height:100vh;">
                      <embed src="${pdfUrl}" type="application/pdf" width="100%" height="100%">
                    </body>
                  </html>
                `);
                newWindow.document.close();
              }

              setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
            } catch (error) {
              console.error(`Error merging PDFs for shop ${shopName}:`, error);
              toast.error(`Gagal menggabungkan PDF untuk ${shopName}`);
            }
          }
        }));
      }

      // Update state shopBlobs dengan blob yang baru
      setShopBlobs(newShopBlobs);

      // Tampilkan laporan
      setPrintReport({
        totalSuccess,
        totalFailed,
        shopReports
      });
      setIsPrintReportOpen(true);

      if (newFailedOrders.length > 0) {
        setFailedOrders(newFailedOrders);
      }

    } catch (error) {
      console.error('Gagal mencetak dokumen:', error);
      toast.error('Gagal mencetak dokumen');
    } finally {
      setDocumentBulkProgress({
        processed: 0,
        total: 0,
        currentCarrier: '',
        currentShop: ''
      });
    }
  };

  // Tambahkan fungsi untuk membuka PDF yang tersimpan
  const openSavedPDF = (shopName: string) => {
    const shopBlob = shopBlobs.find(sb => sb.shopName === shopName);
    
    if (shopBlob) {
      const pdfUrl = URL.createObjectURL(shopBlob.blob);
      
      // Deteksi perangkat mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile) {
        // Untuk mobile, buat link download dengan nama file yang sesuai
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `${shopName.replace(/\s+/g, '_')}_shipping_labels.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Untuk desktop, tetap buka di tab baru
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>${shopName}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="margin:0;padding:0;height:100vh;">
                <embed src="${pdfUrl}" type="application/pdf" width="100%" height="100%">
                <div style="position:fixed;bottom:20px;right:20px;display:none;" class="mobile-download">
                  <a href="${pdfUrl}" download="${shopName.replace(/\s+/g, '_')}_shipping_labels.pdf" 
                     style="background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-family:system-ui;">
                    Download PDF
                  </a>
                </div>
              </body>
            </html>
          `);
          newWindow.document.close();
        }
      }

      // Bersihkan URL setelah beberapa detik
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 5000); // Perpanjang timeout untuk mobile
    } else {
      toast.error(`PDF untuk ${shopName} tidak tersedia, silakan download ulang`);
    }
  };

  // Update fungsi handleBulkPrint
  const handleBulkPrint = async (specificOrders?: OrderItem[]) => {
    const ordersToPrint = specificOrders || (
      tableState.selectedOrders.length > 0 
        ? orders.filter(order => tableState.selectedOrders.includes(order.order_sn))
        : orders.filter(order => derivedData.isOrderCheckable(order))
    );

    if (ordersToPrint.length === 0) {
      toast.info('Tidak ada dokumen yang dapat dicetak');
      return;
    }

    await processPrintingAndReport(ordersToPrint);
  };

  const checkboxRef = useRef<HTMLButtonElement>(null);

  // Update useEffect untuk menghandle indeterminate state
  useEffect(() => {
    const checkableOrders = filteredOrders.filter(order => derivedData.isOrderCheckable(order));
    const selectedCheckableOrders = tableState.selectedOrders.length;
    const allCheckableOrders = checkableOrders.length;
    
    if (checkboxRef.current) {
      const isIndeterminate = selectedCheckableOrders > 0 && selectedCheckableOrders < allCheckableOrders;
      (checkboxRef.current as any).indeterminate = isIndeterminate;
    }
  }, [tableState.selectedOrders, filteredOrders, derivedData.isOrderCheckable]);

  // Tambahkan state untuk OrderHistory
  const [isOrderHistoryOpen, setIsOrderHistoryOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string>('')

  // Tambahkan fungsi handler yang diperbarui
  const handleUsernameClick = (userId: number) => {
    console.log('Clicked userId:', userId);
    if (!userId) {
      console.warn('User ID tidak valid');
      return;
    }
    setSelectedUserId(userId.toString());
    setIsOrderHistoryOpen(true);
  }

  // Tambahkan useEffect untuk mengupdate title
  useEffect(() => {
    const readyToShipCount = orders.filter(order => order.order_status === 'READY_TO_SHIP').length;
    if (readyToShipCount > 0) {
      document.title = `(${readyToShipCount}) New Orders`;
    } else {
      document.title = 'Dashboard Pesanan';
    }

    // Cleanup function
    return () => {
      document.title = 'Dashboard Pesanan';
    };
  }, [orders]);

  // Tambahkan state untuk dialog konfirmasi print semua
  const [isPrintAllConfirmOpen, setIsPrintAllConfirmOpen] = useState(false);

  // Update fungsi handleBulkPrint untuk menampilkan konfirmasi terlebih dahulu
  const handleBulkPrintClick = useCallback(() => {
    // Jika ada order yang dipilih, gunakan itu
    // Jika tidak, gunakan semua order yang bisa dicetak
    const hasPrintableOrders = tableState.selectedOrders.length > 0 
      ? tableState.selectedOrders.length 
      : derivedData.printableOrders.length;

    if (hasPrintableOrders === 0) {
      toast.info('Tidak ada dokumen yang bisa dicetak');
      return;
    }

    setIsPrintAllConfirmOpen(true);
  }, [tableState.selectedOrders, derivedData.printableOrders]);

  // Fungsi untuk konfirmasi print semua
  const handleConfirmPrintAll = useCallback(async () => {
    setIsPrintAllConfirmOpen(false);
    
    // Jika ada order yang dipilih, gunakan itu
    // Jika tidak, gunakan semua order yang bisa dicetak
    const ordersToPrint = tableState.selectedOrders.length > 0 
      ? orders.filter(order => tableState.selectedOrders.includes(order.order_sn))
      : derivedData.printableOrders;

    if (ordersToPrint.length === 0) {
      toast.info('Tidak ada dokumen yang bisa dicetak');
      return;
    }

    await processPrintingAndReport(ordersToPrint);
  }, [tableState.selectedOrders, orders, derivedData.printableOrders, processPrintingAndReport]);

  // Update URL endpoint untuk memproses pesanan
  const handleProcessOrder = async (order: OrderItem) => {
    try {
      toast.promise(
        async () => {
          const response = await fetch('/api/process-order', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              shopId: order.shop_id,
              orderSn: order.order_sn
            })
          });

          const data = await response.json();
          
          if (!data.success) {
            throw new Error(data.message || 'Gagal memproses pesanan');
          }

          // Update local state jika berhasil
          if (onOrderUpdate) {
            onOrderUpdate(order.order_sn, {
              order_status: 'PROCESSED'
            });
          }

          return data;
        },
        {
          loading: 'Memproses pesanan...',
          success: 'Pesanan berhasil diproses',
          error: (err) => `${err.message}`
        }
      );
    } catch (error) {
      console.error('Gagal memproses pesanan:', error);
    }
  };

  // Tambahkan state untuk tracking progress bulk process
  const [bulkProcessProgress, setBulkProcessProgress] = useState<{
    processed: number;
    total: number;
    currentOrder: string;
  }>({
    processed: 0,
    total: 0,
    currentOrder: ''
  });

  // Tambahkan state untuk dialog konfirmasi
  const [isProcessAllConfirmOpen, setIsProcessAllConfirmOpen] = useState(false);

  

  // Fungsi untuk memproses semua pesanan
  const handleProcessAllOrders = useCallback(async () => {
    setIsProcessAllConfirmOpen(false);
    
    // Gunakan data dari derivedData untuk pesanan yang siap kirim
    const readyToShipOrders = orders.filter(order => order.order_status === 'READY_TO_SHIP');
    
    if (readyToShipOrders.length === 0) {
      toast.info('Tidak ada pesanan yang siap diproses');
      return;
    }

    try {
      // Set progress awal
      setBulkProcessProgress({
        processed: 0,
        total: readyToShipOrders.length,
        currentOrder: ''
      });

      // Proses satu per satu
      for (const order of readyToShipOrders) {
        setBulkProcessProgress(prev => ({
          ...prev,
          currentOrder: order.order_sn
        }));

        try {
          const response = await fetch('/api/process-order', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              shopId: order.shop_id,
              orderSn: order.order_sn
            })
          });

          const data = await response.json();
          
          if (!data.success) {
            console.error(`Gagal memproses pesanan ${order.order_sn}:`, data.message);
            toast.error(`Gagal memproses pesanan ${order.order_sn}`);
            continue;
          }

          // Update local state
          if (onOrderUpdate) {
            onOrderUpdate(order.order_sn, {
              order_status: 'PROCESSED'
            });
          }

          setBulkProcessProgress(prev => ({
            ...prev,
            processed: prev.processed + 1
          }));

          // Delay kecil antara setiap request
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          console.error(`Gagal memproses pesanan ${order.order_sn}:`, error);
          toast.error(`Gagal memproses pesanan ${order.order_sn}`);
        }
      }

      toast.success('Proses selesai');

    } catch (error) {
      console.error('Gagal memproses pesanan:', error);
      toast.error('Terjadi kesalahan saat memproses pesanan');
    } finally {
      // Reset progress setelah selesai
      setTimeout(() => {
        setBulkProcessProgress({
          processed: 0,
          total: 0,
          currentOrder: ''
        });
      }, 2000);
    }
  }, [orders]);

  // Tambahkan state untuk dialog konfirmasi reject all
  const [isRejectAllConfirmOpen, setIsRejectAllConfirmOpen] = useState(false);

  // Tambahkan state untuk tracking progress bulk reject
  const [bulkRejectProgress, setBulkRejectProgress] = useState<{
    processed: number;
    total: number;
    currentOrder: string;
  }>({
    processed: 0,
    total: 0,
    currentOrder: ''
  });

  // Tambahkan fungsi untuk menolak semua pembatalan
  const handleRejectAllCancellations = useCallback(async () => {
    setIsRejectAllConfirmOpen(false);
    
    // Gunakan data dari derivedData untuk pesanan dengan status IN_CANCEL
    const cancelOrders = orders.filter(order => order.order_status === 'IN_CANCEL');
    
    if (cancelOrders.length === 0) {
      toast.info('Tidak ada permintaan pembatalan');
      return;
    }

    try {
      // Set progress awal
      setBulkRejectProgress({
        processed: 0,
        total: cancelOrders.length,
        currentOrder: ''
      });

      // Proses satu per satu
      for (const order of cancelOrders) {
        setBulkRejectProgress(prev => ({
          ...prev,
          currentOrder: order.order_sn
        }));

        try {
          const response = await fetch('/api/handle-cancellation', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              shopId: order.shop_id,
              orderSn: order.order_sn,
              operation: 'REJECT'
            })
          });

          const result = await response.json();
          
          if (result.success) {
            if (onOrderUpdate) {
              onOrderUpdate(order.order_sn, {
                order_status: 'READY_TO_SHIP'
              });
            }
          } else {
            console.error(`Gagal menolak pembatalan ${order.order_sn}:`, result.message);
            toast.error(`Gagal menolak pembatalan ${order.order_sn}`);
          }

          setBulkRejectProgress(prev => ({
            ...prev,
            processed: prev.processed + 1
          }));

          // Delay kecil antara setiap request
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          console.error(`Gagal menolak pembatalan ${order.order_sn}:`, error);
          toast.error(`Gagal menolak pembatalan ${order.order_sn}`);
        }
      }

      toast.success('Proses penolakan pembatalan selesai');

    } catch (error) {
      console.error('Gagal menolak pembatalan:', error);
      toast.error('Terjadi kesalahan saat menolak pembatalan');
    } finally {
      // Reset progress setelah selesai
      setTimeout(() => {
        setBulkRejectProgress({
          processed: 0,
          total: 0,
          currentOrder: ''
        });
      }, 2000);
    }
  }, [orders]);

  // Tambahkan state yang diperlukan
  const [selectedOrderSn, setSelectedOrderSn] = useState<string>('');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isUnprintedConfirmOpen, setIsUnprintedConfirmOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<{
    orderSn: string;
    action: 'ACCEPT' | 'REJECT';
  }>({ orderSn: '', action: 'ACCEPT' });

  // 3. Gunakan CATEGORY_LIST untuk membuat categories dengan useMemo
  const categories = useMemo(() => CATEGORY_LIST, []);

  // Fungsi helper
  const isOrderCheckable = useCallback((order: OrderItem): boolean => {
    return derivedData.isOrderCheckable(order);
  }, [derivedData.isOrderCheckable]);

  // Update fungsi handleMobileCategoryChange
  const handleMobileCategoryChange = useCallback((value: string) => {
    handleCategoryChange(value);
  }, [handleCategoryChange]);

  // Fungsi untuk menangani print dokumen yang belum dicetak
  const handlePrintUnprinted = useCallback(async () => {
    if (derivedData.unprintedOrders.length === 0) {
      toast.info('Tidak ada dokumen yang belum dicetak');
      return;
    }

    setIsUnprintedConfirmOpen(true);
  }, [derivedData.unprintedOrders]);

  // Fungsi untuk konfirmasi print dokumen yang belum dicetak
  const handleConfirmUnprinted = useCallback(async () => {
    setIsUnprintedConfirmOpen(false);
    
    if (derivedData.unprintedOrders.length === 0) {
      toast.info('Tidak ada dokumen yang belum dicetak');
      return;
    }

    await processPrintingAndReport(derivedData.unprintedOrders);
  }, [derivedData.unprintedOrders, processPrintingAndReport]);

  // Fungsi untuk menangani aksi pembatalan
  const handleCancellationAction = useCallback(async (orderSn: string, action: 'ACCEPT' | 'REJECT') => {
    setSelectedAction({ orderSn, action });
    setIsConfirmOpen(true);
  }, []);

  // Update fungsi handleConfirmAction
  const handleConfirmAction = useCallback(async () => {
    setIsConfirmOpen(false);
    
    try {
      toast.promise(
        async () => {
          const response = await fetch('/api/handle-cancellation', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              shopId: orders.find(o => o.order_sn === selectedAction.orderSn)?.shop_id,
              orderSn: selectedAction.orderSn,
              operation: selectedAction.action
            })
          });

          const result = await response.json();
          
          if (!result.success) {
            throw new Error(result.message || 'Gagal memproses pembatalan');
          }

          // Update local state jika berhasil
          if (onOrderUpdate) {
            onOrderUpdate(selectedAction.orderSn, {
              order_status: selectedAction.action === 'ACCEPT' ? 'CANCELLED' : 'READY_TO_SHIP'
            });
          }

          return result;
        },
        {
          loading: 'Memproses pembatalan...',
          success: `Berhasil ${selectedAction.action === 'ACCEPT' ? 'menerima' : 'menolak'} pembatalan`,
          error: (err) => `${err.message}`
        }
      );
    } catch (error) {
      console.error('Gagal memproses pembatalan:', error);
    }
  }, [selectedAction, orders, onOrderUpdate]);

  // Tambahkan state untuk daftar toko
  const shops = useMemo(() => {
    return Array.from(new Set(orders.map(order => order.shop_name))).sort();
  }, [orders]);

  
  
  // Tambahkan state untuk dialog laporan
  const [isPrintReportOpen, setIsPrintReportOpen] = useState(false);
  const [printReport, setPrintReport] = useState<{
    totalSuccess: number;
    totalFailed: number;
    shopReports: {
      shopName: string;
      success: number;
      failed: number;
    }[];
  }>({
    totalSuccess: 0,
    totalFailed: 0,
    shopReports: []
  });

  // Tambahkan state untuk tracking proses sync
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    total: number;
    processed: number;
    currentShop: string;
  }>({
    total: 0,
    processed: 0,
    currentShop: ''
  });

  // Tambahkan state untuk dialog ringkasan
  const [isSyncSummaryOpen, setIsSyncSummaryOpen] = useState(false);
  const [syncSummary, setSyncSummary] = useState<{
    totalOrders: number;
    processedOrders: number;
    shopReports: {
      shopName: string;
      total: number;
      processed: number;
      failed: number;
    }[];
  }>({
    totalOrders: 0,
    processedOrders: 0,
    shopReports: []
  });

  // Update fungsi handleSyncOrders
  const handleSyncOrders = async () => {
    try {
      setIsSyncing(true);
      
      const ordersByShop = orders.reduce((acc, order) => {
        if (!acc[order.shop_id]) {
          acc[order.shop_id] = [];
        }
        acc[order.shop_id].push(order.order_sn);
        return acc;
      }, {} as { [key: number]: string[] });

      const totalOrders = orders.length;
      const shopReports: typeof syncSummary.shopReports = [];

      for (const [shopId, orderSns] of Object.entries(ordersByShop)) {
        const shopName = orders.find(o => o.shop_id === Number(shopId))?.shop_name || 'Unknown Shop';
        
        setSyncProgress(prev => ({
          ...prev,
          total: totalOrders,
          currentShop: shopName
        }));

        try {
          const response = await fetch('/api/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              shopId: Number(shopId),
              orderSns: orderSns
            })
          });

          const result = await response.json();

          if (!result.success) {
            throw new Error(result.error || 'Gagal sinkronisasi');
          }

          shopReports.push({
            shopName,
            total: result.data.total,
            processed: result.data.success,
            failed: result.data.failed
          });

          setSyncProgress(prev => ({
            ...prev,
            processed: prev.processed + result.data.success
          }));

        } catch (error) {
          console.error(`Error syncing ${shopName}:`, error);
          shopReports.push({
            shopName,
            total: orderSns.length,
            processed: 0,
            failed: orderSns.length
          });
        }
      }

      // Set ringkasan sinkronisasi
      const totalProcessed = shopReports.reduce((sum, report) => sum + report.processed, 0);
      const totalFailed = shopReports.reduce((sum, report) => sum + report.failed, 0);

      setSyncSummary({
        totalOrders,
        processedOrders: totalProcessed,
        shopReports
      });

      // Tampilkan dialog ringkasan
      setIsSyncSummaryOpen(true);

      if (totalProcessed > 0) {
        toast.success(`Berhasil mensinkronkan ${totalProcessed} pesanan`);
      }
      if (totalFailed > 0) {
        toast.error(`Gagal mensinkronkan ${totalFailed} pesanan`);
      }

    } catch (error) {
      console.error('Error syncing orders:', error);
      toast.error('Gagal melakukan sinkronisasi');
    } finally {
      setIsSyncing(false);
      setSyncProgress({
        total: 0,
        processed: 0,
        currentShop: ''
      });
    }
  };

  const handleCourierFilter = useCallback((courier: string) => {
    setTableState(prev => ({
      ...prev,
      selectedCouriers: prev.selectedCouriers.includes(courier)
        ? prev.selectedCouriers.filter(c => c !== courier)
        : [...prev.selectedCouriers, courier]
    }));
  }, []);

  const handlePrintStatusFilter = useCallback((status: 'all' | 'printed' | 'unprinted') => {
    setTableState(prev => ({
      ...prev,
      printStatus: status
    }));
  }, []);

  const handlePaymentTypeFilter = useCallback((type: 'all' | 'cod' | 'non_cod') => {
    setTableState(prev => ({
      ...prev,
      paymentType: type
    }));
  }, []);

  const handleResetFilter = useCallback(() => {
    setTableState(prev => ({
      ...prev,
      selectedShops: [],
      printStatus: 'all',
      selectedCouriers: [],
      paymentType: 'all'
    }));
  }, []);

  // Tambahkan state untuk dialog konfirmasi terima semua
  const [isAcceptAllConfirmOpen, setIsAcceptAllConfirmOpen] = useState(false);

  // Tambahkan state untuk tracking progress bulk accept
  const [bulkAcceptProgress, setBulkAcceptProgress] = useState<{
    processed: number;
    total: number;
    currentOrder: string;
  }>({
    processed: 0,
    total: 0,
    currentOrder: ''
  });

  // Tambahkan fungsi untuk menerima semua pembatalan
  const handleAcceptAllCancellations = useCallback(async () => {
    setIsAcceptAllConfirmOpen(false);
    
    // Filter pesanan dengan status IN_CANCEL dan belum dicetak
    const cancelOrders = orders.filter(order => 
      order.order_status === 'IN_CANCEL' && !order.is_printed
    );
    
    if (cancelOrders.length === 0) {
      toast.info('Tidak ada permintaan pembatalan yang memenuhi syarat');
      return;
    }

    try {
      // Set progress awal
      setBulkAcceptProgress({
        processed: 0,
        total: cancelOrders.length,
        currentOrder: ''
      });

      // Proses satu per satu
      for (const order of cancelOrders) {
        setBulkAcceptProgress(prev => ({
          ...prev,
          currentOrder: order.order_sn
        }));

        try {
          const response = await fetch('/api/handle-cancellation', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              shopId: order.shop_id,
              orderSn: order.order_sn,
              operation: 'ACCEPT'
            })
          });

          const result = await response.json();
          
          if (result.success) {
            if (onOrderUpdate) {
              onOrderUpdate(order.order_sn, {
                order_status: 'CANCELLED'
              });
            }
          } else {
            console.error(`Gagal menerima pembatalan ${order.order_sn}:`, result.message);
            toast.error(`Gagal menerima pembatalan ${order.order_sn}`);
          }

          setBulkAcceptProgress(prev => ({
            ...prev,
            processed: prev.processed + 1
          }));

          // Delay kecil antara setiap request
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          console.error(`Gagal menerima pembatalan ${order.order_sn}:`, error);
          toast.error(`Gagal menerima pembatalan ${order.order_sn}`);
        }
      }

      toast.success('Proses penerimaan pembatalan selesai');

    } catch (error) {
      console.error('Gagal menerima pembatalan:', error);
      toast.error('Terjadi kesalahan saat menerima pembatalan');
    } finally {
      // Reset progress setelah selesai
      setTimeout(() => {
        setBulkAcceptProgress({
          processed: 0,
          total: 0,
          currentOrder: ''
        });
      }, 2000);
    }
  }, [orders, onOrderUpdate]);

  // Menghitung jumlah pesanan yang memenuhi syarat untuk diterima pembatalannya
  const eligibleForAccept = useMemo(() => {
    return orders.filter(order => 
      order.order_status === 'IN_CANCEL' && !order.is_printed
    ).length;
  }, [orders]);

  // Tempatkan komponen progress bar di atas tabel, kemungkinan di sekitar area filter/search
  // Biasanya ini berada di bagian awal fungsi return dari komponen OrdersDetailTable

  // Misalnya, setelah header/filter dan sebelum tabel:
      {/* Header dan filter tetap di tempatnya */}
      
      
      
      {/* Tabel */}
      
  return (
    
    <div className="w-full">
      {bulkAcceptProgress.total > 0 && (
        <div className="mt-2 mb-2 p-2 bg-white dark:bg-gray-800 border rounded-lg shadow-sm">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-green-500 animate-pulse" />
                <span className="font-medium dark:text-white">
                  Menerima Pembatalan: {bulkAcceptProgress.currentOrder}
                </span>
              </div>
              <span className="text-gray-600 dark:text-gray-400">
                {bulkAcceptProgress.processed}/{bulkAcceptProgress.total}
              </span>
            </div>
            <Progress 
              value={(bulkAcceptProgress.processed / bulkAcceptProgress.total) * 100} 
              className="h-1"
            />
          </div>
        </div>
      )}
      {/* Progress bar sinkronisasi */}
      {isSyncing && (
        <div className="mt-2 mb-2 p-2 bg-white dark:bg-gray-800 border rounded-lg shadow-sm">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <RefreshCcw size={14} className="text-primary dark:text-white animate-spin" />
                <span className="font-medium dark:text-white">
                  {syncProgress.currentShop}
                </span>
              </div>
              <span className="text-gray-600 dark:text-gray-400">
                {syncProgress.processed}/{syncProgress.total}
              </span>
            </div>
            <Progress 
              value={(syncProgress.processed / syncProgress.total) * 100} 
              className="h-1"
            />
          </div>
        </div>
      )}
      {documentBulkProgress.total > 0 && (
        <div className="mt-2 mb-2 p-2 bg-white dark:bg-gray-800 border rounded-lg shadow-sm">
          <div className="flex flex-col gap-1.5">
            {/* Progress Info - Single Line */}
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Printer size={14} className="text-primary dark:text-white animate-pulse" />
                <span className="font-medium dark:text-white">
                  {documentBulkProgress.currentShop}
                  {documentBulkProgress.currentCarrier && 
                    <span className="text-gray-500 dark:text-gray-400">
                      {' • '}{documentBulkProgress.currentCarrier}
                    </span>
                  }
                </span>
              </div>
              <span className="text-gray-600 dark:text-gray-400">
                {documentBulkProgress.processed}/{documentBulkProgress.total}
              </span>
            </div>

            {/* Progress Bar */}
            <Progress 
              value={(documentBulkProgress.processed / documentBulkProgress.total) * 100} 
              className="h-1"
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 w-full mt-2">
        {/* Card Kategori, Pencarian, dan Filter */}
        <Card className="px-2 py-2 shadow-none rounded-lg">
          {/* Mobile Layout */}
          <div className="flex flex-col gap-2 sm:hidden">
            <MobileSelect 
              activeCategory={tableState.activeCategory}
              categories={derivedData.updatedCategories}
              onCategoryChange={handleMobileCategoryChange}
            />
            {/* Baris Pencarian dengan Filter Toko dan Checkbox */}
            <div className="flex items-center gap-2">
              {/* Tombol Toggle Checkbox untuk Mobile */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleCheckbox}
                className={`h-8 w-8 p-0 ${tableState.showCheckbox ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
              >
                <CheckSquare size={14} />
              </Button>

              {/* Input Pencarian untuk Mobile */}
              <div className="relative flex-1 min-w-[200px]">
                <Input
                  type="text"
                  placeholder="Cari username, kurir, atau no. pesanan"
                  value={tableState.searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="h-8 text-xs pl-8 pr-8"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  data-form-type="other"
                  name="search-input"
                />
                <Search size={16} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
              </div>

              {/* Tombol Filter untuk Mobile */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                    <Filter size={14} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-72" 
                  align="end"
                  side="bottom"
                  sideOffset={5}
                  style={{
                    maxHeight: 'calc(80vh - 190px)',
                    overflowY: 'auto'
                  }}
                >
                  <div className="p-1">
                    <FilterContent 
                      tableState={tableState}
                      setTableState={setTableState}
                      shops={derivedData.shops}
                      availableCouriers={derivedData.availableCouriers}
                      onShopFilter={handleShopFilter}
                      onCourierFilter={handleCourierFilter}
                      onPrintStatusFilter={handlePrintStatusFilter}
                      onPaymentTypeFilter={handlePaymentTypeFilter}
                      onResetFilter={handleResetFilter}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden sm:flex items-center gap-2">
            {/* Tombol Toggle Checkbox - Kiri */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleCheckbox}
              className={`h-8 ${tableState.showCheckbox ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
            >
              <CheckSquare size={14} />
              {tableState.showCheckbox}
            </Button>

            {/* Kategori - Tengah */}
            <div className="flex gap-2 flex-1">
              {derivedData.updatedCategories.map((category) => (
                <Button
                  key={category.name}
                  onClick={() => handleCategoryChange(category.name)}
                  variant={tableState.activeCategory === category.name ? "default" : "outline"}
                  size="sm"
                  className={`h-8 px-3 text-xs whitespace-nowrap
                    ${tableState.activeCategory === category.name
                      ? 'bg-primary hover:bg-primary/90 text-white dark:bg-primary-foreground'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                >
                  {category.name} ({category.count})
                </Button>
              ))}
            </div>

            {/* Pencarian dan Filter - Kanan */}
            <div className="flex items-center gap-2">
              <div className="relative w-[300px]">
                <Input
                  type="text"
                  placeholder="Cari username pesanan atau no resi..."
                  value={searchInput}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  className="h-8 text-xs pl-8 pr-8"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  data-form-type="other"
                  name="search-input-desktop"
                />
                <Search size={16} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                
                {/* Tombol X untuk clear input */}
                {searchInput && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Hapus pencarian"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <Filter size={14}/>
                   
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-80" 
                  align="end" 
                  alignOffset={-10} 
                  sideOffset={5}
                >
                  <FilterContent 
                    tableState={tableState}
                    setTableState={setTableState}
                    shops={derivedData.shops}
                    availableCouriers={derivedData.availableCouriers}
                    onShopFilter={handleShopFilter}
                    onCourierFilter={handleCourierFilter}
                    onPrintStatusFilter={handlePrintStatusFilter}
                    onPaymentTypeFilter={handlePaymentTypeFilter}
                    onResetFilter={handleResetFilter}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </Card>

        {/* Card Tombol */}
        <Card className="px-2 py-2 shadow-none rounded-lg">
          <div className="flex justify-between">
            {/* Grup Tombol Pesanan - Sebelah Kiri */}
            <div className="flex gap-2">
              {/* Tombol Proses Semua dengan warna primary */}
              <Button
                onClick={() => setIsProcessAllConfirmOpen(true)}
                className="px-2 sm:px-3 py-0 h-[32px] text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground dark:text-primary-foreground whitespace-nowrap flex items-center"
                disabled={derivedData.readyToShipCount === 0}
              >
                <Send size={14} className="sm:mr-1.5" />
                <span className="hidden sm:inline mr-1">
                  Proses Semua
                </span>
                {derivedData.readyToShipCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary-foreground/20 text-primary-foreground text-[10px] font-medium">
                    {derivedData.readyToShipCount}
                  </span>
                )}
              </Button>

              {/* Dropdown Pembatalan tetap menggunakan DropdownMenu yang lebih modern */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="px-2 sm:px-3 py-0 h-[32px] text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground dark:text-primary-foreground whitespace-nowrap flex items-center"
                    disabled={derivedData.cancelRequestCount === 0}
                  >
                    <XCircle size={14} className="sm:mr-1.5" />
                    <span className="hidden sm:inline mr-1">
                      Pembatalan
                    </span>
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary-foreground/20 text-primary-foreground text-[10px] font-medium">
                      {derivedData.cancelRequestCount}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  className="w-56" 
                  align="start" 
                  alignOffset={5}
                  sideOffset={5}
                >
                  <DropdownMenuItem 
                    className="flex items-center cursor-pointer"
                    onClick={() => setIsAcceptAllConfirmOpen(true)}
                    disabled={eligibleForAccept === 0}
                  >
                    <CheckCircle size={14} className="mr-2 text-green-500" />
                    <span className="flex-1">Terima Semua</span>
                    <span className="ml-auto px-1.5 py-0.5 rounded-full bg-green-100 text-green-800 text-[10px] font-medium dark:bg-green-800/30 dark:text-green-400">
                      {eligibleForAccept}
                    </span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem 
                    className="flex items-center cursor-pointer"
                    onClick={() => setIsRejectAllConfirmOpen(true)}
                    disabled={derivedData.cancelRequestCount === 0}
                  >
                    <XCircle size={14} className="mr-2 text-red-500" />
                    <span className="flex-1">Tolak Semua</span>
                    <span className="ml-auto px-1.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-medium dark:bg-red-800/30 dark:text-red-400">
                      {derivedData.cancelRequestCount}
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Tombol Sinkronkan dengan warna primary */}
              <Button
                onClick={handleSyncOrders}
                disabled={isSyncing}
                className="px-2 sm:px-3 py-0 h-[32px] text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground dark:text-primary-foreground whitespace-nowrap flex items-center"
              >
                <RefreshCcw size={14} className={`sm:mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">
                  {isSyncing ? 'Sinkronisasi...' : 'Sinkronkan'}
                </span>
              </Button>
            </div>

            {/* Grup Tombol Cetak - Sebelah Kanan */}
            <div className="flex gap-2">
              <Button
                onClick={handlePrintUnprinted}
                className="px-2 sm:px-3 py-2 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground dark:text-primary-foreground whitespace-nowrap h-[32px] min-h-0"
                disabled={derivedData.unprintedCount === 0}
                title="Cetak Dokumen Belum Print"
              >
                <Printer size={14} className="sm:mr-1" />
                <span className="hidden sm:inline">
                  Belum Print
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary-foreground/20 text-primary-foreground text-[10px] font-medium">
                    {derivedData.unprintedCount}
                  </span>
                </span>
                <span className="sm:hidden">
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary-foreground/20 text-primary-foreground text-[10px] font-medium">
                    {derivedData.unprintedCount}
                  </span>
                </span>
              </Button>
              <Button
                onClick={handleBulkPrintClick}
                className="px-2 sm:px-3 py-2 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground dark:text-primary-foreground whitespace-nowrap h-[32px] min-h-0"
                title={tableState.selectedOrders.length > 0 
                  ? `Cetak ${tableState.selectedOrders.length} Dokumen`
                  : `Cetak Semua (${derivedData.totalPrintableDocuments})`
                }
              >
                <PrinterCheck size={14} className="sm:mr-1" />
                <span className="hidden sm:inline">
                  {tableState.selectedOrders.length > 0 
                    ? `Cetak ${tableState.selectedOrders.length} Dokumen`
                    : `Cetak Semua`
                  }
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary-foreground/20 text-primary-foreground text-[10px] font-medium">
                    {tableState.selectedOrders.length || derivedData.totalPrintableDocuments}
                  </span>
                </span>
                <span className="sm:hidden">
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary-foreground/20 text-primary-foreground text-[10px] font-medium">
                    {tableState.selectedOrders.length || derivedData.totalPrintableDocuments}
                  </span>
                </span>
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div className="rounded-md border overflow-x-auto mt-2">
        <Table className="w-full dark:bg-gray-900">
          <TableHeader>
            <TableRow className="dark:border-gray-700">
              {/* Update tampilan checkbox header */}
              <TableHead className={`w-10 p-1 h-[32px] align-middle ${!tableState.showCheckbox && 'hidden'}`}>
                <div className="flex justify-center">
                  <Checkbox
                    ref={checkboxRef}
                    checked={
                      filteredOrders.filter(order => derivedData.isOrderCheckable(order)).length > 0 && 
                      filteredOrders
                        .filter(order => derivedData.isOrderCheckable(order))
                        .every(order => tableState.selectedOrders.includes(order.order_sn))
                    }
                    onCheckedChange={handleSelectAll}
                    className="h-4 w-4"
                  />
                </div>
              </TableHead>
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
              <TableHead className="font-bold uppercase text-xs text-black dark:text-white whitespace-nowrap w-[100px] text-center">Cetak</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Skeleton loader untuk baris-baris tabel saat loading
              [...Array(5)].map((_, index) => (
                <TableRow 
                  key={`skeleton-${index}`} 
                  className={`${index % 2 === 0 ? 'bg-muted dark:bg-gray-800/50' : 'bg-gray-100/20 dark:bg-gray-900'}`}
                >
                  {/* Sel pertama (checkbox) */}
                  <TableCell className={`p-1 h-[32px] align-middle ${!tableState.showCheckbox && 'hidden'}`}>
                    <div className="flex justify-center">
                      <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    </div>
                  </TableCell>
                  
                  {/* Nomor urut */}
                  <TableCell className="p-1 h-[32px] text-xs">
                    <div className="h-3 w-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto" />
                  </TableCell>
                  
                  {/* Nama toko */}
                  <TableCell className="p-1 h-[32px] text-xs">
                    <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </TableCell>
                  
                  {/* Tanggal */}
                  <TableCell className="p-1 h-[32px] text-xs">
                    <div className="h-3 w-14 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </TableCell>
                  
                  {/* Nomor pesanan */}
                  <TableCell className="p-1 h-[32px] text-xs">
                    <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </TableCell>
                  
                  {/* Username */}
                  <TableCell className="p-1 h-[32px] text-xs">
                    <div className="flex">
                      <div className="h-3 w-4 mr-2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    </div>
                  </TableCell>
                  
                  {/* Harga */}
                  <TableCell className="p-1 h-[32px] text-xs">
                    <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </TableCell>
                  
                  {/* Escrow */}
                  <TableCell className="p-1 h-[32px] text-xs">
                    <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </TableCell>
                  
                  {/* SKU/Qty */}
                  <TableCell className="p-1 h-[32px] text-xs">
                    <div className="h-3 w-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </TableCell>
                  
                  {/* Kurir */}
                  <TableCell className="p-1 h-[32px] text-xs">
                    <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </TableCell>
                  
                  {/* Status */}
                  <TableCell className="p-1 h-[32px] text-xs">
                    <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </TableCell>
                  
                  {/* Tombol cetak */}
                  <TableCell className="text-center p-1 h-[32px]">
                    <div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse mx-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              // Konten tabel asli saat tidak loading
              filteredOrders.length > 0 ? (
                filteredOrders.map((order: OrderItem, index: number) => (
                  <TableRow 
                    key={`${order.order_sn}`} 
                    className={`
                      ${order.order_status === "IN_CANCEL" 
                        ? 'bg-red-100 dark:bg-red-900/50' 
                        : order.order_status === "CANCELLED"
                          ? 'bg-gray-300 dark:bg-gray-800' 
                          : index % 2 === 0 
                            ? 'bg-muted dark:bg-gray-800/50' 
                            : 'bg-gray-100/20 dark:bg-gray-900'
                      }
                      hover:bg-primary/10 dark:hover:bg-primary/20 hover:shadow-sm transition-colors
                    `}
                  >
                    <TableCell className={`p-1 h-[32px] align-middle ${!tableState.showCheckbox && 'hidden'}`}>
                      <div className="flex justify-center">
                        <Checkbox
                          checked={tableState.selectedOrders.includes(order.order_sn)}
                          disabled={!derivedData.isOrderCheckable(order)}
                          onCheckedChange={(checked) => 
                            handleSelectOrder(order.order_sn, checked as boolean)
                          }
                          className="h-4 w-4"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white text-center whitespace-nowrap">{index + 1}</TableCell>
                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap max-w-[80px] sm:max-w-none overflow-hidden text-ellipsis">{order.shop_name}</TableCell>
                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">{formatDate(order.pay_time)}</TableCell>
                    <TableCell 
                      className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap cursor-pointer hover:text-primary"
                      onClick={() => {
                        setSelectedOrderSn(order.order_sn)
                        setIsDetailOpen(true)
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 flex justify-center">
                          {/* Jika perlu menampilkan ikon untuk READY_TO_SHIP dan days_to_ship > 0, tambahkan kondisi di sini */}
                          {(order.order_status === 'PROCESSED' || order.order_status === 'IN_CANCEL') && order.ship_by_date && (
                            <>
                              {order.ship_by_date && isOverdue(order.ship_by_date) && (
                                <span title="Pesanan melewati batas waktu pengiriman">
                                  <AlertTriangle size={14} className="text-red-500" />
                                </span>
                              )}
                              {order.ship_by_date && isToday(order.ship_by_date) && !isOverdue(order.ship_by_date) && (
                                <span title="Batas pengiriman hari ini">
                                  <AlertCircle size={14} className="text-amber-500" />
                                </span>
                              )}
                            </>
                          )}
                          {/* Jangan menampilkan apapun di sini jika tidak ada ikon yang perlu ditampilkan */}
                        </div>
                        <span>{order.order_sn}</span>
                        {order.cod && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-600 text-white dark:bg-red-500">
                            COD
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-6 flex justify-center">
                          {order.buyer_username && derivedData.usernameCounts[order.buyer_username] > 1 && (
                            <span 
                              className="inline-flex items-center justify-center w-4 h-4 bg-blue-100 text-blue-800 text-[10px] font-medium rounded-full dark:bg-blue-900 dark:text-blue-300"
                              title={`Pembeli ini memiliki ${derivedData.usernameCounts[order.buyer_username]} pesanan`}
                            >
                              {derivedData.usernameCounts[order.buyer_username]}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center">
                          <button
                            onClick={() => handleUsernameClick(order.buyer_user_id)}
                            className="hover:text-primary mr-2"
                          >
                            {order.buyer_username}
                          </button>
                          
                          {/* Tombol Chat dengan ikon saja */}
                          <ChatButton
                            shopId={order.shop_id}
                            toId={order.buyer_user_id}
                            toName={order.buyer_username || "Pembeli"}
                            toAvatar={order.buyer_avatar || ""} 
                            shopName={order.shop_name}
                            iconSize={14}
                            iconOnly={true}
                            orderId={order.order_sn}
                            orderStatus={order.order_status} // Tambahkan orderStatus
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">
                      Rp {(order.total_amount || 0).toLocaleString('id-ID')}
                    </TableCell>
                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">
                      Rp {(order.escrow_amount_after_adjustment || 0).toLocaleString('id-ID')}
                    </TableCell>
                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">{order.sku_qty || '-'}</TableCell>
                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">
                      {order.shipping_carrier || '-'} ({order.tracking_number || '-'})
                    </TableCell>
                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">
                      <StatusBadge 
                        status={order.order_status as OrderStatus} 
                        order={order}
                        onProcess={handleProcessOrder}
                        onCancellationAction={handleCancellationAction}
                      />
                    </TableCell>
                    <TableCell className="text-center p-1 h-[32px]">
                      <Button
                        onClick={() => handleDownloadDocument(order)}
                        disabled={isLoadingForOrder(order.order_sn) || order.document_status !== 'READY'}
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 p-0"
                      >
                        {isLoadingForOrder(order.order_sn) ? (
                          <RefreshCcw size={12} className="animate-spin" />
                        ) : order.is_printed ? (
                          <PrinterCheck size={12} className="text-green-500 hover:text-green-600" />
                        ) : (
                          <Printer size={12} className="text-primary hover:text-primary/80" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-4 dark:text-gray-400">
                    Tidak ada data untuk ditampilkan
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      </div>
      
      <OrderDetails 
        orderSn={selectedOrderSn}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">
              Konfirmasi Pembatalan
            </AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-300">
              Apakah Anda yakin ingin {selectedAction.action === 'ACCEPT' ? 'menerima' : 'menolak'} pembatalan untuk pesanan ini?
              {selectedAction.action === 'ACCEPT' 
                ? ' Pesanan akan dibatalkan.'
                : ' Pembeli tidak akan dapat mengajukan pembatalan lagi.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 dark:border-gray-600">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmAction}
              className={`text-white ${
                selectedAction.action === 'ACCEPT' 
                  ? 'bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800' 
                  : 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800'
              }`}
            >
              {selectedAction.action === 'ACCEPT' ? 'Terima Pembatalan' : 'Tolak Pembatalan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isUnprintedConfirmOpen} onOpenChange={setIsUnprintedConfirmOpen}>
        <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">
              Konfirmasi Cetak Dokumen Belum Print
            </AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-300">
              Anda akan mencetak {derivedData.unprintedCount} dokumen yang belum pernah dicetak sebelumnya. 
              Setelah dicetak, dokumen akan ditandai sebagai sudah dicetak. Lanjutkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 dark:border-gray-600">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmUnprinted}
              className="bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
            >
              Cetak Dokumen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isPrintAllConfirmOpen} onOpenChange={setIsPrintAllConfirmOpen}>
        <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">
              Konfirmasi Cetak Dokumen
            </AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-300">
              Anda akan mencetak {tableState.selectedOrders.length > 0 
                ? tableState.selectedOrders.length 
                : derivedData.totalPrintableDocuments} dokumen yang siap cetak. Lanjutkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 dark:border-gray-600">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmPrintAll}
              className="bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
            >
              Cetak Dokumen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OrderHistory 
        userId={selectedUserId}
        isOpen={isOrderHistoryOpen}
        onClose={() => setIsOrderHistoryOpen(false)}
      />

      {/* Tambahkan Dialog Konfirmasi */}
      <AlertDialog open={isProcessAllConfirmOpen} onOpenChange={setIsProcessAllConfirmOpen}>
        <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">
              Konfirmasi Proses Pesanan
            </AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-300">
              Anda akan memproses {derivedData.readyToShipCount} pesanan yang siap kirim. 
              Proses ini tidak dapat dibatalkan. Lanjutkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 dark:border-gray-600">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setIsProcessAllConfirmOpen(false);
                handleProcessAllOrders();
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-800"
            >
              Proses Semua
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-white/20 text-white dark:bg-white/20 dark:text-white text-[10px] font-medium">
                {derivedData.readyToShipCount}
              </span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tambahkan Dialog Konfirmasi Reject All */}
      <AlertDialog open={isRejectAllConfirmOpen} onOpenChange={setIsRejectAllConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <span>Tolak Semua Pembatalan</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Anda akan menolak {derivedData.cancelRequestCount} permintaan pembatalan pesanan.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-md p-2 text-blue-800 text-xs dark:bg-blue-900/30 dark:border-blue-800/30 dark:text-blue-300">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>Pembeli tidak akan dapat mengajukan pembatalan lagi untuk pesanan-pesanan ini.</p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="mt-0">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRejectAllCancellations}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Tolak Semua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Laporan Pencetakan */}
      <AlertDialog open={isPrintReportOpen} onOpenChange={setIsPrintReportOpen}>
        <AlertDialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col dark:bg-gray-800 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">
              Laporan Hasil Pencetakan
            </AlertDialogTitle>
            
            {/* Tambahkan div dengan overflow-y-auto untuk area yang bisa di-scroll */}
            <AlertDialogDescription className="dark:text-gray-300 overflow-y-auto">
              <div className="space-y-4 pr-2"> {/* Tambahkan padding-right untuk jarak dari scrollbar */}
                {/* Statistik tetap di atas dan tidak ikut scroll */}
                <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 pt-4 pb-2">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <div className="text-xl font-bold text-green-700 dark:text-green-400">
                        {printReport.totalSuccess}
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-300">
                        Berhasil
                      </div>
                    </div>
                    <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                      <div className="text-xl font-bold text-red-700 dark:text-red-400">
                        {printReport.totalFailed}
                      </div>
                      <div className="text-xs text-red-600 dark:text-red-300">
                        Gagal
                      </div>
                    </div>
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <div className="text-xl font-bold text-blue-700 dark:text-blue-400">
                        {printReport.totalSuccess + printReport.totalFailed}
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-300">
                        Total
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detail per Toko dalam container yang bisa di-scroll */}
                <div className="mt-4">
                  <h4 className="font-medium mb-2 dark:text-white sticky top-[100px] bg-white dark:bg-gray-800 py-2 z-10">
                    Detail per Toko ({printReport.shopReports.length}):
                  </h4>
                  
                  {/* Tambahkan container dengan fixed height dan scroll */}
                  <div className="max-h-[400px] overflow-y-auto pr-2"> {/* Tambah padding-right untuk jarak dari scrollbar */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {printReport.shopReports.map((report, index) => (
                        <div 
                          key={index}
                          className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700"
                        >
                          <div className="flex justify-between items-center">
                            <div className="font-medium text-sm dark:text-white truncate flex-1 mr-2">
                              {report.shopName}
                            </div>
                            <Button
                              onClick={() => {
                                // Cek apakah ada blob tersimpan
                                if (shopBlobs.some(sb => sb.shopName === report.shopName)) {
                                  openSavedPDF(report.shopName);
                                } else {
                                  // Jika tidak ada, download ulang
                                  const shopOrders = orders.filter(order => 
                                    order.shop_name === report.shopName && 
                                    derivedData.isOrderCheckable(order)
                                  );
                                  handleBulkPrint(shopOrders);
                                }
                              }}
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                              title={`${shopBlobs.some(sb => sb.shopName === report.shopName) 
                                ? 'Buka PDF tersimpan' 
                                : 'Download ulang dokumen'} ${report.shopName}`}
                            >
                              <Download size={14} className="text-gray-600 dark:text-gray-400" />
                            </Button>
                          </div>
                          <div className="text-xs mt-2 space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600 dark:text-gray-400">Berhasil:</span>
                              <span className="text-green-600 dark:text-green-400 font-medium">
                                {report.success}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600 dark:text-gray-400">Gagal:</span>
                              <span className="text-red-600 dark:text-red-400 font-medium">
                                {report.failed}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600 dark:text-gray-400">Total:</span>
                              <span className="text-blue-600 dark:text-blue-400 font-medium">
                                {report.success + report.failed}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Daftar Pesanan Gagal */}
                {failedOrders.length > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium dark:text-white">
                        Daftar Pesanan Gagal ({failedOrders.length}):
                      </h4>
                      <Button
                        onClick={() => {
                          const failedOrdersData = orders.filter(order => 
                            failedOrders.some(failed => failed.orderSn === order.order_sn)
                          );
                          handleBulkPrint(failedOrdersData);
                        }}
                        size="sm"
                        className="h-7 bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800"
                      >
                        <Printer size={14} className="mr-1" />
                        Cetak Ulang
                      </Button>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow className="dark:border-gray-700">
                            <TableHead className="font-bold text-xs dark:text-white w-[300px]">No. Pesanan</TableHead>
                            <TableHead className="font-bold text-xs dark:text-white w-[300px]">Toko</TableHead>
                            <TableHead className="font-bold text-xs dark:text-white w-[200px]">Kurir</TableHead>
                            <TableHead className="font-bold text-xs dark:text-white w-[60px] text-center">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {failedOrders.map((order, index) => {
                            const orderData = orders.find(o => o.order_sn === order.orderSn);
                            return (
                              <TableRow key={order.orderSn} className="dark:border-gray-700">
                                <TableCell className="text-xs dark:text-gray-300 py-2">
                                  <div className="flex items-center gap-1">
                                    <span className="truncate">{order.orderSn}</span>
                                    {orderData?.cod && (
                                      <span className="px-1 py-0.5 rounded text-[10px] font-medium bg-red-600 text-white dark:bg-red-500 shrink-0">
                                        COD
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs dark:text-gray-300 py-2">
                                  <span className="truncate block">{order.shopName}</span>
                                </TableCell>
                                <TableCell className="text-xs dark:text-gray-300 py-2">
                                  <span className="text-gray-500 dark:text-gray-400">
                                    {order.carrier}
                                  </span>
                                </TableCell>
                                <TableCell className="text-center py-2">
                                  {orderData && (
                                    <Button
                                      onClick={() => handleDownloadDocument(orderData)}
                                      disabled={isLoadingForOrder(order.orderSn)}
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 hover:text-primary dark:hover:text-primary"
                                    >
                                      {isLoadingForOrder(order.orderSn) ? (
                                        <RefreshCcw size={12} className="animate-spin" />
                                      ) : (
                                        <Printer size={12} />
                                      )}
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-t dark:border-gray-700">
            <AlertDialogAction 
              onClick={() => {
                setIsPrintReportOpen(false);
                setFailedOrders([]);
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
            >
              Tutup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isSyncSummaryOpen} onOpenChange={setIsSyncSummaryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader className="px-6 py-4 border-b dark:border-gray-700">
            <DialogTitle className="dark:text-white">Ringkasan Sinkronisasi</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Statistik Utama */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {syncSummary.totalOrders}
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-400">
                  Total Pesanan
                </div>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                <div className="text-xl font-bold text-green-600 dark:text-green-400">
                  {syncSummary.processedOrders}
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">
                  Berhasil
                </div>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
                <div className="text-xl font-bold text-red-600 dark:text-red-400">
                  {syncSummary.totalOrders - syncSummary.processedOrders}
                </div>
                <div className="text-sm text-red-600 dark:text-red-400">
                  Gagal
                </div>
              </div>
            </div>

            {/* Detail per Toko */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                Detail per Toko
              </h3>
              <div className="space-y-2">
                {syncSummary.shopReports.map((report, index) => (
                  <div 
                    key={index}
                    className="p-3 border rounded-lg dark:border-gray-700 bg-white dark:bg-gray-800"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm dark:text-white">
                        {report.shopName}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Total: {report.total}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-green-500">●</span>
                        <span className="text-gray-600 dark:text-gray-300">
                          Berhasil: {report.processed}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-red-500">●</span>
                        <span className="text-gray-600 dark:text-gray-300">
                          Gagal: {report.failed}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tambahkan dialog konfirmasi untuk menerima semua */}
      <AlertDialog open={isAcceptAllConfirmOpen} onOpenChange={setIsAcceptAllConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span>Terima Semua Pembatalan</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Anda akan menerima {eligibleForAccept} permintaan pembatalan pesanan yang belum dicetak.
              </p>
              
              <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-amber-800 text-xs dark:bg-amber-900/30 dark:border-amber-800/30 dark:text-amber-300">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>Pesanan-pesanan ini akan dibatalkan secara permanen dan tidak dapat dikembalikan.</p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="mt-0">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleAcceptAllCancellations}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Terima Semua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tambahkan progress bar untuk bulk accept jika sedang berjalan */}
      
    </div>
  );
}