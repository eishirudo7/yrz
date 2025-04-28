import React, { useRef, forwardRef, useEffect, useState } from 'react';
import { Order } from '@/app/hooks/useDashboard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertTriangle, AlertCircle, RefreshCcw, PrinterCheck, Printer } from 'lucide-react';
import ChatButton from '@/components/ChatButton';
import { OrderStatus } from '../types';
import { StatusBadge } from './StatusBadge';
import { TableVirtuoso } from 'react-virtuoso';

interface OrderTableProps {
  orders: Order[];
  filteredOrders: Order[];
  isLoading: boolean;
  tableState: {
    showCheckbox: boolean;
    selectedOrders: string[];
  };
  derivedData: {
    isOrderCheckable: (order: Order) => boolean;
    usernameCounts: Record<string, number>;
  };
  isLoadingForOrder: (orderSn: string) => boolean;
  handleSelectOrder: (orderSn: string, checked: boolean) => void;
  handleSelectAll: (checked: boolean) => void;
  handleDownloadDocument: (order: { order_sn: string, shop_id?: number, shipping_carrier?: string }) => void;
  setSelectedOrderSn: (orderSn: string) => void;
  setIsDetailOpen: (isOpen: boolean) => void;
  handleUsernameClick: (userId: number) => void;
  formatDate: (timestamp: number) => string;
  isToday: (timestamp: number) => boolean;
  isOverdue: (timestamp: number) => boolean;
  calculateOrderTotal: (order: Order) => number;
  getSkuSummary: (items: any[] | undefined) => string;
  groupItemsBySku: (items: any[] | undefined) => Record<string, any[]>;
  handleProcessOrder: (order: Order) => void;
  handleCancellationAction: (orderSn: string, action: 'ACCEPT' | 'REJECT') => void;
}

// Pastikan style th dan td konsisten
const TableHeadWrapper = forwardRef<HTMLTableCellElement, React.ComponentPropsWithoutRef<'th'>>(
  ({ className, ...props }, ref) => {
    return (
      <th 
        ref={ref}
        className={`p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap font-medium uppercase bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 ${className}`}
        style={{
          boxSizing: 'border-box',
          ...props.style
        }}
        {...props}
      />
    );
  }
);
TableHeadWrapper.displayName = 'TableHeadWrapper';

// Buat komponen untuk cell dengan ellipsis
const EllipsisCell = forwardRef<HTMLTableCellElement, React.ComponentPropsWithoutRef<'td'> & { tooltip?: string }>(
  ({ className, children, tooltip, style, ...props }, ref) => {
    return (
      <TableCell 
        ref={ref}
        className={`p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap ${className}`}
        style={{
          ...style,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: style?.width || 'auto',
        }}
        title={tooltip || (typeof children === 'string' ? children : undefined)}
        {...props}
      >
        {children}
      </TableCell>
    );
  }
);
EllipsisCell.displayName = 'EllipsisCell';

