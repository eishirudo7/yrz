'use client'

import { useState } from 'react'
import { ChevronDown } from "lucide-react"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTheme } from "next-themes"
import type { SkuSummary, ShopSummary } from '../utils/orderUtils'

interface SkuSummaryCardProps {
    topSkus: SkuSummary[];
    getSkuDetails: (skuName: string) => Array<{ shopName: string; quantity: number } | null>;
}

export function SkuSummaryCard({ topSkus, getSkuDetails }: SkuSummaryCardProps) {
    const [expandedSku, setExpandedSku] = useState<string | null>(null);
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';

    const handleSkuClick = (skuName: string) => {
        setExpandedSku(expandedSku === skuName ? null : skuName);
    };

    return (
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
