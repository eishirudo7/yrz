import { Order, OrderItem } from '@/app/hooks/useDashboard';
import { formatDate, isToday, isOverdue, calculateOrderTotal, getSkuSummary, groupItemsBySku } from '@/app/utils/orderUtils';
import { StatusBadge, OrderStatus } from './StatusComponents';
import { Button } from "@/components/ui/button";
import { Printer, PrinterCheck, RefreshCcw, AlertTriangle } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from 'react';
import { OrderDetails } from '../../OrderDetails';
import { OrderHistory } from '../../OrderHistory';
import { useShippingDocument } from '@/app/hooks/useShippingDocument';
import { toast } from "sonner";
import ChatButton from '@/components/ChatButton';
import { TableCell } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface OrderTableRowProps {
  order: Order;
  index: number;
  showCheckbox: boolean;
  selectedOrders: string[];
  isOrderCheckable: (order: Order) => boolean;
  onSelectOrder: (orderSn: string, checked: boolean) => void;
  onProcessOrder: (order: Order) => void;
  onCancellationAction: (orderSn: string, action: 'ACCEPT' | 'REJECT') => void;
  onUsernameClick: (userId: number) => void;
  onDownloadDocument: (order: Order) => void;
  isLoadingForOrder: (orderSn: string) => boolean;
  usernameCounts: Record<string, number>;
}

export function OrderTableRow({
  order,
  index,
  showCheckbox,
  selectedOrders,
  isOrderCheckable,
  onSelectOrder,
  onProcessOrder,
  onCancellationAction,
  onUsernameClick,
  onDownloadDocument,
  isLoadingForOrder,
  usernameCounts
}: OrderTableRowProps) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  return (
    <tr className={`
      ${order.order_status === "IN_CANCEL" 
        ? 'bg-red-100 dark:bg-red-900/50' 
        : order.order_status === "CANCELLED"
          ? 'bg-gray-300 dark:bg-gray-800' 
          : index % 2 === 0 
            ? 'bg-muted dark:bg-gray-800/50' 
            : 'bg-gray-100/20 dark:bg-gray-900'
      }
      hover:bg-primary/10 dark:hover:bg-primary/20 hover:shadow-sm transition-colors
    `}>
      <TableCell className={`p-1 h-[32px] align-middle ${!showCheckbox && 'hidden'}`}>
        <div className="flex justify-center">
          <Checkbox
            checked={selectedOrders.includes(order.order_sn)}
            disabled={!isOrderCheckable(order)}
            onCheckedChange={(checked) => 
              onSelectOrder(order.order_sn, checked as boolean)
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
        onClick={() => setIsDetailOpen(true)}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-4 flex justify-center">
            {(order.order_status === 'PROCESSED' || order.order_status === 'IN_CANCEL') && order.ship_by_date && (
              <>
                {order.ship_by_date && isOverdue(order.ship_by_date) && (
                  <span title={`Pesanan melewati batas waktu pengiriman (${formatDate(order.ship_by_date)})`}>
                    <AlertTriangle size={14} className="text-red-500" />
                  </span>
                )}
                {order.ship_by_date && isToday(order.ship_by_date) && !isOverdue(order.ship_by_date) && (
                  <span title={`Batas pengiriman hari ini (${formatDate(order.ship_by_date)})`}>
                    <AlertTriangle size={14} className="text-amber-500" />
                  </span>
                )}
              </>
            )}
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
            {order.buyer_username && usernameCounts[order.buyer_username] > 1 && (
              <span 
                className="inline-flex items-center justify-center w-4 h-4 bg-blue-100 text-blue-800 text-[10px] font-medium rounded-full dark:bg-blue-900 dark:text-blue-300"
                title={`Pembeli ini memiliki ${usernameCounts[order.buyer_username]} pesanan`}
              >
                {usernameCounts[order.buyer_username]}
              </span>
            )}
          </div>
          <div className="flex items-center">
            <button
              onClick={() => onUsernameClick(order.buyer_user_id)}
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
        </div>
      </TableCell>
      <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">
        Rp {calculateOrderTotal(order).toLocaleString('id-ID')}
      </TableCell>
      <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">
        Rp {(order.escrow_amount_after_adjustment || 0).toLocaleString('id-ID')}
      </TableCell>
      <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">
        <Popover>
          <PopoverTrigger asChild>
            <button className="hover:text-primary">
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
                        {items.map((item: OrderItem, itemIndex: number) => (
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
      </TableCell>
      <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">
        {order.shipping_carrier || '-'} ({order.tracking_number || '-'})
      </TableCell>
      <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">
        <StatusBadge 
          status={order.order_status as OrderStatus} 
          order={order}
          onProcess={onProcessOrder}
          onCancellationAction={onCancellationAction}
        />
      </TableCell>
      <TableCell className="text-center p-1 h-[32px]">
        <Button
          onClick={() => onDownloadDocument(order)}
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

      <OrderDetails 
        orderSn={order.order_sn}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
    </tr>
  );
} 