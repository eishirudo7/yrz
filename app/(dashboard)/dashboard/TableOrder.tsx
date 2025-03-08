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
import { Package, Clock, Truck, XCircle, AlertCircle, RefreshCcw, Search, Filter, Printer, PrinterCheck, CheckSquare, CheckCircle, Send, MessageSquare, Download } from 'lucide-react'
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

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

type OrdersDetailTableProps = {
  orders: OrderItem[]
  onOrderUpdate?: (orderSn: string, updates: Partial<OrderItem>) => void
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
  availableCouriers 
}: {
  tableState: TableState;
  setTableState: (value: React.SetStateAction<TableState>) => void;
  shops: string[];
  availableCouriers: string[];
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
              onCheckedChange={(checked) => {
                setTableState(prev => ({
                  ...prev,
                  selectedShops: checked
                    ? [...prev.selectedShops, shop]
                    : prev.selectedShops.filter(s => s !== shop)
                }));
              }}
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
          setTableState(prev => ({ ...prev, printStatus: value }))
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
              onCheckedChange={(checked) => {
                setTableState(prev => ({
                  ...prev,
                  selectedCouriers: checked
                    ? [...prev.selectedCouriers, courier]
                    : prev.selectedCouriers.filter(c => c !== courier)
                }));
              }}
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
          setTableState(prev => ({ ...prev, paymentType: value }))
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
      onClick={() => setTableState(prev => ({
        ...prev,
        selectedShops: [],
        printStatus: 'all',
        selectedCouriers: [],
        paymentType: 'all'
      }))}
      className="mt-2"
    >
      Reset Filter
    </Button>
  </div>
));

FilterContent.displayName = 'FilterContent';

