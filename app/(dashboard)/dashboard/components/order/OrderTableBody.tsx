import { Order } from '@/app/hooks/useDashboard';
import { OrderTableRow } from './OrderTableRow';
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from 'react';

interface OrderTableBodyProps {
  orders: Order[];
  isLoading?: boolean;
  selectedOrders: string[];
  isOrderCheckable: (order: Order) => boolean;
  onSelectOrder: (orderSn: string, checked: boolean) => void;
  onProcessOrder: (order: Order) => void;
  onCancellationAction: (orderSn: string, action: 'ACCEPT' | 'REJECT') => void;
  onUsernameClick: (userId: number) => void;
  onDownloadDocument: (order: Order) => void;
  isLoadingForOrder: (orderSn: string) => boolean;
  usernameCounts: Record<string, number>;
  showCheckbox: boolean;
  filteredOrders: Order[];
}

export function OrderTableBody({
  orders,
  isLoading = false,
  selectedOrders,
  isOrderCheckable,
  onSelectOrder,
  onProcessOrder,
  onCancellationAction,
  onUsernameClick,
  onDownloadDocument,
  isLoadingForOrder,
  usernameCounts,
  showCheckbox,
  filteredOrders
}: OrderTableBodyProps) {
  // Loading state
  if (isLoading) {
    return (
      <TableBody>
        {[...Array(5)].map((_, index) => (
          <TableRow key={`skeleton-${index}`}>
            <TableCell>
              <Skeleton className="h-4 w-4" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-24" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-32" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-20" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    );
  }

  // Empty state
  if (filteredOrders.length === 0) {
    return (
      <TableBody>
        <TableRow>
          <TableCell colSpan={12} className="text-center py-8">
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-muted-foreground">
                Tidak ada pesanan yang sesuai dengan filter
              </p>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    );
  }

  // Render data
  return (
    <TableBody>
      {filteredOrders.map((order, index) => (
        <OrderTableRow
          key={order.order_sn}
          order={order}
          index={index}
          showCheckbox={showCheckbox}
          selectedOrders={selectedOrders}
          isOrderCheckable={isOrderCheckable}
          onSelectOrder={onSelectOrder}
          onProcessOrder={onProcessOrder}
          onCancellationAction={onCancellationAction}
          onUsernameClick={onUsernameClick}
          onDownloadDocument={onDownloadDocument}
          isLoadingForOrder={isLoadingForOrder}
          usernameCounts={usernameCounts}
        />
      ))}
    </TableBody>
  );
} 