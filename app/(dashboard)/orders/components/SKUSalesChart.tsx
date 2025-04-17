'use client'

import { useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, ResponsiveContainer, Tooltip, LabelList } from "recharts"
import { TrendingUp, TrendingDown, MoreHorizontal } from "lucide-react"
import type { Order } from "@/app/hooks/useOrders"
import { useTheme } from "next-themes"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ChartConfig,
  ChartContainer,
} from "@/components/ui/chart"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

interface SKUData {
  name: string
  quantity: number
  amount: number
}

// Fungsi untuk memformat angka ke format rupiah
const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

// Fungsi untuk memformat angka omset agar lebih ringkas
const formatAmountLabel = (amount: number) => {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}jt`
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}rb`
  }
  return amount.toString()
}

// Fungsi untuk memproses data SKU
const processSKUData = (orders: Order[], limit: number = 10) => {
  // Kumpulkan data penjualan per SKU
  const skuMap: Record<string, { quantity: number, amount: number }> = {}
  
  orders.forEach(order => {
    // Gunakan sku_qty seperti di page.tsx
    if (order.sku_qty) {
      const skuEntries = order.sku_qty.split(',').map(entry => entry.trim())
      
      skuEntries.forEach(entry => {
        const match = entry.match(/(.*?)\s*\((\d+)\)/)
        if (match) {
          const [, skuName, quantityStr] = match
          const quantity = parseInt(quantityStr)
          const estimatedUnitAmount = parseFloat(order.total_amount) / skuEntries.length / quantity

          const normalizedSkuName = skuName.toLowerCase()

          if (!skuMap[normalizedSkuName]) {
            skuMap[normalizedSkuName] = {
              quantity: 0,
              amount: 0
            }
          }
          
          skuMap[normalizedSkuName].quantity += quantity
          skuMap[normalizedSkuName].amount += estimatedUnitAmount * quantity
        }
      })
    }
  })
  
  // Konversi ke array dan urutkan
  const sortedData = Object.entries(skuMap)
    .map(([name, data]) => ({
      name,
      quantity: data.quantity,
      amount: data.amount
    }))
    .sort((a, b) => b.quantity - a.quantity) // Urutkan berdasarkan quantity
    .slice(0, limit) // Ambil hanya sejumlah limit teratas
  
  return sortedData
}

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label }: any) => {
  const { theme } = useTheme()
  const isDarkMode = theme === 'dark'
  
  if (active && payload && payload.length) {
    const data = payload[0].payload
    
    return (
      <div className={`rounded-lg border p-2 shadow-sm ${
        isDarkMode 
          ? "border-gray-800 bg-[#1e1e1e] text-white" 
          : "border-gray-200 bg-white text-gray-900"
      }`}>
        <div className="grid gap-2">
          <div className="flex flex-col">
            <span className={`text-[0.70rem] uppercase ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
              PRODUK
            </span>
            <span className="font-bold text-xs">
              {label}
            </span>
          </div>
          
          <div className="flex flex-col">
            <span className={`text-[0.70rem] uppercase ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
              JUMLAH TERJUAL
            </span>
            <span className="font-bold text-xs">
              {data.quantity} unit
            </span>
          </div>
          
          <div className="flex flex-col">
            <span className={`text-[0.70rem] uppercase ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
              TOTAL OMSET
            </span>
            <span className="font-bold text-xs">
              {formatRupiah(data.amount)}
            </span>
          </div>
        </div>
      </div>
    )
  }
  return null
}

// Komponen Chart
export const SKUSalesChart = ({ orders }: { orders: Order[] }) => {
  const { theme } = useTheme()
  const isDarkMode = theme === 'dark'
  const [showAmount, setShowAmount] = useState(false)
  const [limit, setLimit] = useState(10)
  
  // Urutkan data berdasarkan jumlah atau omset
  const chartData = processSKUData(orders, limit).sort((a, b) => {
    if (showAmount) {
      return b.amount - a.amount; // Urutkan berdasarkan omset jika mode omset aktif
    }
    return b.quantity - a.quantity; // Urutkan berdasarkan jumlah jika mode jumlah aktif
  });
  
  // Hitung total penjualan untuk perbandingan
  const totalQuantity = chartData.reduce((sum, item) => sum + item.quantity, 0)
  const totalAmount = chartData.reduce((sum, item) => sum + item.amount, 0)
  
  // Hitung persentase produk teratas
  const topProductPercentage = chartData.length > 0 
    ? Math.round((chartData[0].quantity / totalQuantity) * 100) 
    : 0
  
  // Tentukan apakah tren naik atau turun
  const isTrendingUp = topProductPercentage > 20
  
  const chartColors = {
    background: isDarkMode ? "#121212" : "#ffffff",
    text: isDarkMode ? "#ffffff" : "#333333",
    border: isDarkMode ? "#333333" : "#e2e8f0",
    grid: isDarkMode ? "#333333" : "#e2e8f0",
    tooltip: {
      bg: isDarkMode ? "#1e1e1e" : "#ffffff",
      text: isDarkMode ? "#ffffff" : "#333333",
      border: isDarkMode ? "#555555" : "#e2e8f0"
    },
    bar: isDarkMode ? "#4169E1" : "#3b82f6",
    label: isDarkMode ? "#AAAAAA" : "#666666"
  }
  
  const chartConfig = {
    quantity: {
      label: "Jumlah",
      color: isDarkMode ? "hsl(var(--chart-1))" : "hsl(215, 70%, 60%)",
    },
    amount: {
      label: "Omset",
      color: isDarkMode ? "hsl(var(--chart-2))" : "hsl(215, 90%, 57%)",
    },
  } satisfies ChartConfig

  return (
    <Card className={isDarkMode ? "bg-[#121212] text-white border-gray-800" : "bg-white text-gray-900 border-gray-200"}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className={isDarkMode ? "text-white text-base" : "text-gray-900 text-base"}>
            {showAmount ? 'Omset per Produk' : 'Penjualan per Produk'}
          </CardTitle>
        </div>
        
        {/* Dropdown untuk tampilan mobile */}
        <div className="sm:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className={`h-8 w-8 ${isDarkMode ? "text-white" : "text-gray-700"}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={isDarkMode ? "bg-[#1e1e1e] text-white border-gray-700" : "bg-white text-gray-900 border-gray-200"}>
              <DropdownMenuItem className={isDarkMode ? "opacity-50 cursor-default" : "opacity-70 cursor-default"}>
                Jumlah Produk
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setLimit(5)}
                className={limit === 5 ? (isDarkMode ? "bg-blue-900/30 text-blue-300" : "bg-blue-50 text-blue-700") : ""}
              >
                Top 5
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setLimit(10)}
                className={limit === 10 ? (isDarkMode ? "bg-blue-900/30 text-blue-300" : "bg-blue-50 text-blue-700") : ""}
              >
                Top 10
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setLimit(20)}
                className={limit === 20 ? (isDarkMode ? "bg-blue-900/30 text-blue-300" : "bg-blue-50 text-blue-700") : ""}
              >
                Top 20
              </DropdownMenuItem>
              
              <DropdownMenuSeparator className={isDarkMode ? "bg-gray-700" : "bg-gray-200"} />
              
              <DropdownMenuItem className={isDarkMode ? "opacity-50 cursor-default" : "opacity-70 cursor-default"}>
                Tampilkan
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setShowAmount(false)}
                className={!showAmount ? (isDarkMode ? "bg-blue-900/30 text-blue-300" : "bg-blue-50 text-blue-700") : ""}
              >
                Jumlah
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setShowAmount(true)}
                className={showAmount ? (isDarkMode ? "bg-blue-900/30 text-blue-300" : "bg-blue-50 text-blue-700") : ""}
              >
                Omset
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Toggle untuk tampilan desktop */}
        <div className="hidden sm:flex gap-2 flex-wrap justify-end">
          <div className={`flex gap-1 border rounded-md p-1 ${isDarkMode ? "border-gray-700 bg-[#121212]" : "border-gray-200 bg-gray-50"}`}>
            <Button
              variant={limit === 5 ? "default" : "ghost"}
              size="sm"
              onClick={() => setLimit(5)}
              className="h-7 text-xs px-2"
            >
              Top 5
            </Button>
            <Button
              variant={limit === 10 ? "default" : "ghost"}
              size="sm"
              onClick={() => setLimit(10)}
              className="h-7 text-xs px-2"
            >
              Top 10
            </Button>
            <Button
              variant={limit === 20 ? "default" : "ghost"}
              size="sm"
              onClick={() => setLimit(20)}
              className="h-7 text-xs px-2"
            >
              Top 20
            </Button>
          </div>
          
          <div className={`flex gap-1 border rounded-md p-1 ${isDarkMode ? "border-gray-700 bg-[#121212]" : "border-gray-200 bg-gray-50"}`}>
            <Button
              variant={showAmount ? "ghost" : "default"}
              size="sm"
              onClick={() => setShowAmount(false)}
              className="h-7 text-xs px-2"
            >
              Jumlah
            </Button>
            <Button
              variant={showAmount ? "default" : "ghost"}
              size="sm"
              onClick={() => setShowAmount(true)}
              className="h-7 text-xs px-2"
            >
              Omset
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {/* Flexbox layout for the chart and footer */}
      <div className="flex flex-col flex-1">
        <CardContent className="flex-1 p-2">
          <div className="w-full" style={{ height: 'calc(100% - 20px)' }}>
            <ChartContainer config={chartConfig}>
              <ResponsiveContainer width="100%" height={limit <= 5 ? 200 : 240}>
                <BarChart 
                  data={chartData}
                  margin={{ top: 15, right: 0, left: 0, bottom: limit === 20 ? 30 : 15 }}
                  barGap={2}
                  maxBarSize={40}
                >
                  <CartesianGrid vertical={false} stroke={chartColors.grid} />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    tickMargin={3}
                    axisLine={false}
                    angle={limit === 20 ? -45 : 0}
                    textAnchor={limit === 20 ? "end" : "middle"}
                    height={limit === 20 ? 35 : 25}
                    interval={0}
                    tick={{ fontSize: 9, fill: chartColors.label }}
                    tickFormatter={(value) => {
                      // Simplifikasi format label
                      if (limit === 5) {
                        return value.length > 10 ? value.substring(0, 10) + '...' : value;
                      } else if (limit === 10) {
                        return value.length > 6 ? value.substring(0, 6) + '...' : value;
                      } else {
                        return value.length > 4 ? value.substring(0, 4) + '...' : value;
                      }
                    }}
                  />
                  <Tooltip
                    cursor={{ fill: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
                    content={<CustomTooltip />}
                    contentStyle={{
                      backgroundColor: chartColors.tooltip.bg,
                      color: chartColors.tooltip.text,
                      border: `1px solid ${chartColors.tooltip.border}`,
                    }}
                  />
                  {showAmount ? (
                    <Bar dataKey="amount" fill={chartColors.bar} radius={4}>
                      <LabelList
                        dataKey="amount"
                        position="top"
                        offset={5}
                        className={isDarkMode ? "fill-white" : "fill-gray-700"}
                        fontSize={9}
                        formatter={(value: number) => formatAmountLabel(value)}
                        angle={limit === 20 ? -45 : 0}
                      />
                    </Bar>
                  ) : (
                    <Bar dataKey="quantity" fill={chartColors.bar} radius={4}>
                      <LabelList
                        dataKey="quantity"
                        position="top"
                        offset={5}
                        className={isDarkMode ? "fill-white" : "fill-gray-700"}
                        fontSize={9}
                        angle={limit === 20 ? -45 : 0}
                      />
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
        
        <CardFooter className="pt-0 pb-3 px-4">
          <div className="flex flex-col w-full gap-1">
            <div className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-900"}`}>
              {isTrendingUp ? (
                <div className="flex items-center">
                  Produk teratas mendominasi
                  <span className={`mx-1 ${isDarkMode ? "text-green-400" : "text-green-600"}`}>{topProductPercentage}%</span>
                  penjualan
                  <TrendingUp className={`h-4 w-4 ml-1 ${isDarkMode ? "text-green-400" : "text-green-600"}`} />
                </div>
              ) : (
                <div className="flex items-center">
                  Penjualan terdistribusi merata
                  <TrendingDown className={`h-4 w-4 ml-1 ${isDarkMode ? "text-red-400" : "text-red-500"}`} />
                </div>
              )}
            </div>
            <div className={`${isDarkMode ? "text-gray-400" : "text-gray-500"} text-sm`}>
              {showAmount 
                ? `Total omset: ${formatRupiah(totalAmount)}`
                : `Total penjualan: ${totalQuantity} unit`
              }
            </div>
          </div>
        </CardFooter>
      </div>
    </Card>
  )
} 