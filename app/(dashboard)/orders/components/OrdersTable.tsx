'use client'

import { Skeleton } from "@/components/ui/skeleton"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import ChatButton from '@/components/ChatButton'
import { OrderDetails } from '../../dashboard/OrderDetails'
import type { Order } from '@/app/hooks/useOrders'
import { formatDate } from '../utils/orderUtils'

function TableRowSkeleton() {
    return (
        <TableRow>
            <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-6" /></TableCell>
            <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-16" /></TableCell>
            <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell className="p-1 h-[32px]"><Skeleton className="h-4 w-20" /></TableCell>
        </TableRow>
    );
}

interface OrdersTableProps {
    orders: Order[];
    isLoading: boolean;
    searchQuery: string;
    searchType: string;
    hasMore: boolean;
    selectedOrderSn: string | null;
    isDetailsOpen: boolean;
    onOrderClick: (orderSn: string) => void;
    onCloseDetails: () => void;
    onUsernameClick: (userId: number, username: string) => void;
}

export function OrdersTable({
    orders,
    isLoading,
    searchQuery,
    searchType,
    hasMore,
    selectedOrderSn,
    isDetailsOpen,
    onOrderClick,
    onCloseDetails,
    onUsernameClick
}: OrdersTableProps) {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'READY_TO_SHIP': return 'bg-green-600 text-white';
            case 'PROCESSED': return 'bg-blue-600 text-white';
            case 'SHIPPED': return 'bg-indigo-600 text-white';
            case 'CANCELLED': return 'bg-red-600 text-white';
            case 'IN_CANCEL': return 'bg-yellow-600 text-white';
            case 'TO_RETURN': return 'bg-purple-600 text-white';
            default: return 'bg-gray-600 text-white';
        }
    };

    const getSearchTypeLabel = () => {
        switch (searchType) {
            case "order_sn": return "nomor pesanan";
            case "tracking_number": return "nomor resi";
            default: return "username";
        }
    };

    return (
        <div className="rounded-lg border shadow-sm overflow-x-auto">
            <Table className="min-w-[900px]">
                <TableHeader>
                    <TableRow className="dark:border-gray-700">
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
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        Array(10).fill(0).map((_, i) => (
                            <TableRowSkeleton key={`skeleton-${i}`} />
                        ))
                    ) : orders.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={10} className="text-center py-4">
                                <span className="text-sm text-muted-foreground">
                                    {searchQuery.length >= 4
                                        ? `Tidak ditemukan hasil untuk pencarian "${searchQuery}" pada ${getSearchTypeLabel()}`
                                        : "Tidak ada data pesanan"}
                                </span>
                            </TableCell>
                        </TableRow>
                    ) : (
                        <>
                            {orders.map((order, index) => (
                                <TableRow
                                    key={order.order_sn}
                                    className={index % 2 === 0 ? 'bg-muted dark:bg-gray-800/50' : 'bg-gray-100/20 dark:bg-gray-900'}
                                >
                                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white text-center">{index + 1}</TableCell>
                                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap max-w-[80px] sm:max-w-none overflow-hidden text-ellipsis">{order.shop_name}</TableCell>
                                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">{formatDate(order)}</TableCell>
                                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <span
                                                        className="cursor-pointer hover:underline hover:text-primary"
                                                        onClick={() => onOrderClick(order.order_sn)}
                                                    >
                                                        {order.order_sn}
                                                    </span>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-80 p-0" align="start">
                                                    {selectedOrderSn === order.order_sn && (
                                                        <OrderDetails
                                                            orderSn={selectedOrderSn}
                                                            isOpen={isDetailsOpen}
                                                            onClose={onCloseDetails}
                                                        />
                                                    )}
                                                </PopoverContent>
                                            </Popover>
                                            {order.cod && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-600 text-white dark:bg-red-500">
                                                    COD
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => onUsernameClick(order.buyer_user_id ?? 0, order.buyer_username)}
                                                className="hover:text-primary"
                                            >
                                                {order.buyer_username}
                                            </button>
                                            <ChatButton
                                                shopId={order.shop_id ?? 0}
                                                toId={order.buyer_user_id ?? 0}
                                                toName={order.buyer_username || "Pembeli"}
                                                toAvatar={""}
                                                shopName={order.shop_name}
                                                iconSize={14}
                                                iconOnly={true}
                                                orderId={order.order_sn}
                                                orderStatus={order.order_status}
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">
                                        {order.recalculated_total_amount !== undefined
                                            ? `Rp ${Math.round(order.recalculated_total_amount).toLocaleString('id-ID')}`
                                            : `Rp ${parseInt(order.total_amount).toLocaleString('id-ID')}`}
                                    </TableCell>
                                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">
                                        {order.escrow_amount_after_adjustment !== undefined && order.escrow_amount_after_adjustment !== null
                                            ? `Rp ${parseInt(order.escrow_amount_after_adjustment.toString()).toLocaleString('id-ID')}`
                                            : 'Rp -'}
                                    </TableCell>
                                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">{order.sku_qty}</TableCell>
                                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">
                                        {order.shipping_carrier || '-'} ({order.tracking_number || '-'})
                                    </TableCell>
                                    <TableCell className="p-1 h-[32px] text-xs text-gray-600 dark:text-white whitespace-nowrap">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(order.order_status)}`}>
                                            {order.order_status}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {hasMore && (
                                Array(3).fill(0).map((_, i) => (
                                    <TableRowSkeleton key={`load-more-${i}`} />
                                ))
                            )}
                        </>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
