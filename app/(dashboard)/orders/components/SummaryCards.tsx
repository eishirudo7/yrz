'use client'

import { DollarSign, Wallet, MegaphoneIcon, Loader2, AlertTriangle, RefreshCw } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { format } from "date-fns"
import { id } from 'date-fns/locale'
import { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"

interface AdsData {
    shopId: number;
    shopName: string;
    totalSpend: number;
    error?: string;
}

interface SummaryCardsProps {
    omset: number;
    escrow: number;
    totalAdsSpend: number;
    adsData: AdsData[];
    selectedDateRange?: DateRange;
    adsLoading?: boolean;
    retryingAds?: Record<number, boolean>;
    retryAdsFetch?: (shopId: number) => Promise<void>;
}

export function SummaryCards({
    omset,
    escrow,
    totalAdsSpend,
    adsData,
    selectedDateRange,
    adsLoading = false,
    retryingAds,
    retryAdsFetch
}: SummaryCardsProps) {
    const adminFeePercent = omset > 0 ? ((omset - escrow) / omset * 100).toFixed(1) : '0';
    const adsPercentOfEscrow = escrow > 0 ? (totalAdsSpend / escrow * 100).toFixed(1) : '0';
    const hasAdsError = adsData.some(ad => ad.error);

    return (
        <>
            <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <div className="p-3">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-green-800 dark:text-green-300">
                            Total Omset
                        </p>
                        <div className="flex items-center justify-between">
                            <p className="text-xl font-bold text-green-700 dark:text-green-400 truncate pr-2">
                                Rp {omset.toLocaleString('id-ID')}
                            </p>
                            <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-800/40 flex-shrink-0">
                                <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <div className="p-3">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                            Total Bersih (Escrow)
                        </p>
                        <div className="flex items-center justify-between">
                            <p className="text-xl font-bold text-blue-700 dark:text-blue-400 truncate pr-2">
                                Rp {escrow.toLocaleString('id-ID')}
                            </p>
                            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-800/40 flex-shrink-0">
                                <Wallet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-400">
                            {adminFeePercent}% biaya admin
                        </div>
                    </div>
                </div>
            </Card>

            <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                <div className="p-3">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
                            Total Iklan
                        </p>
                        <div className="flex items-center justify-between">
                            {adsLoading ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                                    <Skeleton className="h-7 w-28 bg-purple-200/50 dark:bg-purple-700/30" />
                                </div>
                            ) : (
                                <p className="text-xl font-bold text-purple-700 dark:text-purple-400 truncate pr-2">
                                    Rp {totalAdsSpend.toLocaleString('id-ID')}
                                </p>
                            )}
                            <Popover>
                                <PopoverTrigger asChild>
                                    <div className={cn(
                                        "p-1.5 rounded-lg flex-shrink-0 cursor-pointer transition-colors relative",
                                        hasAdsError
                                            ? "bg-orange-100 dark:bg-orange-900/40 hover:bg-orange-200 dark:hover:bg-orange-800/60"
                                            : "bg-purple-100 dark:bg-purple-800/40 hover:bg-purple-200 dark:hover:bg-purple-700/60"
                                    )}>
                                        <MegaphoneIcon className={cn(
                                            "w-4 h-4",
                                            hasAdsError ? "text-orange-600 dark:text-orange-400" : "text-purple-600 dark:text-purple-400"
                                        )} />
                                        {hasAdsError && (
                                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500 border-2 border-white dark:border-gray-900"></span>
                                            </span>
                                        )}
                                    </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0" align="end">
                                    <div className="flex items-center justify-between px-3 py-2 border-b">
                                        <h3 className="text-xs font-semibold">Detail Iklan</h3>
                                        <span className="text-[10px] text-muted-foreground">
                                            {selectedDateRange?.from && format(selectedDateRange.from, "dd MMM", { locale: id })} - {selectedDateRange?.to && format(selectedDateRange.to, "dd MMM", { locale: id })}
                                        </span>
                                    </div>
                                    <div className="max-h-[180px] overflow-y-auto">
                                        {adsLoading ? (
                                            <div className="p-3 space-y-2">
                                                {[...Array(3)].map((_, i) => (
                                                    <Skeleton key={i} className="h-4 w-full" />
                                                ))}
                                            </div>
                                        ) : adsData.length === 0 ? (
                                            <p className="text-muted-foreground text-center py-2 text-xs">Tidak ada data iklan</p>
                                        ) : (
                                            <div className="divide-y">
                                                {[...adsData]
                                                    .sort((a, b) => {
                                                        // Fallback sorting: error shops first, then by totalSpend
                                                        if (a.error && !b.error) return -1;
                                                        if (!a.error && b.error) return 1;
                                                        return b.totalSpend - a.totalSpend;
                                                    })
                                                    .map((ad) => (
                                                        <div key={ad.shopId} className={cn("px-3 py-2", ad.error ? "bg-orange-50/50 dark:bg-orange-900/10" : "hover:bg-muted/50")}>
                                                            <div className="flex justify-between items-center gap-2">
                                                                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                                                    <span className="text-xs font-medium truncate">{ad.shopName.split(' ')[0]}</span>
                                                                    {ad.error && (
                                                                        <div className="flex items-center gap-1 shrink-0">
                                                                            <div title={ad.error} className="flex items-center">
                                                                                <AlertTriangle className="h-3 w-3 text-orange-500" />
                                                                            </div>
                                                                            {retryAdsFetch && (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.preventDefault();
                                                                                        e.stopPropagation();
                                                                                        retryAdsFetch(ad.shopId);
                                                                                    }}
                                                                                    disabled={retryingAds?.[ad.shopId]}
                                                                                    className="text-[10px] bg-orange-100 hover:bg-orange-200 text-orange-700 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
                                                                                >
                                                                                    <RefreshCw className={cn("h-2 w-2", retryingAds?.[ad.shopId] && "animate-spin")} />
                                                                                    Retry
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <span className={cn("text-[10px] font-medium shrink-0", ad.error ? "text-orange-600 dark:text-orange-400 opacity-50" : "text-purple-600 dark:text-purple-400")}>
                                                                    Rp {ad.totalSpend.toLocaleString('id-ID')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        )}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                        {adsLoading ? (
                            <Skeleton className="h-3.5 w-24 bg-purple-200/50 dark:bg-purple-700/30" />
                        ) : (
                            <div className="text-xs text-purple-600 dark:text-purple-400">
                                {adsPercentOfEscrow}% dari escrow
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </>
    );
}