export const OrderTable: React.FC<OrderTableProps> = ({
  filteredOrders,
  isLoading,
  tableState,
  derivedData,
  isLoadingForOrder,
  handleSelectOrder,
  handleSelectAll,
  handleDownloadDocument,
  setSelectedOrderSn,
  setIsDetailOpen,
  handleUsernameClick,
  formatDate,
  isToday,
  isOverdue,
  calculateOrderTotal,
  getSkuSummary,
  groupItemsBySku,
  handleProcessOrder,
  handleCancellationAction
}) => {
  const checkboxRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tableHeight, setTableHeight] = useState(600);
  
  // Efek untuk mengatur tinggi tabel secara dinamis
  useEffect(() => {
    const calculateHeight = () => {
      if (containerRef.current) {
        // Gunakan pendekatan yang lebih modern dan akurat
        // Mendapatkan bounding rect container untuk posisinya dari atas
        const containerTop = containerRef.current.getBoundingClientRect().top;
        
        // Hitung tinggi menggunakan pendekatan visual viewport
        // yang lebih akurat untuk perangkat mobile
        const visualViewportHeight = window.visualViewport?.height || window.innerHeight;
        
        // Padding bawah minimal
        const bottomPadding = 16;
        
        // Hitung tinggi yang tersedia
        const availableHeight = visualViewportHeight - containerTop - bottomPadding;
        
        // Pastikan minimal 300px
        const minHeight = 300;
        setTableHeight(Math.max(availableHeight, minHeight));
      }
    };

    // Hitung segera saat komponen dimount
    calculateHeight();
    
    // Gunakan visualViewport API jika tersedia untuk deteksi yang lebih akurat
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', calculateHeight);
      window.visualViewport.addEventListener('scroll', calculateHeight);
    } else {
      // Fallback ke window resize
      window.addEventListener('resize', calculateHeight);
    }
    
    // Event handler untuk rotasi perangkat
    window.addEventListener('orientationchange', calculateHeight);
    
    // Tambahkan penundaan setelah scroll untuk menangani keyboard yang muncul/hilang
    let scrollTimeout: number;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = window.setTimeout(calculateHeight, 100);
    };
    window.addEventListener('scroll', handleScroll);
    
    // Cleanup
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', calculateHeight);
        window.visualViewport.removeEventListener('scroll', calculateHeight);
      } else {
        window.removeEventListener('resize', calculateHeight);
      }
      window.removeEventListener('orientationchange', calculateHeight);
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  // Ubah definisi lebar kolom
  // Gunakan satuan pixel untuk lebar minimum dan persentase untuk fleksibilitas
  const columnWidths = {
    checkbox: { width: '1.5%', minWidth: '40px' },
    number: { width: '2%', minWidth: '40px' },
    shop: { width: '12%', minWidth: '150px' },
    date: { width: '6%', minWidth: '120px' },
    orderNumber: { width: '12%', minWidth: '170px' },
    username: { width: '11%', minWidth: '150px' },
    price: { width: '6%', minWidth: '110px' },
    escrow: { width: '7%', minWidth: '110px' },
    sku: { width: '15.5%', minWidth: '160px' },
    courier: { width: '14%', minWidth: '220px' },
    status: { width: '9%', minWidth: '200px' },
    print: { width: '4%', minWidth: '40px' }
  };

  const tableMinWidth = 1700; // Sesuaikan dengan total lebar ideal untuk semua kolom

  return (
    <div className="rounded-md border overflow-x-auto mt-2 relative" ref={containerRef}>
      {/* Indikator scroll (opsional) untuk mobile yang dihapus */}
      
      {isLoading ? (
        <div className="w-full" style={{ height: `${tableHeight}px`, overflowY: 'auto' }}>
          <table className="w-full table-fixed border-collapse" style={{ minWidth: tableMinWidth }}>
            <thead className="sticky top-0 z-10 bg-white dark:bg-gray-950">
              <tr>
                <TableHeadWrapper 
                  className={`${!tableState.showCheckbox && 'hidden'} p-0`}
                  style={{
                    width: columnWidths.checkbox.width,
                    textAlign: 'center',
                    position: 'relative'
                  }}
                >
                  <div className="flex items-center justify-center absolute inset-0">
                    <Checkbox
                      disabled={true}
                      className="h-4 w-4 opacity-50"
                    />
                  </div>
                </TableHeadWrapper>
                <TableHeadWrapper style={{width: columnWidths.number.width}} className="text-center">#</TableHeadWrapper>
                <TableHeadWrapper 
                  style={{
                    width: columnWidths.shop.width, 
                    minWidth: columnWidths.shop.minWidth
                  }} 
                  className='text-left'
                >
                  Toko
                </TableHeadWrapper>
                <TableHeadWrapper style={{width: columnWidths.date.width}} className='text-left'>Tanggal</TableHeadWrapper>
                <TableHeadWrapper style={{width: columnWidths.orderNumber.width}} className='text-left'>No. Pesanan</TableHeadWrapper>
                <TableHeadWrapper style={{width: columnWidths.username.width}} className='text-left'>Username</TableHeadWrapper>
                <TableHeadWrapper style={{width: columnWidths.price.width}} className='text-left'>Harga</TableHeadWrapper>
                <TableHeadWrapper style={{width: columnWidths.escrow.width}} className='text-left'>Escrow Final</TableHeadWrapper>
                <TableHeadWrapper style={{width: columnWidths.sku.width}} className='text-left'>SKU (Qty)</TableHeadWrapper>
                <TableHeadWrapper style={{width: columnWidths.courier.width}} className='text-left'>Kurir</TableHeadWrapper>
                <TableHeadWrapper style={{width: columnWidths.status.width}}>Status</TableHeadWrapper>
                <TableHeadWrapper style={{width: columnWidths.print.width}} className="text-center">Cetak</TableHeadWrapper>
              </tr>
            </thead>
            <tbody>
              {Array(10).fill(0).map((_, i) => (
                <tr 
                  key={i} 
                  className={`h-[32px] ${i % 2 === 0 ? 'bg-muted dark:bg-gray-800/50' : 'bg-gray-100/20 dark:bg-gray-900'}`}
                >
                  {Object.entries(columnWidths).map(([key, value]) => (
                    <td 
                      key={key}
                      className="p-1 h-[32px]"
                      style={{
                        width: value.width,
                        minWidth: value.minWidth
                      }}
                    >
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <TableVirtuoso
          style={{ height: `${tableHeight}px` }}
          data={filteredOrders}
          totalCount={filteredOrders.length}
          overscan={200}
          fixedItemHeight={32}
          components={{
            Table: (props) => (
              <table 
                {...props} 
                className="w-full dark:bg-gray-900 table-fixed" 
                style={{ 
                  borderCollapse: 'collapse',
                  minWidth: tableMinWidth // Memastikan tabel memiliki lebar minimum
                }} 
              />
            ),
            TableHead: (props) => <thead {...props} className="sticky top-0 z-10 bg-white dark:bg-gray-950" />,
            TableRow: ({ item: order, ...props }) => {
              const index = props['data-item-index'];
              const rowClass = `
                ${order?.order_status === "IN_CANCEL" 
                  ? 'bg-red-100 dark:bg-red-900/50' 
                  : order?.order_status === "CANCELLED"
                    ? 'bg-gray-300 dark:bg-gray-800' 
                    : index % 2 === 0 
                      ? 'bg-muted dark:bg-gray-800/50' 
                      : 'bg-gray-100/20 dark:bg-gray-900'
                }
                hover:bg-primary/10 dark:hover:bg-primary/20 hover:shadow-sm transition-colors
              `;
              return <tr {...props} className={rowClass} />;
            },
            TableBody: (props) => <tbody {...props} />
          }}
          fixedHeaderContent={() => (
            <tr>
              <TableHeadWrapper 
                className={`${!tableState.showCheckbox && 'hidden'} p-0`}
                style={{
                  width: columnWidths.checkbox.width,
                  textAlign: 'center',
                  position: 'relative'
                }}
              >
                <div className="flex items-center justify-center absolute inset-0">
                  <Checkbox
                    ref={checkboxRef}
                    checked={
                      filteredOrders.filter(order => derivedData.isOrderCheckable(order)).length > 0 && 
                      filteredOrders
                        .filter(order => derivedData.isOrderCheckable(order))
                        .every(order => tableState.selectedOrders.includes(order.order_sn))
                    }
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    className="h-4 w-4"
                  />
                </div>
              </TableHeadWrapper>
              <TableHeadWrapper style={{width: columnWidths.number.width}} className="text-center">#</TableHeadWrapper>
              <TableHeadWrapper 
                style={{
                  width: columnWidths.shop.width, 
                  minWidth: columnWidths.shop.minWidth
                }} 
                className='text-left'
              >
                Toko
              </TableHeadWrapper>
              <TableHeadWrapper style={{width: columnWidths.date.width}} className='text-left'>Tanggal</TableHeadWrapper>
              <TableHeadWrapper style={{width: columnWidths.orderNumber.width}} className='text-left'>No. Pesanan</TableHeadWrapper>
              <TableHeadWrapper style={{width: columnWidths.username.width}} className='text-left'>Username</TableHeadWrapper>
              <TableHeadWrapper style={{width: columnWidths.price.width}} className='text-left'>Harga</TableHeadWrapper>
              <TableHeadWrapper style={{width: columnWidths.escrow.width}} className='text-left'>Escrow Final</TableHeadWrapper>
              <TableHeadWrapper style={{width: columnWidths.sku.width}} className='text-left'>SKU (Qty)</TableHeadWrapper>
              <TableHeadWrapper style={{width: columnWidths.courier.width}} className='text-left'>Kurir</TableHeadWrapper>
              <TableHeadWrapper style={{width: columnWidths.status.width}}>Status</TableHeadWrapper>
              <TableHeadWrapper style={{width: columnWidths.print.width}} className="text-center">Cetak</TableHeadWrapper>
            </tr>
          )}
          itemContent={(index, order) => (
            <>
              <TableCell 
                className={`p-0 h-[32px] ${!tableState.showCheckbox && 'hidden'}`}
                style={{
                  width: columnWidths.checkbox.width,
                  textAlign: 'center',
                  position: 'relative'
                }}
              >
                <div className="flex items-center justify-center absolute inset-0">
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
              <TableCell 
                className="p-1 h-[32px] text-xs text-gray-600 dark:text-white text-center whitespace-nowrap"
                style={{width: columnWidths.number.width}}
              >
                {index + 1}
              </TableCell>
              <TableCell 
                className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap"
                style={{
                  width: columnWidths.shop.width, 
                  minWidth: columnWidths.shop.minWidth,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                title={order.shop_name}
              >
                {order.shop_name}
              </TableCell>
              <TableCell 
                className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap"
                style={{width: columnWidths.date.width}}
              >
                {formatDate(order.pay_time)}
              </TableCell>
              <EllipsisCell 
                className="cursor-pointer hover:text-primary"
                style={{width: columnWidths.orderNumber.width}}
                onClick={() => {
                  setSelectedOrderSn(order.order_sn)
                  setIsDetailOpen(true)
                }}
              >
                <div className="flex items-center gap-1.5 overflow-hidden">
                  
                  <span className="overflow-hidden text-overflow-ellipsis">{order.order_sn}</span>
                  {order.cod && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-600 text-white dark:bg-red-500 flex-shrink-0">
                      COD
                    </span>
                  )}
                </div>
              </EllipsisCell>
              <EllipsisCell 
                className=""
                style={{width: columnWidths.username.width}}
                tooltip={order.buyer_username}
              >
                <div className="flex items-center">
                  <div className="flex items-center mr-1">
                    <button
                      onClick={() => handleUsernameClick(order.buyer_user_id)}
                      className="hover:text-primary mr-2"
                    >
                      {order.buyer_username}
                    </button>
                    
                    <ChatButton
                      shopId={order.shop_id}
                      toId={order.buyer_user_id}
                      toName={order.buyer_username || "Pembeli"}
                      toAvatar={""} 
                      shopName={order.shop_name}
                      iconSize={14}
                      iconOnly={true}
                      orderId={order.order_sn}
                      orderStatus={order.order_status} 
                    />
                  </div>
                  <div className="flex-shrink-0">
                    {order.buyer_username && derivedData.usernameCounts[order.buyer_username] > 1 && (
                      <span 
                        className="inline-flex items-center justify-center w-4 h-4 bg-blue-100 text-blue-800 text-[10px] font-medium rounded-full dark:bg-blue-900 dark:text-blue-300"
                        title={`Pembeli ini memiliki ${derivedData.usernameCounts[order.buyer_username]} pesanan`}
                      >
                        {derivedData.usernameCounts[order.buyer_username]}
                      </span>
                    )}
                  </div>
                </div>
              </EllipsisCell>
              <TableCell 
                className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap"
                style={{width: columnWidths.price.width}}
              >
                Rp {calculateOrderTotal(order).toLocaleString('id-ID')}
              </TableCell>
              <TableCell 
                className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap"
                style={{width: columnWidths.escrow.width}}
              >
                Rp {(order.escrow_amount_after_adjustment || 0).toLocaleString('id-ID')}
              </TableCell>
              <EllipsisCell 
                style={{width: columnWidths.sku.width}}
                tooltip={getSkuSummary(order.items)}
              >
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="hover:text-primary w-full text-left overflow-hidden text-ellipsis">
                      {getSkuSummary(order.items)}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-[90vw] max-w-[280px] sm:w-80 p-0 shadow-xl dark:shadow-lg dark:shadow-gray-900/50"
                    align="center"
                    side="top"
                    sideOffset={5}
                  >
                    <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
                      <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50">
                        <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">Detail Item</h4>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto">
                        {Object.entries(groupItemsBySku(order.items)).map(([sku, items], index, array) => (
                          <div 
                            key={sku}
                            className={`flex flex-col ${
                              index !== array.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''
                            }`}
                          >
                            <div className="px-3 bg-gray-50/50 dark:bg-gray-800/30">
                              <span className="font-medium text-[11px] text-gray-700 dark:text-gray-300">
                                SKU: {sku}
                              </span>
                            </div>
                            <div className="px-3 py-1.5">
                              <div className="space-y-1">
                                {items.map((item: any, itemIndex: number) => (
                                  <div key={itemIndex} className="flex justify-between items-start text-[11px] leading-tight">
                                    <div className="flex-1">
                                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                        {item.model_name?.replace(/,/, '-') || '-'}
                                      </span>
                                      <span className="ml-1 text-[10px] text-gray-400 dark:text-gray-500">
                                        ({item.model_quantity_purchased}x)
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-gray-700 dark:text-gray-300 ml-3 tabular-nums">
                                      Rp {item.model_discounted_price.toLocaleString('id-ID')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </EllipsisCell>
              <EllipsisCell 
                style={{width: columnWidths.courier.width}}
                tooltip={`${order.shipping_carrier || '-'} (${order.tracking_number || '-'})`}
              >
                {order.shipping_carrier || '-'} ({order.tracking_number || '-'})
              </EllipsisCell>
              <TableCell 
                className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap"
                style={{width: columnWidths.status.width}}
              >
                <StatusBadge 
                  status={order.order_status as OrderStatus} 
                  order={order}
                  onProcess={handleProcessOrder}
                  onCancellationAction={handleCancellationAction}
                />
              </TableCell>
              <TableCell 
                className="text-center p-1 h-[32px] text-xs text-gray-600 dark:text-white"
                style={{width: columnWidths.print.width}}
              >
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
            </>
          )}
        />
      )}
    </div>
  );
}; 