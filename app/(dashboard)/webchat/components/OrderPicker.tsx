'use client';
import React, { useState } from 'react';
import { Loader2, Send, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Order } from '../_types';

interface OrderPickerProps {
    open: boolean;
    onClose: () => void;
    onSendOrder: (orderSn: string) => void;
    orders: Order[];
}

const statusLabels: Record<string, { label: string; color: string }> = {
    UNPAID: { label: 'Belum Bayar', color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/40' },
    READY_TO_SHIP: { label: 'Siap Kirim', color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40' },
    PROCESSED: { label: 'Diproses', color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40' },
    SHIPPED: { label: 'Dikirim', color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40' },
    COMPLETED: { label: 'Selesai', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
    IN_CANCEL: { label: 'Dibatalkan', color: 'text-red-600 bg-red-50 dark:bg-red-950/40' },
    CANCELLED: { label: 'Dibatalkan', color: 'text-red-600 bg-red-50 dark:bg-red-950/40' },
    INVOICE_PENDING: { label: 'Menunggu Invoice', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
};

const OrderPicker: React.FC<OrderPickerProps> = ({ open, onClose, onSendOrder, orders }) => {
    const [sendingSn, setSendingSn] = useState<string | null>(null);

    const handleSend = async (orderSn: string) => {
        setSendingSn(orderSn);
        try {
            await onSendOrder(orderSn);
            onClose();
        } finally {
            setSendingSn(null);
        }
    };

    const getStatus = (status: string) => {
        return statusLabels[status] || { label: status, color: 'text-gray-600 bg-gray-50' };
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col p-0">
                <DialogHeader className="px-4 pt-4 pb-2">
                    <DialogTitle className="text-base">Pilih Pesanan</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
                    {orders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <Package className="w-10 h-10 mb-2 opacity-40" />
                            <p className="text-sm">Tidak ada pesanan</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {orders.map((order) => {
                                const status = getStatus(order.order_status);
                                const items = order.order_items || [];
                                return (
                                    <div
                                        key={order.order_sn}
                                        className="rounded-lg border border-border hover:border-primary/30 transition-colors overflow-hidden"
                                    >
                                        {/* Header */}
                                        <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-xs font-mono text-muted-foreground truncate">{order.order_sn}</span>
                                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${status.color}`}>
                                                    {status.label}
                                                </span>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="default"
                                                className="shrink-0 h-7 px-2.5 text-xs ml-2"
                                                onClick={() => handleSend(order.order_sn)}
                                                disabled={sendingSn === order.order_sn}
                                            >
                                                {sendingSn === order.order_sn ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <>
                                                        <Send className="w-3 h-3 mr-1" />
                                                        Kirim
                                                    </>
                                                )}
                                            </Button>
                                        </div>

                                        {/* Order Items */}
                                        <div className="px-3 py-2 space-y-2">
                                            {items.slice(0, 3).map((item, idx) => (
                                                <div key={idx} className="flex items-center gap-2.5">
                                                    {item.image_url ? (
                                                        <img
                                                            src={item.image_url}
                                                            alt={item.item_name}
                                                            className="w-10 h-10 rounded object-cover bg-muted shrink-0"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                                                            <Package className="w-4 h-4 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-medium truncate">{item.item_name}</p>
                                                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                                            {item.model_name && <span className="truncate">{item.model_name}</span>}
                                                            <span>x{item.model_quantity_purchased}</span>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs font-semibold text-orange-500 shrink-0">
                                                        Rp{item.model_discounted_price.toLocaleString('id-ID')}
                                                    </span>
                                                </div>
                                            ))}
                                            {items.length > 3 && (
                                                <p className="text-[11px] text-muted-foreground text-center">
                                                    +{items.length - 3} produk lainnya
                                                </p>
                                            )}
                                        </div>

                                        {/* Footer */}
                                        <div className="px-3 py-1.5 border-t border-border bg-muted/20 flex items-center justify-between">
                                            <span className="text-[11px] text-muted-foreground">
                                                {items.length} produk
                                            </span>
                                            <span className="text-xs font-semibold">
                                                Total: Rp{order.total_amount.toLocaleString('id-ID')}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default OrderPicker;
