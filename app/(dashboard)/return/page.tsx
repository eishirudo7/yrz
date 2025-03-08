'use client';

import { useReturns } from '@/app/hooks/useReturns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

// Export interface agar bisa digunakan di file lain
export interface ReturnItem {
  item_id: number;
  model_id: number;
  name: string;
  images: string[];
  amount: number;
  item_price: number;
  item_sku: string;
}

export interface ReturnData {
  return_sn: string;
  reason: string;
  text_reason: string;
  refund_amount: number;
  currency: string;
  create_time: number;
  status: string;
  tracking_number: string;
  needs_logistics: boolean;
  amount_before_discount: number;
  user: {
    username: string;
    email: string;
    portrait: string;
  };
  item: ReturnItem[];
  order_sn: string;
  return_solution: ReturnSolution;
}

enum ReturnStatus {
  REQUESTED = 'REQUESTED',
  ACCEPTED = 'ACCEPTED',
  CANCELLED = 'CANCELLED',
  JUDGING = 'JUDGING',
  CLOSED = 'CLOSED',
  PROCESSING = 'PROCESSING',
  SELLER_DISPUTE = 'SELLER_DISPUTE'
}

enum ReturnSolution {
  RETURN_REFUND = 0,
  REFUND_ONLY = 1
}

enum ReturnReason {
  NONRECEIPT = 'NONRECEIPT',
  WRONG_ITEM = 'WRONG_ITEM',
  ITEM_DAMAGED = 'ITEM_DAMAGED',
  DIFF_DESC = 'DIFF_DESC',
  MUITAL_AGREE = 'MUITAL_AGREE',
  OTHER = 'OTHER',
  USED = 'USED',
  NO_REASON = 'NO_REASON',
  ITEM_WRONGDAMAGED = 'ITEM_WRONGDAMAGED',
  CHANGE_MIND = 'CHANGE_MIND',
  ITEM_MISSING = 'ITEM_MISSING',
  EXPECTATION_FAILED = 'EXPECTATION_FAILED',
  ITEM_FAKE = 'ITEM_FAKE',
  PHYSICAL_DMG = 'PHYSICAL_DMG',
  FUNCTIONAL_DMG = 'FUNCTIONAL_DMG',
  ITEM_NOT_FIT = 'ITEM_NOT_FIT',
  SUSPICIOUS_PARCEL = 'SUSPICIOUS_PARCEL',
  EXPIRED_PRODUCT = 'EXPIRED_PRODUCT',
  WRONG_ORDER_INFO = 'WRONG_ORDER_INFO',
  WRONG_ADDRESS = 'WRONG_ADDRESS',
  CHANGE_OF_MIND = 'CHANGE_OF_MIND',
  SELLER_SENT_WRONG_ITEM = 'SELLER_SENT_WRONG_ITEM',
  SPILLED_CONTENTS = 'SPILLED_CONTENTS',
  BROKEN_PRODUCTS = 'BROKEN_PRODUCTS',
  DAMAGED_PACKAGE = 'DAMAGED_PACKAGE',
  SCRATCHED = 'SCRATCHED',
  DAMAGED_OTHERS = 'DAMAGED_OTHERS'
}

type BadgeVariant = "outline" | "default" | "secondary" | "destructive" | "success" | "warning";

const ALL_STATUS = 'ALL' as const;

const statusOptions: Array<{
  value: ReturnStatus | typeof ALL_STATUS;
  label: string;
  variant: BadgeVariant;
}> = [
  { value: ALL_STATUS, label: 'Semua Status', variant: 'outline' },
  { value: ReturnStatus.REQUESTED, label: 'Diminta', variant: 'outline' },
  { value: ReturnStatus.ACCEPTED, label: 'Diterima', variant: 'success' },
  { value: ReturnStatus.CANCELLED, label: 'Dibatalkan', variant: 'destructive' },
  { value: ReturnStatus.JUDGING, label: 'Sedang Dinilai', variant: 'warning' },
  { value: ReturnStatus.CLOSED, label: 'Ditutup', variant: 'secondary' },
  { value: ReturnStatus.PROCESSING, label: 'Diproses', variant: 'default' },
  { value: ReturnStatus.SELLER_DISPUTE, label: 'Sengketa Penjual', variant: 'destructive' }
];

