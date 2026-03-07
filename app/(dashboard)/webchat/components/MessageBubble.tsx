'use client'
import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingBag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import CustomImageLightbox from '@/components/CustomImageLightbox';
import { UIMessage } from '@/types/shopeeMessage';
import { MessageBubbleProps, ItemDetail, Order } from '../_types';

// Komponen ItemPreview
const ItemPreview = React.memo(({ itemId }: { itemId: number }) => {
    const [item, setItem] = useState<ItemDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchItem = async () => {
            try {
                const response = await fetch(`/api/get_sku?item_ids=${itemId}`);
                const data = await response.json();
                if (data.items?.[0]) {
                    setItem(data.items[0]);
                }
            } catch (error) {
                console.error('Error fetching item:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchItem();
    }, [itemId]);

    if (isLoading) {
        return (
            <div className="flex gap-2 items-center p-2 bg-muted/30 rounded-md mt-2">
                <Skeleton className="h-10 w-10 rounded" />
                <div className="space-y-1 flex-1">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
            </div>
        );
    }

    if (!item) return null;

    const imageUrl = item.image.image_url_list[0];

    return (
        <div className="flex gap-2 items-center p-2 bg-muted/30 rounded-md mt-2">
            <img
                src={imageUrl}
                alt={item.item_name}
                className="h-10 w-10 object-cover rounded"
            />
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium line-clamp-2">{item.item_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">SKU: {item.item_sku}</p>
            </div>
        </div>
    );
});
ItemPreview.displayName = 'ItemPreview';

// Helper untuk status badge warna
function getStatusBadgeClass(status: string): string {
    switch (status) {
        case 'PAID': return 'bg-green-500 text-white dark:bg-green-600';
        case 'UNPAID': return 'bg-yellow-500 text-white dark:bg-yellow-600';
        case 'CANCELLED': return 'bg-red-500 text-white dark:bg-red-600';
        case 'COMPLETED':
        case 'PROCESSED':
        case 'SHIPPED': return 'bg-blue-500 text-white dark:bg-blue-600';
        case 'DELIVERED': return 'bg-green-500 text-white dark:bg-green-600';
        case 'IN_CANCEL': return 'bg-red-500 text-white dark:bg-red-600';
        default: return 'bg-muted text-white dark:bg-muted/80';
    }
}

// Chevron expand/collapse svg
const ChevronDown = () => (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const ChevronUp = () => (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Shared order expand detail block
function OrderExpandDetail({ orderInfo, isExpanded, onToggle, orderSn, isSeller }: {
    orderInfo: Order | undefined;
    isExpanded: boolean;
    onToggle: () => void;
    orderSn: string;
    isSeller: boolean;
}) {
    const formatCurrency = (amount: number) => `Rp${amount.toLocaleString('id-ID')}`;

    return (
        <div className="flex flex-col mt-2 bg-muted/30 rounded p-2">
            <div
                className="flex items-center justify-between w-full cursor-pointer hover:opacity-90 transition-opacity"
                onClick={onToggle}
            >
                <div className="flex items-center gap-2 mr-3 flex-1 min-w-0">
                    <ShoppingBag className="h-4 w-4 flex-shrink-0" />
                    <span className="break-words text-xs font-medium truncate">
                        Pesanan #{orderSn}
                    </span>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {orderInfo?.order_status && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full leading-none ${getStatusBadgeClass(orderInfo.order_status)}`}>
                            {orderInfo.order_status}
                        </span>
                    )}
                    <div className="flex-shrink-0 text-current opacity-70">
                        {isExpanded ? <ChevronUp /> : <ChevronDown />}
                    </div>
                </div>
            </div>

            {isExpanded && orderInfo && (
                <div className={`ml-5 text-xs text-muted-foreground space-y-1 mt-1 ${isSeller ? 'dark:text-primary-foreground/90' : 'dark:text-muted-foreground'}`}>
                    <div className="flex justify-between items-center">
                        <span>Pembayaran:</span>
                        <span className="text-[11px]">{orderInfo.payment_method}</span>
                    </div>

                    {orderInfo.order_items && orderInfo.order_items.length > 0 && (
                        <div>
                            {orderInfo.order_items.map((item, index) => (
                                <div key={`${item.item_id}-${index}`} className="text-xs mt-1">
                                    <div className="flex items-start gap-1.5">
                                        {item.image_url && (
                                            <img
                                                src={item.image_url}
                                                alt={item.item_name}
                                                className="w-7 h-7 object-cover rounded-sm flex-shrink-0"
                                            />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className="line-clamp-1 font-medium text-[11px] flex-1">{item.item_name}</p>
                                                <span className="text-[10px] opacity-90 ml-1 flex-shrink-0">x{item.model_quantity_purchased}</span>
                                            </div>
                                            <div className="flex justify-between items-center mt-0.5">
                                                <span className="text-[10px] opacity-90 line-clamp-1 flex-1">
                                                    {item.item_sku ? `SKU: ${item.item_sku} - ${item.model_name}` : item.model_name}
                                                </span>
                                                <div className="flex flex-col items-end ml-1 flex-shrink-0">
                                                    <span className="text-[9px] line-through opacity-70 dark:opacity-50">{formatCurrency(item.model_original_price)}</span>
                                                    <span className="text-[10px] font-medium">{formatCurrency(item.model_discounted_price)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex justify-between border-t border-muted-foreground/20 dark:border-muted-foreground/10 pt-1 mt-1">
                        <span>Total:</span>
                        <span className="font-medium">{formatCurrency(orderInfo.total_amount)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

// Komponen MessageBubble yang dimemoize
const MessageBubble = React.memo(({ message, orders, isMobileView }: MessageBubbleProps) => {
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [isOrderExpanded, setIsOrderExpanded] = useState(false);

    const hasOrderReference = message.type === 'order' ||
        (message.sourceContent && message.sourceContent.order_sn);

    const orderSn = message.orderData?.orderSn ||
        (message.sourceContent && message.sourceContent.order_sn);

    const orderInfo = useMemo(() => {
        if (!orderSn || !orders.length) return null;
        return orders.find(o => o.order_sn === orderSn);
    }, [orderSn, orders]);

    const formatCurrency = (amount: number) => `Rp${amount.toLocaleString('id-ID')}`;
    const isSeller = message.sender === 'seller';

    return (
        <div className={`flex ${isSeller ? 'justify-end' : 'justify-start'} mb-4 w-full`}>
            <div className={`max-w-[75%] rounded-lg p-3 ${isSeller
                ? 'bg-primary text-primary-foreground dark:bg-primary/90'
                : 'bg-muted dark:bg-muted/50 dark:text-foreground'
                }`}>
                {message.type === 'text' ? (
                    <div>
                        <p className="break-words whitespace-pre-wrap">{message.content}</p>

                        {message.sourceContent?.item_id && (
                            <ItemPreview itemId={message.sourceContent.item_id} />
                        )}

                        {message.sourceContent?.order_sn && (
                            <OrderExpandDetail
                                orderInfo={orderInfo ?? undefined}
                                isExpanded={isOrderExpanded}
                                onToggle={() => setIsOrderExpanded(!isOrderExpanded)}
                                orderSn={message.sourceContent.order_sn}
                                isSeller={isSeller}
                            />
                        )}
                    </div>
                ) : (message.type === 'image' || message.type === 'image_with_text') && message.imageUrl ? (
                    <div className="space-y-2">
                        <div className="relative">
                            <img
                                src={message.imageUrl}
                                alt="Pesan gambar"
                                className="rounded max-w-full cursor-pointer hover:opacity-90 transition-opacity"
                                style={{
                                    maxHeight: '300px',
                                    width: 'auto',
                                    maxWidth: '100%',
                                    aspectRatio: message.imageThumb ? `${message.imageThumb.width}/${message.imageThumb.height}` : 'auto'
                                }}
                                onClick={() => setIsLightboxOpen(true)}
                            />

                            <CustomImageLightbox
                                isOpen={isLightboxOpen}
                                onClose={() => setIsLightboxOpen(false)}
                                imageUrl={message.imageUrl}
                                altText={message.type === 'image_with_text' ? message.content : 'Pesan gambar'}
                            />
                        </div>
                        {message.type === 'image_with_text' && message.content && (
                            <p className="break-words whitespace-pre-wrap mt-2">{message.content}</p>
                        )}
                    </div>
                ) : message.type === 'order' && message.orderData ? (
                    <div className="flex flex-col">
                        <OrderExpandDetail
                            orderInfo={orderInfo ?? undefined}
                            isExpanded={isOrderExpanded}
                            onToggle={() => setIsOrderExpanded(!isOrderExpanded)}
                            orderSn={message.orderData.orderSn}
                            isSeller={isSeller}
                        />
                    </div>
                ) : message.type === 'item' && message.itemData ? (
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-2">
                            <ShoppingBag className="h-4 w-4 flex-shrink-0" />
                            <span className="text-xs font-medium">Detail Produk</span>
                        </div>
                        <ItemPreview itemId={message.itemData.itemId} />
                    </div>
                ) : message.type === 'sticker' && message.stickerData ? (
                    <div className="flex flex-col items-center justify-center">
                        <img
                            src={`https://deo.shopeemobile.com/shopee/shopee-sticker-live-id/packs/${message.stickerData.packageId}/${message.stickerData.stickerId}@1x.png`}
                            alt="Stiker"
                            className="w-20 h-20 object-contain"
                        />
                        <p className="text-xs mt-1 opacity-70">Stiker</p>
                    </div>
                ) : null}
                <p className="text-xs mt-1 opacity-70 dark:opacity-50">{message.time}</p>
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    return prevProps.message.id === nextProps.message.id &&
        prevProps.message.type === nextProps.message.type;
});

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;
