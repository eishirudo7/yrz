import React, { useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Order } from '@/app/hooks/useDashboard';
import { Package } from 'lucide-react';

interface SkuListDialogProps {
    isOpen: boolean;
    onClose: () => void;
    orders: Order[];
}

interface SkuData {
    sku: string;
    totalQuantity: number;
    variants: Record<string, number>;
    topVariant: string;
}

export const SkuListDialog: React.FC<SkuListDialogProps> = ({ isOpen, onClose, orders }) => {
    const [expandedSku, setExpandedSku] = React.useState<string | null>(null);
    const allowedStatuses = ['PROCESSED', 'READY_TO_SHIP', 'IN_CANCEL'];

    const toggleExpand = (sku: string) => {
        setExpandedSku(prev => prev === sku ? null : sku);
    };

    const skuListData = useMemo(() => {
        // 1. Filter orders based on allowed statuses
        const validOrders = orders.filter(order => allowedStatuses.includes(order.order_status));

        // 2. Aggregate SKU quantities and variants
        const skuMap = new Map<string, SkuData>();

        validOrders.forEach(order => {
            order.items?.forEach(item => {
                const sku = item.item_sku || 'No SKU';
                const qty = item.model_quantity_purchased || 0;

                // Extract Tier 1 from model_name (e.g., "Mahogany,M" -> "Mahogany")
                const fullVariantName = item.model_name || 'Standard';
                let tier1Name = fullVariantName;
                if (fullVariantName.includes(',')) {
                    tier1Name = fullVariantName.split(',')[0].trim();
                }

                // Group case-insensitively
                const skuKey = sku.toUpperCase();
                const tier1Key = tier1Name.toUpperCase();

                if (!skuMap.has(skuKey)) {
                    skuMap.set(skuKey, {
                        sku: sku.toUpperCase(), // Store uppercase for display consistency
                        totalQuantity: 0,
                        variants: {},
                        topVariant: ''
                    });
                }

                const data = skuMap.get(skuKey)!;
                data.totalQuantity += qty;

                if (!data.variants[tier1Key]) {
                    data.variants[tier1Key] = 0;
                }
                data.variants[tier1Key] += qty;
            });
        });

        // 3. Find top variant for each SKU and convert to array
        const sortedData = Array.from(skuMap.values()).map(data => {
            let topVariant = '';
            let maxQty = -1;

            Object.entries(data.variants).forEach(([variant, vQty]) => {
                if (vQty > maxQty) {
                    maxQty = vQty;
                    topVariant = variant;
                }
            });

            data.topVariant = topVariant;
            return data;
        });

        // 4. Sort by total quantity descending
        return sortedData.sort((a, b) => b.totalQuantity - a.totalQuantity);
    }, [orders]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[calc(100vw-32px)] sm:w-full max-w-2xl max-h-[75vh] sm:max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden rounded-xl mx-auto my-4 sm:my-0">
                <DialogHeader className="p-4 sm:p-5 border-b bg-background">
                    <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold tracking-tight">
                        <Package className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                        Ringkasan SKU
                    </DialogTitle>
                    <p className="hidden sm:block text-xs text-muted-foreground mt-0.5">
                        Data diambil dari pesanan Diproses, Siap Kirim, dan Permintaan Batal.
                    </p>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto w-full p-0">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow className="hover:bg-transparent border-b">
                                <TableHead className="w-[40px] sm:w-[50px] text-center font-medium text-[11px] sm:text-xs text-muted-foreground h-9">No</TableHead>
                                <TableHead className="font-medium text-[11px] sm:text-xs text-muted-foreground h-9 pl-0">SKU</TableHead>
                                <TableHead className="text-right font-medium text-[11px] sm:text-xs text-muted-foreground h-9 pr-4 sm:pr-6">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {skuListData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <p className="text-sm">Tidak ada data SKU yang tersedia</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                skuListData.map((item, index) => (
                                    <React.Fragment key={item.sku}>
                                        <TableRow
                                            className="cursor-pointer transition-colors hover:bg-muted/30"
                                            onClick={() => toggleExpand(item.sku)}
                                        >
                                            <TableCell className="text-center text-[11px] sm:text-xs text-muted-foreground py-2 h-10">
                                                {index + 1}
                                            </TableCell>
                                            <TableCell className="font-medium text-xs sm:text-sm py-2 h-10 pl-0">
                                                {item.sku}
                                            </TableCell>
                                            <TableCell className="text-right pr-4 sm:pr-6 py-2 h-10">
                                                <span className="font-medium text-xs sm:text-sm">
                                                    {item.totalQuantity}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                        {expandedSku === item.sku && (
                                            <TableRow className="bg-muted/10 hover:bg-muted/10 border-b-0">
                                                <TableCell colSpan={3} className="p-0 py-1.5 border-0">
                                                    <ul className="space-y-0.5 py-1">
                                                        {Object.entries(item.variants)
                                                            .sort(([, a], [, b]) => b - a)
                                                            .map(([variant, qty]) => (
                                                                <li key={variant} className="flex justify-between items-center py-0.5">
                                                                    <span className="text-muted-foreground text-[10px] sm:text-xs pl-[40px] sm:pl-[50px]">{variant}</span>
                                                                    <span className="font-medium text-muted-foreground text-[10px] sm:text-xs pr-4 sm:pr-6">
                                                                        {qty}
                                                                    </span>
                                                                </li>
                                                            ))}
                                                    </ul>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    );
};
