import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Order } from '@/app/hooks/useDashboard'

import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// Impor ikon-ikon yang diperlukan
import { Package, Clock, Truck, XCircle, AlertCircle, RefreshCcw, Search, Filter, Printer, PrinterCheck, CheckSquare, CheckCircle, Send, MessageSquare, Download, Info, X, AlertTriangle } from 'lucide-react'
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { OrderDetails } from './OrderDetails'
import { useShippingDocument } from '@/app/hooks/useShippingDocument';
import { Button } from "@/components/ui/button";
import { mergePDFs, countPagesInBlob } from '@/app/utils/pdfUtils';
import { toast } from "sonner";
import { OrderHistory } from './OrderHistory';
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"

import ChatButton from '@/components/ChatButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  CancellationConfirmDialog,
  UnprintedConfirmDialog,
  PrintAllConfirmDialog,
  ProcessAllConfirmDialog,
  RejectAllConfirmDialog,
  PrintReportDialog,
  SyncSummaryDialog,
  AcceptAllConfirmDialog,
  PrintReport,
  FailedOrderInfo,
  SyncSummary
} from "./components/Dialog";

// Import OrderTable
import { OrderTable } from './components/Table';

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta' // Pastikan selalu menggunakan timezone Jakarta
  });
}

// Fungsi untuk mengecek apakah timestamp adalah hari ini (waktu Jakarta)
function isToday(timestamp: number): boolean {
  if (!timestamp || timestamp === 0) return false;
  
  // Konversi timestamp UTC ke WIB
  const jakartaTimestamp = timestamp + (7 * 60 * 60);
  const shipDate = new Date(jakartaTimestamp * 1000);
  
  // Dapatkan tanggal sekarang dalam WIB
  const now = new Date();
  const jakartaNow = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  
  return shipDate.getDate() === jakartaNow.getDate() &&
         shipDate.getMonth() === jakartaNow.getMonth() &&
         shipDate.getFullYear() === jakartaNow.getFullYear();
}

// Fungsi untuk mengecek apakah pesanan telah melewati batas waktu pengiriman
function isOverdue(timestamp: number): boolean {
  if (!timestamp || timestamp === 0) return false;
  
  // Bandingkan timestamp UTC dengan waktu sekarang dalam UTC
  const nowUtc = Math.floor(Date.now() / 1000);
  return timestamp < nowUtc;
}

type OrdersDetailTableProps = {
  orders: Order[]
  onOrderUpdate?: (orderSn: string, updates: Partial<Order>) => void
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
  order: Order;
  onProcess: (order: Order) => void;
  onCancellationAction: (orderSn: string, action: 'ACCEPT' | 'REJECT') => void;
};

