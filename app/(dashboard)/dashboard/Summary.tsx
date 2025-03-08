import { useState } from 'react';
import { DashboardSummary } from '@/app/hooks/useDashboard'
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChevronDown, ChevronUp, ShoppingCart, DollarSign, BarChart2, Store } from "lucide-react"

type OrdersSummaryProps = {
  summary: DashboardSummary
}

export function OrdersSummary({ summary }: OrdersSummaryProps) {
  const [isRingkasanVisible, setIsRingkasanVisible] = useState(false);

  const toggleRingkasan = () => {
    setIsRingkasanVisible(!isRingkasanVisible);
  };

  console.log('Summary data received:', summary);

  // Mengumpulkan semua toko unik dari semua sumber data
  const allStores = Array.from(new Set([
    ...Object.keys(summary.pesananPerToko),
    ...Object.keys(summary.omsetPerToko),
    ...Object.keys(summary.iklanPerToko)
  ]));

  // Mengurutkan berdasarkan jumlah pesanan (toko tanpa pesanan akan memiliki nilai 0)
  const sortedStores = allStores.sort((a, b) => 
    (summary.pesananPerToko[b] || 0) - (summary.pesananPerToko[a] || 0)
  );

  return (
    <div className="space-y-2">
      <Card 
        className="bg-primary hover:bg-primary/90 rounded-lg cursor-pointer transition-colors"
        onClick={toggleRingkasan}
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
                      <span className="hidden sm:inline">Rp </span>
                      {summary.totalIklan.toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {isRingkasanVisible ? (
              <ChevronUp className="h-5 w-5 ml-2 text-primary-foreground hidden sm:block" />
            ) : (
              <ChevronDown className="h-5 w-5 ml-2 text-primary-foreground hidden sm:block" />
            )}
          </div>
        </CardContent>
      </Card>

      {isRingkasanVisible && (
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
                {sortedStores.map((toko) => (
                  <TableRow key={toko}>
                    <TableCell className="font-medium text-xs sm:text-sm truncate max-w-[120px]">{toko}</TableCell>
                    <TableCell className="text-right text-xs sm:text-sm">{summary.pesananPerToko[toko] || 0}</TableCell>
                    <TableCell className="text-right text-xs sm:text-sm whitespace-nowrap">
                      <span className="hidden sm:inline">Rp </span>
                      {(summary.omsetPerToko[toko] || 0).toLocaleString('id-ID')}
                    </TableCell>
                    <TableCell className="text-right text-xs sm:text-sm whitespace-nowrap">
                      <span className="hidden sm:inline">Rp </span>
                      {(summary.iklanPerToko[toko] || 0).toLocaleString('id-ID')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
