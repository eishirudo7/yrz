'use client'
import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShoppingBag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Order, OrderItem as OrderItemType, OrderListProps, OrderDetailProps, OrderItemProps } from '../_types';

// Komponen OrderItem yang dimemoize
const OrderItem = React.memo(({ item }: OrderItemProps) => (
    <div className="flex gap-3 py-2.5 border-b last:border-b-0">
        <img
            src={item.image_url}
            alt={item.item_name}
            className="w-14 h-14 object-cover rounded-md flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
            <p className="text-sm font-medium line-clamp-2 leading-snug">{item.item_name}</p>
            <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-1.5 py-0.5 bg-muted rounded-sm">{item.model_name}</span>
                <span className="text-xs text-muted-foreground">x{item.model_quantity_purchased}</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
                <span className="text-sm font-semibold">Rp{item.model_discounted_price.toLocaleString()}</span>
                {item.model_original_price > item.model_discounted_price && (
                    <span className="text-xs line-through text-muted-foreground">
                        Rp{item.model_original_price.toLocaleString()}
                    </span>
                )}
            </div>
        </div>
    </div>
));
OrderItem.displayName = 'OrderItem';

// Komponen OrderDetail yang dimemoize
const OrderDetail = React.memo(({ order }: OrderDetailProps) => {
    const statusColors: Record<string, string> = {
        'PROCESSED': 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
        'PAID': 'bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400',
        'UNPAID': 'bg-yellow-500/10 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400',
        'CANCELLED': 'bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400',
        'COMPLETED': 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
    };

    return (
        <div className="border rounded-lg bg-card overflow-hidden mb-3">
            {/* Header Pesanan */}
            <div className="p-3 border-b bg-muted/30">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{order.shop_name}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[order.order_status] || 'bg-muted text-muted-foreground'}`}>
                        {order.order_status}
                    </span>
                </div>
                <p className="text-xs text-muted-foreground">ORDER SN: {order.order_sn}</p>
            </div>

            {/* Daftar Item */}
            <div className="px-3">
                {order.order_items.map((item, index) => (
                    <OrderItem key={`${item.item_id}-${index}`} item={item} />
                ))}
            </div>

            {/* Footer dengan Informasi Pengiriman dan Total */}
            <div className="p-3 border-t bg-muted/30 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                        <p className="text-muted-foreground">Pengiriman:</p>
                        <p className="font-medium">{order.shipping_carrier}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{order.tracking_number}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Pembayaran:</p>
                        <p className="font-medium">{order.payment_method}</p>
                    </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Total Pembayaran:</span>
                    <span className="text-sm font-semibold">Rp{order.total_amount.toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
});
OrderDetail.displayName = 'OrderDetail';

// Komponen OrderList
const OrderList = React.memo(({ orders, isLoading }: OrderListProps) => {
    return (
        <div className="space-y-4 p-2">
            {isLoading ? (
                <div className="space-y-4">
                    <div className="flex flex-col space-y-3 p-4 border rounded-lg bg-card">
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-4 w-[200px]" />
                            <Skeleton className="h-4 w-[100px]" />
                        </div>
                        <Skeleton className="h-4 w-[250px]" />
                        <div className="space-y-2">
                            {Array(2).fill(0).map((_, i) => (
                                <div key={i} className="flex gap-2 items-center">
                                    <Skeleton className="h-12 w-12 rounded-md" />
                                    <div className="space-y-2 flex-1">
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-3/4" />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="pt-2 border-t space-y-2">
                            <Skeleton className="h-4 w-[150px]" />
                            <Skeleton className="h-4 w-[200px]" />
                        </div>
                    </div>
                </div>
            ) : orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <ShoppingBag className="h-12 w-12 mb-2 opacity-20" />
                    <p>Tidak ada pesanan</p>
                </div>
            ) : (
                orders.map((order) => (
                    <OrderDetail key={order.order_sn} order={order} />
                ))
            )}
        </div>
    );
});
OrderList.displayName = 'OrderList';

// Main OrderPanel component
interface OrderPanelProps {
    orders: Order[];
    isLoading: boolean;
    showHeader?: boolean;
}

const OrderPanel = ({ orders, isLoading, showHeader = true }: OrderPanelProps) => {
    return (
        <>
            {showHeader && (
                <div className="p-3 border-b flex items-center sticky top-0 bg-background z-10 h-[66px]">
                    <div className="flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5" />
                        <h3 className="font-semibold">Daftar Pesanan</h3>
                    </div>
                </div>
            )}
            <ScrollArea className="flex-grow pt-2">
                <OrderList orders={orders} isLoading={isLoading} />
            </ScrollArea>
        </>
    );
};

export default OrderPanel;
