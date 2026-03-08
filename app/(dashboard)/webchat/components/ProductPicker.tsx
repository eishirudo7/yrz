'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Search, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Product {
    item_id: number;
    item_name: string;
    image: {
        image_url_list: string[];
    };
    price_info: {
        current_price: number;
        original_price: number;
    }[];
    item_status: string;
    models?: {
        price_info: {
            current_price: number;
            original_price: number;
        };
    }[];
}

interface ProductPickerProps {
    open: boolean;
    onClose: () => void;
    onSendProduct: (itemId: number) => void;
    shopId: number | null;
}

const ProductPicker: React.FC<ProductPickerProps> = ({ open, onClose, onSendProduct, shopId }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [sendingId, setSendingId] = useState<number | null>(null);

    useEffect(() => {
        if (!open || !shopId) return;
        setIsLoading(true);
        fetch(`/api/produk?shop_id=${shopId}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setProducts(data.data.items || []);
                }
            })
            .catch(() => { })
            .finally(() => setIsLoading(false));
    }, [open, shopId]);

    const filtered = useMemo(() => {
        if (!search.trim()) return products;
        const q = search.toLowerCase();
        return products.filter(p => p.item_name.toLowerCase().includes(q));
    }, [products, search]);

    const getPrice = (product: Product): string => {
        if (product.models && product.models.length > 0) {
            const prices = product.models.map(m => m.price_info.current_price);
            const min = Math.min(...prices);
            const max = Math.max(...prices);
            if (min === max) return `Rp${min.toLocaleString('id-ID')}`;
            return `Rp${min.toLocaleString('id-ID')} - Rp${max.toLocaleString('id-ID')}`;
        }
        if (product.price_info?.[0]) {
            return `Rp${product.price_info[0].current_price.toLocaleString('id-ID')}`;
        }
        return '-';
    };

    const handleSend = async (itemId: number) => {
        setSendingId(itemId);
        try {
            await onSendProduct(itemId);
            onClose();
        } finally {
            setSendingId(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col p-0">
                <DialogHeader className="px-4 pt-4 pb-0">
                    <DialogTitle className="text-base">Pilih Produk</DialogTitle>
                </DialogHeader>

                <div className="px-4 py-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari produk..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-12 text-sm text-muted-foreground">
                            {search ? 'Tidak ada produk ditemukan' : 'Belum ada produk'}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filtered.map((product) => (
                                <div
                                    key={product.item_id}
                                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <img
                                        src={product.image?.image_url_list?.[0] || ''}
                                        alt={product.item_name}
                                        className="w-12 h-12 rounded-md object-cover bg-muted shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{product.item_name}</p>
                                        <p className="text-xs text-orange-500 font-semibold">{getPrice(product)}</p>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="default"
                                        className="shrink-0 h-8 px-3 text-xs"
                                        onClick={() => handleSend(product.item_id)}
                                        disabled={sendingId === product.item_id}
                                    >
                                        {sendingId === product.item_id ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <>
                                                <Send className="w-3.5 h-3.5 mr-1" />
                                                Kirim
                                            </>
                                        )}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ProductPicker;