export function OrdersDetailTable({ orders, onOrderUpdate }: OrdersDetailTableProps) {
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

  // 4. Gunakan useMemo untuk metrics
  const metrics = useMemo<TableMetrics>(() => ({
    readyToShipCount: orders.filter(order => order.order_status === 'READY_TO_SHIP').length,
    cancelRequestCount: orders.filter(order => order.order_status === 'IN_CANCEL').length,
    unprintedCount: orders.filter(order => 
      !order.is_printed && 
      order.document_status === 'READY' &&
      (order.order_status === 'PROCESSED' || order.order_status === 'IN_CANCEL')
    ).length,
    totalPrintableDocuments: orders.filter(order => 
      order.document_status === 'READY' &&
      (order.order_status === 'PROCESSED' || order.order_status === 'IN_CANCEL')
    ).length
  }), [orders]);

  // 5. Optimasi filter orders dengan useMemo
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const categoryMatch = tableState.activeCategory === "Semua" || 
        order.order_status === CATEGORY_LIST.find(cat => cat.name === tableState.activeCategory)?.status;
      
      const searchMatch = !tableState.searchTerm || 
        order.buyer_username?.toLowerCase().includes(tableState.searchTerm.toLowerCase()) ||
        order.shipping_carrier?.toLowerCase().includes(tableState.searchTerm.toLowerCase()) ||
        order.order_sn.toLowerCase().includes(tableState.searchTerm.toLowerCase());
      
      const shopMatch = tableState.selectedShops.length === 0 || 
        tableState.selectedShops.includes(order.shop_name);

      const printMatch = tableState.printStatus === 'all' || 
        (tableState.printStatus === 'printed' && order.is_printed) ||
        (tableState.printStatus === 'unprinted' && !order.is_printed);

      const courierMatch = tableState.selectedCouriers.length === 0 ||
        (order.shipping_carrier && tableState.selectedCouriers.includes(order.shipping_carrier));

      const paymentMatch = tableState.paymentType === 'all' ||
        (tableState.paymentType === 'cod' && order.cod) ||
        (tableState.paymentType === 'non_cod' && !order.cod);
      
      return categoryMatch && searchMatch && shopMatch && printMatch && courierMatch && paymentMatch;
    });
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
            .filter(order => isOrderCheckable(order))
            .map(order => order.order_sn)
        : []
    }));
  }, [filteredOrders]);

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

  // Tambahkan state untuk dialog failed orders
  const [isFailedOrdersDialogOpen, setIsFailedOrdersDialogOpen] = useState(false);

  // Tambahkan interface untuk menyimpan blob
  interface ShopBlob {
    shopName: string;
    blob: Blob;
  }

  // Tambahkan state untuk menyimpan blob
  const [shopBlobs, setShopBlobs] = useState<ShopBlob[]>([]);

  // Buat fungsi helper untuk proses pencetakan dan laporan
  const processPrintingAndReport = async (ordersToPrint: OrderItem[]) => {
    let totalSuccess = 0;
    let totalFailed = 0;
    const shopReports: {
      shopName: string;
      success: number;
      failed: number;
    }[] = [];
    const newFailedOrders: typeof failedOrders = [];
    const newShopBlobs: ShopBlob[] = []; // Tambahkan array untuk menyimpan blob baru

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

      for (const [shopId, shopOrders] of Object.entries(ordersByShop)) {
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

        for (const [carrier, carrierOrders] of Object.entries(ordersByCarrier)) {
          setDocumentBulkProgress(prev => ({
            ...prev,
            currentCarrier: carrier,
            currentShop: shopName,
            total: ordersToPrint.length
          }));

          const orderParams = carrierOrders.map(order => ({
            order_sn: order.order_sn,
            package_number: order.package_number,
            shipping_document_type: "THERMAL_AIR_WAYBILL" as const,
            shipping_carrier: order.shipping_carrier
          }));

          try {
            const { blob, failedOrders } = await downloadDocument(parseInt(shopId.toString()), orderParams);
            
            if (blob) {
              blobs.push(blob);
            }
            
            const successCount = carrierOrders.length - failedOrders.length;
            shopSuccess += successCount;
            shopFailed += failedOrders.length;
            totalSuccess += successCount;
            totalFailed += failedOrders.length;

            failedOrders.forEach(failedOrderSn => {
              const orderData = carrierOrders.find(o => o.order_sn === failedOrderSn);
              if (orderData) {
                newFailedOrders.push({
                  orderSn: failedOrderSn,
                  shopName,
                  carrier,
                  trackingNumber: orderData.tracking_number || '-'
                });
              }
            });

            setDocumentBulkProgress(prev => ({
              ...prev,
              processed: prev.processed + carrierOrders.length
            }));

          } catch (error) {
            console.error(`Error downloading documents for carrier ${carrier}:`, error);
            shopFailed += carrierOrders.length;
            totalFailed += carrierOrders.length;
            
            carrierOrders.forEach(order => {
              newFailedOrders.push({
                orderSn: order.order_sn,
                shopName,
                carrier,
                trackingNumber: order.tracking_number || '-'
              });
            });
            continue;
          }
        }

        shopReports.push({
          shopName,
          success: shopSuccess,
          failed: shopFailed
        });

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
      }

      // Update state shopBlobs dengan blob yang baru
      setShopBlobs(newShopBlobs);

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
        : orders.filter(order => isOrderCheckable(order))
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
    const checkableOrders = filteredOrders.filter(order => isOrderCheckable(order));
    const selectedCheckableOrders = tableState.selectedOrders.length;
    const allCheckableOrders = checkableOrders.length;
    
    if (checkboxRef.current) {
      const isIndeterminate = selectedCheckableOrders > 0 && selectedCheckableOrders < allCheckableOrders;
      (checkboxRef.current as any).indeterminate = isIndeterminate;
    }
  }, [tableState.selectedOrders, filteredOrders]);

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
  const handleBulkPrintClick = () => {
    setIsPrintAllConfirmOpen(true);
  };

  // Fungsi untuk menangani konfirmasi print semua
  const handleConfirmPrintAll = async () => {
    setIsPrintAllConfirmOpen(false);
    await handleBulkPrint();
  };

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

  // Fungsi untuk mendapatkan jumlah pesanan yang siap kirim
  const getReadyToShipCount = () => {
    return orders.filter(order => order.order_status === 'READY_TO_SHIP').length;
  };

  // Fungsi untuk memproses semua pesanan
  const handleProcessAllOrders = async () => {
    const readyToShipOrders = orders.filter(order => order.order_status === 'READY_TO_SHIP');
    
    if (readyToShipOrders.length === 0) {
      toast.info('Tidak ada pesanan yang perlu diproses');
      return;
    }

    try {
      // Inisialisasi progress
      setBulkProcessProgress({
        processed: 0,
        total: readyToShipOrders.length,
        currentOrder: ''
      });

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
  };

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
  const handleRejectAllCancellations = async () => {
    const cancelRequests = orders.filter(order => order.order_status === 'IN_CANCEL');
    
    if (cancelRequests.length === 0) {
      toast.info('Tidak ada permintaan pembatalan');
      return;
    }

    try {
      // Inisialisasi progress
      setBulkRejectProgress({
        processed: 0,
        total: cancelRequests.length,
        currentOrder: ''
      });

      for (const order of cancelRequests) {
        setBulkRejectProgress(prev => ({
          ...prev,
          currentOrder: order.order_sn
        }));

        try {
          const response = await fetch('/api/orders/handle-cancellation', {
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
  };

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

  // Update categories dengan count
  const updatedCategories = useMemo(() => {
    return categories.map(category => ({
      ...category,
      count: category.name === "Semua" 
        ? orders.length 
        : orders.filter(order => order.order_status === category.status).length
    }));
  }, [categories, orders]);

  // Fungsi helper
  const isOrderCheckable = useCallback((order: OrderItem): boolean => {
    return order.document_status === 'READY' &&
      (order.order_status === 'PROCESSED' || order.order_status === 'IN_CANCEL');
  }, []);

  // Fungsi untuk menangani print dokumen yang belum dicetak
  const handlePrintUnprinted = useCallback(async () => {
    const unprintedOrders = orders.filter(order => 
      !order.is_printed && 
      order.document_status === 'READY' &&
      (order.order_status === 'PROCESSED' || order.order_status === 'IN_CANCEL')
    );

    if (unprintedOrders.length === 0) {
      toast.info('Tidak ada dokumen yang belum dicetak');
      return;
    }

    setIsUnprintedConfirmOpen(true);
  }, [orders]);

  // Fungsi untuk konfirmasi print dokumen yang belum dicetak
  const handleConfirmUnprinted = useCallback(async () => {
    setIsUnprintedConfirmOpen(false);
    
    const unprintedOrders = orders.filter(order => 
      !order.is_printed && 
      order.document_status === 'READY' &&
      (order.order_status === 'PROCESSED' || order.order_status === 'IN_CANCEL')
    );

    if (unprintedOrders.length === 0) {
      toast.info('Tidak ada dokumen yang belum dicetak');
      return;
    }

    await processPrintingAndReport(unprintedOrders);
  }, [orders]);

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
          const response = await fetch('/api/orders/handle-cancellation', {
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

  // 2. Optimasi handler dengan useCallback
  const handleMobileCategoryChange = useCallback((value: string) => {
    handleCategoryChange(value);
  }, [handleCategoryChange]);

  // Tambah daftar kurir yang tersedia
  const availableCouriers = useMemo(() => {
    return Array.from(new Set(orders.map(order => order.shipping_carrier).filter(Boolean))).sort();
  }, [orders]);

  // Update fungsi handleChatClick
  const handleChatClick = (userId: number, shopId: number, orderSn: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Mencegah trigger handleUsernameClick
    window.open(`/webchat?user_id=${userId}&shop_id=${shopId}&order_sn=${orderSn}`, '_blank');
  };

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

  return (
    <div className="w-full">
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
              categories={updatedCategories}
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
                <Search size={16} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
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
                      shops={shops}
                      availableCouriers={availableCouriers}
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
              {updatedCategories.map((category) => (
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
                  value={tableState.searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="h-8 text-xs pl-8"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  data-form-type="other"
                  name="search-input-desktop"
                />
                <Search size={16} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
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
                    shops={shops}
                    availableCouriers={availableCouriers}
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
              <Button
                onClick={() => setIsProcessAllConfirmOpen(true)}
                className="px-2 sm:px-3 py-2 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground dark:text-primary-foreground whitespace-nowrap h-[32px] min-h-0"
                disabled={metrics.readyToShipCount === 0}
                title="Proses Pesanan"
              >
                <Send size={14} className="sm:mr-1" />
                <span className="hidden sm:inline">
                  Proses Semua ({metrics.readyToShipCount})
                </span>
                <span className="sm:hidden ml-1">
                  ({metrics.readyToShipCount})
                </span>
              </Button>

              <Button
                onClick={() => setIsRejectAllConfirmOpen(true)}
                className="px-2 sm:px-3 py-2 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground dark:text-primary-foreground whitespace-nowrap h-[32px] min-h-0"
                disabled={metrics.cancelRequestCount === 0}
                title="Tolak Semua Pembatalan"
              >
                <XCircle size={14} className="sm:mr-1" />
                <span className="hidden sm:inline">
                  Tolak Pembatalan ({metrics.cancelRequestCount})
                </span>
                <span className="sm:hidden ml-1">
                  ({metrics.cancelRequestCount})
                </span>
              </Button>

              {/* Tombol sync */}
              <Button
                onClick={handleSyncOrders}
                disabled={isSyncing}
                className="px-2 sm:px-3 py-2 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground dark:text-primary-foreground whitespace-nowrap h-[32px] min-h-0"
                title="Sinkronkan Pesanan"
              >
                <RefreshCcw size={14} className={`sm:mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
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
                disabled={metrics.unprintedCount === 0}
                title="Cetak Dokumen Belum Print"
              >
                <Printer size={14} className="sm:mr-1" />
                <span className="hidden sm:inline">
                  Belum Print ({metrics.unprintedCount})
                </span>
                <span className="sm:hidden ml-1">
                  ({metrics.unprintedCount})
                </span>
              </Button>

              <Button
                onClick={handleBulkPrintClick}
                className="px-2 sm:px-3 py-2 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground dark:text-primary-foreground whitespace-nowrap h-[32px] min-h-0"
                title={tableState.selectedOrders.length > 0 
                  ? `Cetak ${tableState.selectedOrders.length} Dokumen`
                  : `Cetak Semua (${metrics.totalPrintableDocuments})`
                }
              >
                <PrinterCheck size={14} className="sm:mr-1" />
                <span className="hidden sm:inline">
                  {tableState.selectedOrders.length > 0 
                    ? `Cetak ${tableState.selectedOrders.length} Dokumen`
                    : `Cetak Semua (${metrics.totalPrintableDocuments})`
                  }
                </span>
                <span className="sm:hidden ml-1">
                  ({tableState.selectedOrders.length || metrics.totalPrintableDocuments})
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
                      filteredOrders.filter(order => isOrderCheckable(order)).length > 0 && 
                      filteredOrders
                        .filter(order => isOrderCheckable(order))
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
              <TableHead className="font-bold uppercase text-xs text-black dark:text-white whitespace-nowrap min-w-[100px]">SKU (Qty)</TableHead>
              <TableHead className="font-bold uppercase text-xs text-black dark:text-white whitespace-nowrap min-w-[150px]">Kurir</TableHead>
              <TableHead className="font-bold uppercase text-xs text-black dark:text-white whitespace-nowrap min-w-[100px]">Status</TableHead>
              <TableHead className="font-bold uppercase text-xs text-black dark:text-white whitespace-nowrap w-[100px] text-center">Cetak</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.length > 0 ? (
              filteredOrders.map((order: OrderItem, index: number) => (
                <TableRow 
                  key={`${order.order_sn}`} 
                  className={
                    order.order_status === "IN_CANCEL" 
                      ? 'bg-red-100 dark:bg-red-900/50' 
                      : order.order_status === "CANCELLED"
                        ? 'bg-gray-300 dark:bg-gray-800' 
                        : index % 2 === 0 
                          ? 'bg-muted dark:bg-gray-800/50' 
                          : 'bg-gray-100/20 dark:bg-gray-900'
                  }
                >
                  <TableCell className={`p-1 h-[32px] align-middle ${!tableState.showCheckbox && 'hidden'}`}>
                    <div className="flex justify-center">
                      <Checkbox
                        checked={tableState.selectedOrders.includes(order.order_sn)}
                        disabled={!isOrderCheckable(order)}
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
                      <span>{order.order_sn}</span>
                      {order.cod && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-600 text-white dark:bg-red-500">
                          COD
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleUsernameClick(order.buyer_user_id)}
                        className="hover:text-primary"
                      >
                        {order.buyer_username}
                      </button>
                      <button
                        onClick={(e) => handleChatClick(order.buyer_user_id, order.shop_id, order.order_sn, e)}
                        className="hover:text-primary"
                        title="Chat dengan pembeli"
                      >
                        <MessageSquare size={14} />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">
                    Rp {(order.total_amount || 0).toLocaleString('id-ID')}
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
              className="bg-primary hover:bg-primary/90 text-white"
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
              Anda akan mencetak {metrics.unprintedCount} dokumen yang belum pernah dicetak sebelumnya. 
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
                : metrics.totalPrintableDocuments} dokumen yang siap cetak. Lanjutkan?
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
              Anda akan memproses {metrics.readyToShipCount} pesanan yang siap kirim. 
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
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tambahkan Dialog Konfirmasi Reject All */}
      <AlertDialog open={isRejectAllConfirmOpen} onOpenChange={setIsRejectAllConfirmOpen}>
        <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">
              Konfirmasi Tolak Semua Pembatalan
            </AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-300">
              Anda akan menolak {metrics.cancelRequestCount} permintaan pembatalan pesanan. 
              Pembeli tidak akan dapat mengajukan pembatalan lagi untuk pesanan-pesanan ini. Lanjutkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 dark:border-gray-600">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setIsRejectAllConfirmOpen(false);
                handleRejectAllCancellations();
              }}
              className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800"
            >
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
                                    isOrderCheckable(order)
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
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Tutup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tambahkan progress bar jika sedang sync */}
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

      <Dialog open={isSyncSummaryOpen} onOpenChange={setIsSyncSummaryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>Ringkasan Sinkronisasi</DialogTitle>
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
    </div>
  );
}