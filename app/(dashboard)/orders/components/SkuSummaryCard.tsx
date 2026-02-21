'use client'

import { useState } from 'react'
import { ChevronDown, Eye, Tag } from "lucide-react"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useTheme } from "next-themes"
import type { SkuSummary, ShopSummary } from '../utils/orderUtils'
import { getTier1ForSku } from '../utils/orderUtils'
import type { Order } from '@/app/hooks/useOrders'

interface SkuSummaryCardProps {
    topSkus: SkuSummary[];
    orders: Order[];
    getSkuDetails: (skuName: string) => Array<{ shopName: string; quantity: number } | null>;
}

export function SkuSummaryCard({ topSkus, orders, getSkuDetails }: SkuSummaryCardProps) {
    const [expandedSku, setExpandedSku] = useState<string | null>(null);
    const [tier1DialogSku, setTier1DialogSku] = useState<string | null>(null);
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';

    const handleSkuClick = (skuName: string) => {
        setExpandedSku(expandedSku === skuName ? null : skuName);
    };

    const tier1Data = tier1DialogSku ? getTier1ForSku(orders, tier1DialogSku) : [];

    return (
        <>
            <Card className={`overflow-hidden ${isDarkMode ? "bg-[#121212] border-gray-800" : "bg-white border-gray-200"}`}>
                <CardHeader className={`py-2.5 px-4 flex flex-row items-center justify-between ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                    <h3 className="text-sm font-semibold">Top SKU Terjual</h3>
                    <span className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>Quantity</span>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[360px]">
                        <div className={`divide-y ${isDarkMode ? "divide-gray-800" : "divide-gray-100"}`}>
                            {topSkus.map((sku, index) => (
                                <div key={sku.sku_name} className="group">
                                    <div
                                        className={`py-2.5 px-4 hover:bg-muted/50 cursor-pointer transition-colors ${isDarkMode ? "hover:bg-gray-800/50" : "hover:bg-gray-100/50"}`}
                                        onClick={() => handleSkuClick(sku.sku_name)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                <div className={`w-5 h-5 flex items-center justify-center text-xs font-semibold ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                                                    {index + 1}
                                                </div>
                                                <p className={`text-sm font-medium truncate flex-1 ${isDarkMode ? "text-white" : "text-gray-900"}`}>{sku.sku_name}</p>
                                                <button
                                                    className={`p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted ${isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-400 hover:text-gray-700"}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setTier1DialogSku(sku.sku_name);
                                                    }}
                                                    title="Lihat variasi terlaris"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-semibold whitespace-nowrap ${isDarkMode ? "text-blue-400" : "text-blue-600"}`}>
                                                    {sku.quantity} pcs
                                                </span>
                                                <ChevronDown
                                                    className={`w-4 h-4 transition-transform ${expandedSku === sku.sku_name ? 'rotate-180' : ''
                                                        } ${expandedSku === sku.sku_name ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${isDarkMode ? "text-gray-400" : "text-gray-500"
                                                        }`}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {expandedSku === sku.sku_name && (
                                        <div className={`divide-y animate-in slide-in-from-top-1 duration-200 ${isDarkMode ? "bg-gray-800/30 divide-gray-700" : "bg-gray-100/30 divide-gray-200"}`}>
                                            {getSkuDetails(sku.sku_name).map((detail, idx) => (
                                                detail && (
                                                    <div key={`${sku.sku_name}-${idx}`} className="py-2 px-4 pl-8">
                                                        <div className="flex items-center justify-between">
                                                            <p className={`text-xs ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>{detail.shopName}</p>
                                                            <span className={`text-xs font-medium ${isDarkMode ? "text-blue-400" : "text-blue-600"}`}>
                                                                {detail.quantity} pcs
                                                            </span>
                                                        </div>
                                                    </div>
                                                )
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* Dialog Variasi Terlaris */}
            <Dialog open={tier1DialogSku !== null} onOpenChange={(open) => { if (!open) setTier1DialogSku(null); }}>
                <DialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden">
                    {/* Header */}
                    <div className={`px-5 pt-5 pb-3 border-b ${isDarkMode ? "border-gray-800 bg-gray-900/50" : "border-gray-100 bg-gray-50/50"}`}>
                        <DialogHeader className="space-y-1.5">
                            <DialogTitle className="text-base font-semibold flex items-center gap-2">
                                <div className={`p-1.5 rounded-lg ${isDarkMode ? "bg-emerald-900/40" : "bg-emerald-100"}`}>
                                    <Tag className={`w-4 h-4 ${isDarkMode ? "text-emerald-400" : "text-emerald-600"}`} />
                                </div>
                                Variasi Terlaris
                            </DialogTitle>
                            <div className="flex items-center gap-2">
                                <p className={`text-xs font-mono truncate ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                                    {tier1DialogSku}
                                </p>
                                {tier1Data.length > 0 && (
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${isDarkMode ? "bg-emerald-900/40 text-emerald-400" : "bg-emerald-100 text-emerald-700"}`}>
                                        {tier1Data.length} variasi
                                    </span>
                                )}
                            </div>
                        </DialogHeader>
                    </div>

                    {/* Content */}
                    <div className="overflow-y-auto max-h-[60vh]">
                        {tier1Data.length === 0 ? (
                            <div className="py-12 text-center px-4">
                                <div className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`}>
                                    <Tag className={`w-6 h-6 ${isDarkMode ? "text-gray-600" : "text-gray-300"}`} />
                                </div>
                                <p className={`text-sm font-medium ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                                    Tidak ada data variasi
                                </p>
                                <p className={`text-xs mt-1 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
                                    Data variasi tersedia dari detail pesanan
                                </p>
                            </div>
                        ) : (
                            <div>
                                {tier1Data.map((t1, index) => {
                                    const maxQty = tier1Data[0].quantity;
                                    const pct = maxQty > 0 ? (t1.quantity / maxQty) * 100 : 0;
                                    const totalQty = tier1Data.reduce((s, v) => s + v.quantity, 0);
                                    const share = totalQty > 0 ? ((t1.quantity / totalQty) * 100).toFixed(1) : '0';

                                    return (
                                        <div
                                            key={`${t1.tier1_name}-${index}`}
                                            className={`px-5 py-3 ${index % 2 === 0
                                                ? (isDarkMode ? "bg-transparent" : "bg-transparent")
                                                : (isDarkMode ? "bg-gray-800/20" : "bg-gray-50/80")
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                    <span className={`text-xs font-bold w-5 text-center ${index < 3
                                                        ? (isDarkMode ? "text-emerald-400" : "text-emerald-600")
                                                        : (isDarkMode ? "text-gray-500" : "text-gray-400")
                                                        }`}>
                                                        {index + 1}
                                                    </span>
                                                    <p className={`text-sm font-medium truncate flex-1 ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                                                        {t1.tier1_name}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                                    <span className={`text-[10px] ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
                                                        {share}%
                                                    </span>
                                                    <span className={`text-xs font-bold tabular-nums ${isDarkMode ? "text-emerald-400" : "text-emerald-600"}`}>
                                                        {t1.quantity}
                                                    </span>
                                                </div>
                                            </div>
                                            {/* Progress bar */}
                                            <div className="ml-7">
                                                <div className={`h-1.5 rounded-full overflow-hidden ${isDarkMode ? "bg-gray-800" : "bg-gray-200/60"}`}>
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${index < 3
                                                            ? (isDarkMode ? "bg-emerald-500/70" : "bg-emerald-500/60")
                                                            : (isDarkMode ? "bg-gray-600/50" : "bg-gray-400/40")
                                                            }`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {tier1Data.length > 0 && (
                        <div className={`px-5 py-3 border-t flex items-center justify-between ${isDarkMode ? "border-gray-800 bg-gray-900/50" : "border-gray-100 bg-gray-50/50"}`}>
                            <span className={`text-xs font-medium ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                                Total
                            </span>
                            <span className={`text-sm font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                                {tier1Data.reduce((s, v) => s + v.quantity, 0)} pcs
                            </span>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

interface ShopSummaryCardProps {
    shopsSummary: ShopSummary[];
}

export function ShopSummaryCard({ shopsSummary }: ShopSummaryCardProps) {
    const [expandedShop, setExpandedShop] = useState<string | null>(null);
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';

    return (
        <Card className={`overflow-hidden ${isDarkMode ? "bg-[#121212] border-gray-800" : "bg-white border-gray-200"}`}>
            <CardHeader className={`py-2.5 px-4 flex flex-row items-center justify-between ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                <h3 className="text-sm font-semibold">Ringkasan per Toko</h3>
                <span className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>Total Pesanan</span>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-[360px]">
                    <div className={`divide-y ${isDarkMode ? "divide-gray-800" : "divide-gray-100"}`}>
                        {shopsSummary.map((shop) => (
                            <div key={shop.name} className="group">
                                <div
                                    className={`py-2.5 px-4 hover:bg-muted/50 cursor-pointer transition-colors ${isDarkMode ? "hover:bg-gray-800/50" : "hover:bg-gray-100/50"}`}
                                    onClick={() => setExpandedShop(expandedShop === shop.name ? null : shop.name)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className={`text-sm font-medium truncate flex-1 ${isDarkMode ? "text-white" : "text-gray-900"}`}>{shop.name}</p>
                                                <span className={`text-xs font-semibold whitespace-nowrap ${isDarkMode ? "text-blue-400" : "text-blue-600"}`}>
                                                    {shop.totalOrders} pesanan
                                                </span>
                                            </div>
                                            <p className={`text-xs mt-0.5 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                                                Omset: Rp {shop.totalAmount.toLocaleString('id-ID')}
                                            </p>
                                        </div>
                                        <ChevronDown
                                            className={`w-4 h-4 transition-transform ml-3 ${expandedShop === shop.name ? 'rotate-180' : ''
                                                } ${expandedShop === shop.name ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${isDarkMode ? "text-gray-400" : "text-gray-500"
                                                }`}
                                        />
                                    </div>
                                </div>

                                {expandedShop === shop.name && (
                                    <div className={`divide-y animate-in slide-in-from-top-1 duration-200 ${isDarkMode ? "bg-gray-800/30 divide-gray-700" : "bg-gray-100/30 divide-gray-200"}`}>
                                        {shop.topSkus.map((sku, index) => (
                                            <div key={sku.sku_name} className="py-2 px-4 pl-8">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                        <div className={`w-5 h-5 flex items-center justify-center text-xs font-semibold ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                                                            {index + 1}
                                                        </div>
                                                        <p className={`text-xs font-medium truncate ${isDarkMode ? "text-white" : "text-gray-900"}`}>{sku.sku_name}</p>
                                                    </div>
                                                    <span className={`text-xs font-semibold ml-2 whitespace-nowrap ${isDarkMode ? "text-blue-400" : "text-blue-600"}`}>
                                                        {sku.quantity} pcs
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
