import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Order, OrderItem } from '@/app/hooks/useDashboard'
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
import { Search, Filter, Printer, PrinterCheck, CheckSquare, MessageSquare, Download, Info, X, AlertTriangle, Send, XCircle, RefreshCcw } from 'lucide-react'
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
import { OrderTableHeader } from './components/OrderTableHeader'
import { formatDate, isToday, isOverdue, calculateOrderTotal, getSkuSummary, groupItemsBySku, chunkArray } from '@/app/utils/orderUtils'
import { StatusBadge, OrderStatus } from './components/order/StatusComponents'
import { Category, CATEGORY_LIST } from './types/category'
import { OrderTableActions } from './components/order/OrderTableActions';
import { OrderTableRow } from './components/order/OrderTableRow';
import { OrderTableBody } from './components/order/OrderTableBody';
import { PrintReportDialog } from './components/dialogs/PrintReportDialog';
import { SyncSummaryDialog } from './components/dialogs/SyncSummaryDialog';
import { ConfirmationDialogs } from './components/dialogs/ConfirmationDialogs';
import { CancellationConfirmationDialog } from './components/dialogs/CancellationConfirmationDialog';
import { UnprintedConfirmationDialog } from './components/dialogs/UnprintedConfirmationDialog';

type OrdersDetailTableProps = {
  orders: Order[]
  onOrderUpdate?: (orderSn: string, updates: Partial<Order>) => void
  isLoading?: boolean
}

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

  // Ganti fungsi handleDownloadDocument yang lama
  const handleDownloadDocument = useCallback(async (order: Order) => {
    try {
      const params = {
        order_sn: order.order_sn,
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
  const processPrintingAndReport = async (ordersToPrint: Order[]) => {
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
      const ordersByShop = ordersToPrint.reduce((groups: { [key: number]: Order[] }, order) => {
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

          const ordersByCarrier = shopOrders.reduce((groups: { [key: string]: Order[] }, order) => {
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

  // Tambahkan state untuk tracking progress
  const [bulkProgress, setBulkProgress] = useState<{
    processed: number;
    total: number;
    currentOrder: string;
  }>({
    processed: 0,
    total: 0,
    currentOrder: ''
  });

  // Update fungsi handleBulkPrint untuk menggunakan OrderTableActions
  const handleBulkPrint = async (ordersToPrint: Order[]) => {
    try {
      await processPrintingAndReport(ordersToPrint);
    } catch (error) {
      console.error('Gagal mencetak dokumen:', error);
      toast.error('Gagal mencetak dokumen');
    }
  };

  // Update fungsi handleBulkAcceptCancellation
  const handleBulkAcceptCancellation = async (ordersToAccept: Order[]) => {
    try {
      for (const order of ordersToAccept) {
        setBulkProgress(prev => ({
          ...prev,
          currentOrder: order.order_sn
        }));

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

        setBulkProgress(prev => ({
          ...prev,
          processed: prev.processed + 1
        }));

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      toast.success('Proses penerimaan pembatalan selesai');
    } catch (error) {
      console.error('Gagal menerima pembatalan:', error);
      toast.error('Terjadi kesalahan saat menerima pembatalan');
    } finally {
      setBulkProgress({
        processed: 0,
        total: 0,
        currentOrder: ''
      });
    }
  };

  // Update fungsi handleBulkRejectCancellation
  const handleBulkRejectCancellation = async (ordersToReject: Order[]) => {
    try {
      for (const order of ordersToReject) {
        setBulkProgress(prev => ({
          ...prev,
          currentOrder: order.order_sn
        }));

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

        setBulkProgress(prev => ({
          ...prev,
          processed: prev.processed + 1
        }));

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      toast.success('Proses penolakan pembatalan selesai');
    } catch (error) {
      console.error('Gagal menolak pembatalan:', error);
      toast.error('Terjadi kesalahan saat menolak pembatalan');
    } finally {
      setBulkProgress({
        processed: 0,
        total: 0,
        currentOrder: ''
      });
    }
  };

  // Update fungsi handleSync
  const handleSync = async () => {
    try {
      await handleSyncOrders();
    } catch (error) {
      console.error('Gagal melakukan sinkronisasi:', error);
      toast.error('Gagal melakukan sinkronisasi');
    }
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
      : derivedData.totalPrintableDocuments;

    if (hasPrintableOrders === 0) {
      toast.info('Tidak ada dokumen yang bisa dicetak');
      return;
    }

    setIsPrintAllConfirmOpen(true);
  }, [tableState.selectedOrders, derivedData.totalPrintableDocuments]);

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
      <div className="flex flex-col gap-2 w-full mt-2">
        <OrderTableHeader 
          tableState={tableState}
          setTableState={setTableState}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          handleSearchInput={handleSearchInput}
          clearSearch={clearSearch}
          handleToggleCheckbox={handleToggleCheckbox}
          handleCategoryChange={handleCategoryChange}
          handleShopFilter={handleShopFilter}
          handleCourierFilter={handleCourierFilter}
          handlePrintStatusFilter={handlePrintStatusFilter}
          handlePaymentTypeFilter={handlePaymentTypeFilter}
          handleResetFilter={handleResetFilter}
          derivedData={derivedData}
        />

        <OrderTableActions
          orders={orders}
          selectedOrders={tableState.selectedOrders}
          onBulkPrint={handleBulkPrint}
          onBulkAcceptCancellation={handleBulkAcceptCancellation}
          onBulkRejectCancellation={handleBulkRejectCancellation}
          onSync={handleSync}
            />
          </div>

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

            <Progress 
              value={(documentBulkProgress.processed / documentBulkProgress.total) * 100} 
              className="h-1"
            />
          </div>
        </div>
      )}

      <div className="rounded-md border overflow-x-auto mt-2">
        <Table className="w-full dark:bg-gray-900">
          <TableHeader>
            <TableRow className="dark:border-gray-700">
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
          <OrderTableBody
            orders={orders}
            isLoading={isLoading}
            selectedOrders={tableState.selectedOrders}
            isOrderCheckable={derivedData.isOrderCheckable}
            onSelectOrder={handleSelectOrder}
            onProcessOrder={handleProcessOrder}
                        onCancellationAction={handleCancellationAction}
            onUsernameClick={handleUsernameClick}
            onDownloadDocument={handleDownloadDocument}
            isLoadingForOrder={isLoadingForOrder}
            usernameCounts={derivedData.usernameCounts}
            showCheckbox={tableState.showCheckbox}
            filteredOrders={filteredOrders}
          />
        </Table>
      </div>
      
      <OrderDetails 
        orderSn={selectedOrderSn}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />

      <OrderHistory 
        userId={selectedUserId}
        isOpen={isOrderHistoryOpen}
        onClose={() => setIsOrderHistoryOpen(false)}
      />

      <PrintReportDialog
        isOpen={isPrintReportOpen}
        onOpenChange={setIsPrintReportOpen}
        printReport={printReport}
        failedOrders={failedOrders}
        shopBlobs={shopBlobs}
        orders={orders}
        onBulkPrint={handleBulkPrint}
        onDownloadDocument={handleDownloadDocument}
        isLoadingForOrder={isLoadingForOrder}
        isOrderCheckable={derivedData.isOrderCheckable}
      />

      <SyncSummaryDialog
        isOpen={isSyncSummaryOpen}
        onOpenChange={setIsSyncSummaryOpen}
        syncSummary={syncSummary}
      />

      <ConfirmationDialogs
        isPrintAllConfirmOpen={isPrintAllConfirmOpen}
        setIsPrintAllConfirmOpen={setIsPrintAllConfirmOpen}
        isProcessAllConfirmOpen={isProcessAllConfirmOpen}
        setIsProcessAllConfirmOpen={setIsProcessAllConfirmOpen}
        isAcceptAllConfirmOpen={isAcceptAllConfirmOpen}
        setIsAcceptAllConfirmOpen={setIsAcceptAllConfirmOpen}
        isRejectAllConfirmOpen={isRejectAllConfirmOpen}
        setIsRejectAllConfirmOpen={setIsRejectAllConfirmOpen}
        selectedOrders={tableState.selectedOrders}
        printableOrders={derivedData.printableOrders}
        readyToShipCount={derivedData.readyToShipCount}
        cancelRequestCount={derivedData.cancelRequestCount}
        onConfirmPrintAll={handleConfirmPrintAll}
        onConfirmProcessAll={handleProcessAllOrders}
        onConfirmAcceptAll={handleAcceptAllCancellations}
        onConfirmRejectAll={handleRejectAllCancellations}
      />

      <CancellationConfirmationDialog
        isOpen={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        selectedAction={selectedAction}
        onConfirm={handleConfirmAction}
      />

      <UnprintedConfirmationDialog
        isOpen={isUnprintedConfirmOpen}
        onOpenChange={setIsUnprintedConfirmOpen}
        onConfirm={handleConfirmUnprinted}
        totalUnprinted={derivedData.unprintedCount}
      />
                      </div>
  );
}