// Update komponen StatusBadge dengan props baru
const StatusBadge = React.memo(({ status, order, onProcess, onCancellationAction }: StatusBadgeProps) => (
  <div className="flex items-center gap-2">
    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(status)}`}>
      {getStatusIcon(status)}
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
    const isOrderCheckable = (order: Order): boolean => {
      return order.document_status === 'READY' &&
        (order.order_status === 'PROCESSED' || order.order_status === 'IN_CANCEL');
    };

    // Hitung semua data turunan dalam satu iterasi
    const unprintedOrders: Order[] = [];
    const printableOrders: Order[] = [];
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

  // Ubah definisi handleDownloadDocument
  const handleDownloadDocument = useCallback(async (order: { order_sn: string; shop_id?: number; shipping_carrier?: string }) => {
    try {
      if (!order.shop_id) {
        // Jika tidak ada shop_id, cari order dengan order_sn tersebut
        const fullOrder = orders.find(o => o.order_sn === order.order_sn);
        if (!fullOrder) {
          toast.error('Pesanan tidak ditemukan');
          return;
        }
        order = fullOrder;
      }

      const params = {
        order_sn: order.order_sn,
        shipping_document_type: "THERMAL_AIR_WAYBILL" as const,
        shipping_carrier: order.shipping_carrier
      };

      // Destructure response untuk mendapatkan blob
      const { blob } = await downloadDocument(order.shop_id!, [params]);
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
  }, [downloadDocument, onOrderUpdate, orders]);

  // Tambahkan state baru untuk failed orders
  const [failedOrders, setFailedOrders] = useState<FailedOrderInfo[]>([]);


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
  const processPrintingAndReport = async (ordersToPrint: Order[]) => {
    let totalSuccess = 0;
    let totalFailed = 0;
    let totalProcessed = 0;
    const shopReports: {
      shopName: string;
      total: number; 
      processed: number; 
      failed: number;
      expectedTotal: number;
      actualProcessed: number;
    }[] = [];
    const newFailedOrders: FailedOrderInfo[] = [];
    const newShopBlobs: ShopBlob[] = [];

    console.log(`Starting to process ${ordersToPrint.length} orders`);

    try {
      // Kelompokkan berdasarkan shop_id
      const ordersByShop = ordersToPrint.reduce((groups: { [key: number]: Order[] }, order) => {
        const shopId = order.shop_id;
        if (!groups[shopId]) {
          groups[shopId] = [];
        }
        groups[shopId].push(order);
        return groups;
      }, {});

      console.log(`Orders grouped by shop:`, Object.keys(ordersByShop).map(shopId => ({
        shopId,
        orderCount: ordersByShop[Number(shopId)].length
      })));

      // Konversi ke array untuk pemrosesan paralel
      const shopEntries = Object.entries(ordersByShop);
      const PARALLEL_LIMIT = 3;
      const shopChunks = chunkArray(shopEntries, PARALLEL_LIMIT);
      
      setDocumentBulkProgress(prev => ({
        ...prev,
        total: ordersToPrint.length
      }));

      for (const shopChunk of shopChunks) {
        await Promise.all(shopChunk.map(async ([shopIdStr, shopOrders]) => {
          const shopId = parseInt(shopIdStr);
          const shopName = shopOrders[0].shop_name;
          let shopSuccess = 0;
          let shopFailed = 0;
          let shopProcessed = 0;
          const blobs: Blob[] = [];

          console.log(`Processing shop ${shopName} with ${shopOrders.length} orders`);

          setDocumentBulkProgress(prev => ({
            ...prev,
            currentShop: shopName
          }));

          const ordersByCarrier = shopOrders.reduce((groups: { [key: string]: Order[] }, order) => {
            const carrier = order.shipping_carrier || 'unknown';
            if (!groups[carrier]) {
              groups[carrier] = [];
            }
            groups[carrier].push(order);
            return groups;
          }, {});

          console.log(`Orders grouped by carrier for shop ${shopName}:`, 
            Object.entries(ordersByCarrier).map(([carrier, orders]) => ({
              carrier,
              orderCount: orders.length
            }))
          );

          const CARRIER_PARALLEL_LIMIT = 2;
          const carrierEntries = Object.entries(ordersByCarrier);
          const carrierChunks = chunkArray(carrierEntries, CARRIER_PARALLEL_LIMIT);

          for (const carrierChunk of carrierChunks) {
            const carrierResults = await Promise.all(carrierChunk.map(async ([carrier, carrierOrders]) => {
              console.log(`Processing carrier ${carrier} with ${carrierOrders.length} orders`);

              setDocumentBulkProgress(prev => ({
                ...prev,
                currentCarrier: carrier,
                currentShop: shopName
              }));

              const orderParams = carrierOrders.map(order => ({
                order_sn: order.order_sn,
                shipping_document_type: "THERMAL_AIR_WAYBILL" as const,
                shipping_carrier: order.shipping_carrier
              }));

              try {
                const { blob, failedOrders } = await downloadDocument(shopId, orderParams);
                
                if (!blob || blob.size === 0) {
                  console.error(`Empty blob received for carrier ${carrier}`);
                  return {
                    carrier,
                    blob: null,
                    failedOrders: carrierOrders.map(o => o.order_sn),
                    successCount: 0,
                    failedCount: carrierOrders.length,
                    carrierOrders
                  };
                }

                // Hitung jumlah halaman
                const pageCount = await countPagesInBlob(blob);
                console.log(`Received PDF with ${pageCount} pages for carrier ${carrier}`);

                if (pageCount < carrierOrders.length) {
                  console.error(`Page count mismatch for carrier ${carrier}: got ${pageCount} pages but need at least ${carrierOrders.length} pages`);
                  // Jika jumlah halaman lebih sedikit dari jumlah order, anggap semua order gagal
                  return {
                    carrier,
                    blob: null,
                    failedOrders: carrierOrders.map(o => o.order_sn),
                    successCount: 0,
                    failedCount: carrierOrders.length,
                    carrierOrders
                  };
                }
                
                return {
                  carrier,
                  blob,
                  failedOrders,
                  successCount: carrierOrders.length - failedOrders.length,
                  failedCount: failedOrders.length,
                  carrierOrders,
                  pageCount
                };
              } catch (error) {
                console.error(`Error processing carrier ${carrier}:`, error);
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

            for (const result of carrierResults) {
              if (result.blob) {
                blobs.push(result.blob);
              }
              
              shopSuccess += result.successCount;
              shopFailed += result.failedCount;
              shopProcessed += result.successCount;
              totalSuccess += result.successCount;
              totalFailed += result.failedCount;
              totalProcessed += result.successCount;

              result.failedOrders.forEach(failedOrderSn => {
                const orderData = result.carrierOrders.find(o => o.order_sn === failedOrderSn);
                if (orderData) {
                  newFailedOrders.push({
                    orderSn: failedOrderSn,
                    shopName,
                    courier: result.carrier
                  });
                }
              });

              setDocumentBulkProgress(prev => ({
                ...prev,
                processed: prev.processed + result.carrierOrders.length
              }));
            }
          }

          shopReports.push({
            shopName,
            total: shopSuccess + shopFailed,
            processed: shopSuccess,
            failed: shopFailed,
            expectedTotal: shopOrders.length,
            actualProcessed: shopProcessed
          });

          if (blobs.length > 0) {
            try {
              console.log(`Merging ${blobs.length} PDFs for shop ${shopName}`);
              const mergedPDF = await mergePDFs(blobs);
              
              // Validasi hasil merge
              const totalPages = await countPagesInBlob(mergedPDF);
              console.log(`Merged PDF has ${totalPages} pages for shop ${shopName}`);

              if (totalPages < shopSuccess) {
                console.error(`Page count mismatch after merge for shop ${shopName}: got ${totalPages} pages but need at least ${shopSuccess} pages`);
                throw new Error('Merged PDF has fewer pages than orders');
              }

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
              
              // Tandai semua order yang belum ditandai gagal sebagai gagal
              const remainingOrders = shopOrders.filter(
                order => !newFailedOrders.some(f => f.orderSn === order.order_sn)
              );
              
              remainingOrders.forEach(order => {
                newFailedOrders.push({
                  orderSn: order.order_sn,
                  shopName,
                  courier: order.shipping_carrier || 'unknown'
                });
              });

              totalSuccess -= remainingOrders.length;
              totalFailed += remainingOrders.length;
              shopSuccess -= remainingOrders.length;
              shopFailed += remainingOrders.length;
            }
          }
        }));
      }

      setShopBlobs(newShopBlobs);

      // Update laporan akhir
      setPrintReport({
        totalSuccess,
        totalFailed,
        shopReports
      });
      setIsPrintReportOpen(true);

      if (newFailedOrders.length > 0) {
        setFailedOrders(newFailedOrders);
      }

      // Validasi akhir
      if (totalProcessed !== ordersToPrint.length) {
        console.error(`Final count mismatch: processed ${totalProcessed} of ${ordersToPrint.length} orders`);
        toast.error('Jumlah dokumen yang diproses tidak sesuai dengan jumlah pesanan');
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
  const handleBulkPrint = async (specificOrders?: Order[]) => {
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
const handleProcessOrder = async (order: Order) => {
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
const [printReport, setPrintReport] = useState<PrintReport>({
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
const [syncSummary, setSyncSummary] = useState<SyncSummary>({
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

      <OrderTable
        orders={orders}
        filteredOrders={filteredOrders}
        isLoading={isLoading || false}
        tableState={tableState}
        derivedData={derivedData}
        isLoadingForOrder={isLoadingForOrder}
        handleSelectOrder={handleSelectOrder}
        handleSelectAll={handleSelectAll}
        handleDownloadDocument={handleDownloadDocument}
        setSelectedOrderSn={setSelectedOrderSn}
        setIsDetailOpen={setIsDetailOpen}
        handleUsernameClick={handleUsernameClick}
        formatDate={formatDate}
        isToday={isToday}
        isOverdue={isOverdue}
        calculateOrderTotal={calculateOrderTotal}
        getSkuSummary={getSkuSummary}
        groupItemsBySku={groupItemsBySku}
        handleProcessOrder={handleProcessOrder}
        handleCancellationAction={handleCancellationAction}
        handleOrderSnClick={(orderSn) => {
          console.log('handleOrderSnClick dipanggil dengan orderSn:', orderSn);
          setSelectedOrderSn(orderSn);
          setIsDetailOpen(true);
        }}
      />

      {/* Tambahkan OrderDetails component */}
      <OrderDetails
        orderSn={selectedOrderSn}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />

      <CancellationConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        selectedAction={selectedAction}
        onConfirm={handleConfirmAction}
      />

      <UnprintedConfirmDialog
        open={isUnprintedConfirmOpen}
        onOpenChange={setIsUnprintedConfirmOpen}
        unprintedCount={derivedData.unprintedCount}
        onConfirm={handleConfirmUnprinted}
      />

      <PrintAllConfirmDialog
        open={isPrintAllConfirmOpen}
        onOpenChange={setIsPrintAllConfirmOpen}
        selectedOrdersCount={tableState.selectedOrders.length}
        totalPrintableDocuments={derivedData.totalPrintableDocuments}
        onConfirm={handleConfirmPrintAll}
      />

      <ProcessAllConfirmDialog
        open={isProcessAllConfirmOpen}
        onOpenChange={setIsProcessAllConfirmOpen}
        readyToShipCount={derivedData.readyToShipCount}
        onConfirm={() => {
                setIsProcessAllConfirmOpen(false);
                handleProcessAllOrders();
              }}
      />

      <RejectAllConfirmDialog
        open={isRejectAllConfirmOpen}
        onOpenChange={setIsRejectAllConfirmOpen}
        cancelRequestCount={derivedData.cancelRequestCount}
        onConfirm={handleRejectAllCancellations}
      />

      <PrintReportDialog 
        open={isPrintReportOpen}
        onOpenChange={setIsPrintReportOpen}
        printReport={printReport}
        failedOrders={failedOrders}
        isLoadingForOrder={isLoadingForOrder}
        onDownloadDocument={(order) => handleDownloadDocument(order)}
        onClose={() => {
                setIsPrintReportOpen(false);
                setFailedOrders([]);
              }}
      />

      <SyncSummaryDialog
        open={isSyncSummaryOpen}
        onOpenChange={setIsSyncSummaryOpen}
        syncSummary={syncSummary}
      />

      <AcceptAllConfirmDialog
        open={isAcceptAllConfirmOpen}
        onOpenChange={setIsAcceptAllConfirmOpen}
        eligibleForAccept={eligibleForAccept}
        onConfirm={handleAcceptAllCancellations}
      />

      <OrderHistory 
        userId={selectedUserId}
        isOpen={isOrderHistoryOpen}
        onClose={() => setIsOrderHistoryOpen(false)}
      />
    </div>
  );
}

// Helper functions
const calculateOrderTotal = (order: Order): number => {
  return order.items?.reduce((total, item) => 
    total + (item.model_quantity_purchased * item.model_discounted_price), 
  0) || 0;
};


interface OrderItem {
  model_quantity_purchased: number;
  model_discounted_price: number;
  model_name: string;
  item_sku: string;
}

interface GroupedItems {
  [sku: string]: OrderItem[];
}

const getSkuSummary = (items: OrderItem[] | undefined): string => {
  if (!items?.length) return '-';
  
  const skuMap = items.reduce((acc, item) => {
    acc[item.item_sku] = (acc[item.item_sku] || 0) + item.model_quantity_purchased;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(skuMap)
    .map(([sku, qty]) => `${sku} (${qty})`)
    .join(', ');
};

const groupItemsBySku = (items: OrderItem[] | undefined): GroupedItems => {
  if (!items?.length) return {};
  
  return items.reduce((groups, item) => {
    if (!groups[item.item_sku]) {
      groups[item.item_sku] = [];
    }
    groups[item.item_sku].push(item);
    return groups;
  }, {} as GroupedItems);
};