const reasonLabels: Record<ReturnReason, string> = {
  [ReturnReason.NONRECEIPT]: 'Barang Tidak Diterima',
  [ReturnReason.WRONG_ITEM]: 'Barang Salah',
  [ReturnReason.ITEM_DAMAGED]: 'Barang Rusak',
  [ReturnReason.DIFF_DESC]: 'Tidak Sesuai Deskripsi',
  [ReturnReason.MUITAL_AGREE]: 'Kesepakatan Bersama',
  [ReturnReason.OTHER]: 'Lainnya',
  [ReturnReason.USED]: 'Sudah Digunakan',
  [ReturnReason.NO_REASON]: 'Tanpa Alasan',
  [ReturnReason.ITEM_WRONGDAMAGED]: 'Barang Salah/Rusak',
  [ReturnReason.CHANGE_MIND]: 'Berubah Pikiran',
  [ReturnReason.ITEM_MISSING]: 'Barang Hilang',
  [ReturnReason.EXPECTATION_FAILED]: 'Tidak Sesuai Harapan',
  [ReturnReason.ITEM_FAKE]: 'Barang Palsu',
  [ReturnReason.PHYSICAL_DMG]: 'Kerusakan Fisik',
  [ReturnReason.FUNCTIONAL_DMG]: 'Kerusakan Fungsi',
  [ReturnReason.ITEM_NOT_FIT]: 'Ukuran Tidak Sesuai',
  [ReturnReason.SUSPICIOUS_PARCEL]: 'Paket Mencurigakan',
  [ReturnReason.EXPIRED_PRODUCT]: 'Produk Kadaluarsa',
  [ReturnReason.WRONG_ORDER_INFO]: 'Info Pesanan Salah',
  [ReturnReason.WRONG_ADDRESS]: 'Alamat Salah',
  [ReturnReason.CHANGE_OF_MIND]: 'Berubah Pikiran',
  [ReturnReason.SELLER_SENT_WRONG_ITEM]: 'Penjual Kirim Barang Salah',
  [ReturnReason.SPILLED_CONTENTS]: 'Isi Tumpah',
  [ReturnReason.BROKEN_PRODUCTS]: 'Produk Rusak',
  [ReturnReason.DAMAGED_PACKAGE]: 'Kemasan Rusak',
  [ReturnReason.SCRATCHED]: 'Tergores',
  [ReturnReason.DAMAGED_OTHERS]: 'Kerusakan Lainnya'
};

const solutionLabels: Record<ReturnSolution, string> = {
  [ReturnSolution.RETURN_REFUND]: 'Return & Refund',
  [ReturnSolution.REFUND_ONLY]: 'Refund Only'
};

interface Column {
  title: string;
  dataIndex: string;
  key: string;
  render?: (value: any, record?: ReturnData) => React.ReactNode;
}

const columns: Column[] = [
  {
    title: 'No. Transaksi',
    dataIndex: 'return_sn',
    key: 'return_sn',
    render: (returnSn: string, record?: ReturnData) => {
      if (!record) return returnSn;
      return (
        <div className="space-y-0.5">
          <div className="text-xs font-medium">{returnSn}</div>
          <div className="text-[10px] text-muted-foreground">{record.order_sn}</div>
        </div>
      );
    }
  },
  {
    title: 'Pembeli',
    dataIndex: 'user',
    key: 'user',
    render: (user: ReturnData['user']) => (
      <div className="flex items-center gap-1.5">
        <img 
          src={user.portrait || '/placeholder-avatar.png'} 
          alt={user.username}
          className="w-5 h-5 rounded-full"
        />
        <span className="text-xs">{user.username}</span>
      </div>
    )
  },
  {
    title: 'Produk',
    dataIndex: 'item',
    key: 'item',
    render: (items: ReturnItem[]) => (
      <div className="space-y-1">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <img 
              src={item.images[0]} 
              alt={item.name}
              className="w-8 h-8 object-cover rounded dark:border dark:border-muted"
            />
            <div className="min-w-[180px] max-w-[200px]">
              <div className="text-xs line-clamp-1 dark:text-foreground">
                {item.name}
              </div>
              <div className="text-[10px] text-muted-foreground">
                SKU: {item.item_sku} × {item.amount}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  },
  {
    title: 'Alasan',
    dataIndex: 'reason',
    key: 'reason',
    render: (reason: ReturnReason) => (
      <div className="text-xs">
        {reasonLabels[reason] || reason}
      </div>
    )
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status: ReturnStatus) => {
      const option = statusOptions.find(opt => opt.value === status);
      return (
        <Badge variant={option?.variant || 'outline'} className="text-[10px] font-medium">
          {option?.label || status}
        </Badge>
      );
    }
  },
  {
    title: 'Jumlah Refund',
    dataIndex: 'refund_amount',
    key: 'refund_amount',
    render: (amount: number) => (
      <div className="text-xs font-medium whitespace-nowrap">
        Rp {amount.toLocaleString()}
      </div>
    )
  },
  {
    title: 'Tanggal',
    dataIndex: 'create_time',
    key: 'create_time',
    render: (timestamp: number) => (
      <div className="text-xs whitespace-nowrap">
        {new Date(timestamp * 1000).toLocaleDateString('id-ID', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        })}
      </div>
    )
  },
  {
    title: 'Detail',
    dataIndex: 'text_reason',
    key: 'text_reason',
    render: (text: string) => text && (
      <div className="max-w-[150px] text-[10px] text-muted-foreground line-clamp-1">
        {text}
      </div>
    )
  },
  {
    title: 'No. Resi',
    dataIndex: 'tracking_number',
    key: 'tracking_number',
    render: (tracking: string) => (
      <div className="text-xs font-medium">
        {tracking || '-'}
      </div>
    )
  },
  {
    title: 'Tipe',
    dataIndex: 'return_solution',
    key: 'return_solution',
    render: (solution: ReturnSolution) => (
      <Badge 
        variant="outline"
        className="text-[10px] whitespace-nowrap bg-primary/10 hover:bg-primary/20 border-0"
      >
        {solutionLabels[solution]}
      </Badge>
    )
  },
];

