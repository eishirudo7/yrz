'use client'

import { DollarSign, Wallet, MegaphoneIcon, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { format } from "date-fns"
import { id } from 'date-fns/locale'
import { DateRange } from "react-day-picker"

interface AdsData {
    shopId: number;
    shopName: string;
    totalSpend: number;
}

interface SummaryCardsProps {
    omset: number;
    escrow: number;
    totalAdsSpend: number;
    adsData: AdsData[];
    selectedDateRange?: DateRange;
    adsLoading?: boolean;
}

export function SummaryCards({
    omset,
    escrow,
    totalAdsSpend,
    adsData,
    selectedDateRange,
    adsLoading = false
}: SummaryCardsProps) {
    const adminFeePercent = omset > 0 ? ((omset - escrow) / omset * 100).toFixed(1) : '0';
    const adsPercentOfEscrow = escrow > 0 ? (totalAdsSpend / escrow * 100).toFixed(1) : '0';

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
                                    <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-800/40 flex-shrink-0 cursor-pointer hover:bg-purple-200 dark:hover:bg-purple-700/60 transition-colors">
                                        <MegaphoneIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                    </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-60 p-0" align="end">
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
                                                    .sort((a, b) => b.totalSpend - a.totalSpend)
                                                    .map((ad) => (
                                                        <div key={ad.shopId} className="px-3 py-1.5 hover:bg-muted/50">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-xs">{ad.shopName.split(' ')[0]}</span>
                                                                <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400">
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
