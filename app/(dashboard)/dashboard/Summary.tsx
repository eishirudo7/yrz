import { useState, useMemo, memo } from 'react';
import { DashboardSummary } from '@/app/hooks/useDashboard'
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChevronDown, ChevronUp, ShoppingCart, DollarSign, BarChart2, Store } from "lucide-react"

type OrdersSummaryProps = {
  summary: DashboardSummary
  isAdsLoading: boolean
}

export const SummaryHeader = memo(({ 
  summary,
  isAdsLoading,
  isVisible,
  onToggle 
}: { 
  summary: DashboardSummary;
  isAdsLoading: boolean;
  isVisible: boolean;
  onToggle: () => void;
}) => {
  return (
    <Card 
      className="bg-primary hover:bg-primary/90 rounded-lg cursor-pointer transition-colors"
      onClick={onToggle}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-between flex-1">
            <div className="flex items-center space-x-2 sm:space-x-4 w-full justify-between">
              <div className="flex items-center flex-1">
                <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-primary-foreground" />
                <div>
                  <div className="text-xs font-medium text-primary-foreground/80 hidden sm:block">TOTAL PESANAN</div>
                  <div className="text-xs font-medium text-primary-foreground/80 sm:hidden">PESANAN</div>
                  <div className="text-xs sm:text-lg font-bold text-primary-foreground">{summary.totalOrders}</div>
                </div>
              </div>

              <div className="h-8 w-[1px] bg-primary-foreground/20" />

              <div className="flex items-center flex-1 justify-center">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 mr-1 text-primary-foreground" />
                <div>
                  <div className="text-xs font-medium text-primary-foreground/80 hidden sm:block">TOTAL OMSET</div>
                  <div className="text-xs font-medium text-primary-foreground/80 sm:hidden">OMSET</div>
                  <div className="text-xs sm:text-lg font-bold text-primary-foreground">
                    <span className="hidden sm:inline">Rp </span>
                    {summary.totalOmset.toLocaleString('id-ID')}
                  </div>
                </div>
              </div>

              <div className="h-8 w-[1px] bg-primary-foreground/20" />

              <div className="flex items-center flex-1 justify-end">
                <BarChart2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-primary-foreground" />
                <div>
                  <div className="text-xs font-medium text-primary-foreground/80 hidden sm:block">TOTAL IKLAN</div>
                  <div className="text-xs font-medium text-primary-foreground/80 sm:hidden">IKLAN</div>
                  <div className="text-xs sm:text-lg font-bold text-primary-foreground">
                    
                    {isAdsLoading ? (
                      <span className="h-5 w-20 bg-gray-300 rounded animate-pulse inline-block" />
                    ) : (
                      <>
                        <span className="hidden sm:inline">Rp </span>
                        {summary.totalIklan.toLocaleString('id-ID')}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {isVisible ? (
            <ChevronUp className="h-5 w-5 ml-2 text-primary-foreground hidden sm:block" />
          ) : (
            <ChevronDown className="h-5 w-5 ml-2 text-primary-foreground hidden sm:block" />
          )}
        </div>
      </CardContent>
    </Card>
  );
});
SummaryHeader.displayName = 'SummaryHeader';

export const SummaryTable = memo(({ summary }: { summary: DashboardSummary }) => {
  const sortedStores = Array.from(new Set([
    ...Object.keys(summary.pesananPerToko),
    ...Object.keys(summary.omsetPerToko),
    ...Object.keys(summary.iklanPerToko)
  ])).sort((a, b) => 
    (summary.pesananPerToko[b] || 0) - (summary.pesananPerToko[a] || 0)
  );

  const formattedData = sortedStores.map(toko => ({
    toko,
    qty: summary.pesananPerToko[toko] || 0,
    omset: (summary.omsetPerToko[toko] || 0).toLocaleString('id-ID'),
    iklan: (summary.iklanPerToko[toko] || 0).toLocaleString('id-ID')
  }));

  return (
    <Card className="rounded-lg overflow-x-auto">
      <CardContent className="p-2 sm:p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Toko</TableHead>
              <TableHead className="text-right w-[15%]">Qty</TableHead>
              <TableHead className="text-right w-[27.5%]">Omset</TableHead>
              <TableHead className="text-right w-[27.5%]">Iklan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formattedData.map(({ toko, qty, omset, iklan }) => (
              <TableRow key={toko}>
                <TableCell className="font-medium text-xs sm:text-sm truncate max-w-[120px]">{toko}</TableCell>
                <TableCell className="text-right text-xs sm:text-sm">{qty}</TableCell>
                <TableCell className="text-right text-xs sm:text-sm whitespace-nowrap">
                  <span className="hidden sm:inline">Rp </span>
                  {omset}
                </TableCell>
                <TableCell className="text-right text-xs sm:text-sm whitespace-nowrap">
                  <span className="hidden sm:inline">Rp </span>
                  {iklan}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
});
SummaryTable.displayName = 'SummaryTable';

export function OrdersSummary({ summary, isAdsLoading }: OrdersSummaryProps) {
  const [isRingkasanVisible, setIsRingkasanVisible] = useState(false);

  return (
    <div className="space-y-2">
      <SummaryHeader 
        summary={summary}
        isAdsLoading={isAdsLoading}
        isVisible={isRingkasanVisible}
        onToggle={() => setIsRingkasanVisible(!isRingkasanVisible)}
      />
      {isRingkasanVisible && <SummaryTable summary={summary} />}
    </div>
  );
}