export default function ReturnPage() {
  const {
    returns,
    shops: unsortedShops,
    isLoading,
    error,
    selectedShop,
    setSelectedShop,
    filters,
    setFilters,
    hasMore,
    page,
    setPage
  } = useReturns();

  const shops = [...unsortedShops].sort((a, b) => 
    a.shop_name.localeCompare(b.shop_name, 'id', { sensitivity: 'base' })
  );

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      setPage(page + 1);
    }
  };

  const totalRefundAmount = returns.reduce((sum, item) => sum + item.refund_amount, 0);
  const totalReturns = returns.length;
  const refundOnlyCount = returns.filter(item => item.return_solution === ReturnSolution.REFUND_ONLY).length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Daftar Pengembalian</h1>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">{totalReturns}</span> pengembalian
            {refundOnlyCount > 0 && (
              <span className="ml-1 text-red-500">
                (<span className="font-medium">{refundOnlyCount}</span> refund)
              </span>
            )}
            <span className="mx-1">•</span>
            <span className="font-medium">Rp {totalRefundAmount.toLocaleString()}</span>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Select
            value={filters.status || ALL_STATUS}
            onValueChange={(value) => setFilters({ 
              ...filters, 
              status: value === ALL_STATUS ? '' : value 
            })}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedShop || ''}
            onValueChange={setSelectedShop}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Pilih Toko" />
            </SelectTrigger>
            <SelectContent>
              {shops.map(shop => (
                <SelectItem key={shop.shop_id} value={String(shop.shop_id)}>
                  {shop.shop_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {isLoading && page === 1 ? (
          [...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))
        ) : returns.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="p-6 text-center text-muted-foreground">
              Tidak ada data pengembalian
            </CardContent>
          </Card>
        ) : (
          <>
            {returns.map((item) => (
              <Card 
                key={item.return_sn} 
                className={`overflow-hidden dark:border-muted ${
                  item.return_solution === ReturnSolution.REFUND_ONLY 
                    ? 'bg-red-50 dark:bg-red-950 dark:border-red-900/50' 
                    : ''
                }`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-2 items-center">
                      <div className="text-xs">
                        <span className="font-medium">Return:</span> {item.return_sn}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Order:</span> {item.order_sn}
                      </div>
                    </div>
                    <Badge 
                      variant={statusOptions.find(opt => opt.value === item.status)?.variant || 'outline'}
                      className="text-[10px] font-medium shrink-0"
                    >
                      {statusOptions.find(opt => opt.value === item.status)?.label || item.status}
                    </Badge>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <img 
                        src={item.item[0].images[0]} 
                        alt={item.item[0].name}
                        className="w-12 h-12 object-cover rounded dark:border dark:border-muted"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs line-clamp-2">{item.item[0].name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          SKU: {item.item[0].item_sku} × {item.item[0].amount}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 shrink-0">
                      <img 
                        src={item.user.portrait || '/placeholder-avatar.png'} 
                        alt={item.user.username}
                        className="w-5 h-5 rounded-full"
                      />
                      <span className="text-xs">{item.user.username}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t dark:border-muted">
                    <div>
                      <div className="text-[10px] text-muted-foreground">Alasan</div>
                      <div className="text-xs">{reasonLabels[item.reason as ReturnReason]}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Jumlah Refund</div>
                      <div className="text-xs font-medium">Rp {item.refund_amount.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Tanggal</div>
                      <div className="text-xs">
                        {new Date(item.create_time * 1000).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">No. Resi</div>
                      <div className="text-xs font-medium">{item.tracking_number || '-'}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t dark:border-muted">
                    <div className="text-[10px] text-muted-foreground line-clamp-1 flex-1">
                      {item.text_reason}
                    </div>
                    <Badge 
                      variant="outline"
                      className="text-[10px] whitespace-nowrap bg-primary/10 hover:bg-primary/20 border-0"
                    >
                      {solutionLabels[item.return_solution as ReturnSolution]}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}

            {hasMore && (
              <div className="col-span-full flex justify-center pt-4">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm bg-primary/10 hover:bg-primary/20 rounded-md transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle 
                          className="opacity-25" 
                          cx="12" 
                          cy="12" 
                          r="10" 
                          stroke="currentColor" 
                          strokeWidth="4"
                          fill="none"
                        />
                        <path 
                          className="opacity-75" 
                          fill="currentColor" 
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Memuat...
                    </span>
                  ) : (
                    'Muat Lebih Banyak'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 