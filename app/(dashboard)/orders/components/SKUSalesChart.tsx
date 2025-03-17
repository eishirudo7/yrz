'use client'

import { useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, ResponsiveContainer, Tooltip, LabelList } from "recharts"
import { TrendingUp, TrendingDown } from "lucide-react"
import type { Order } from "@/app/hooks/useOrders"

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
    // Filter untuk UNPAID
    if (order.order_status === 'CANCELLED' || 
        order.order_status === 'UNPAID' || 
        order.cancel_reason === 'Failed Delivery') {
      return;
    }
    
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
  if (active && payload && payload.length) {
    const data = payload[0].payload
    
    return (
      <div className="rounded-lg border border-gray-800 bg-[#1e1e1e] p-2 shadow-sm text-white">
        <div className="grid gap-2">
          <div className="flex flex-col">
            <span className="text-[0.70rem] uppercase text-gray-400">
              PRODUK
            </span>
            <span className="font-bold text-xs">
              {label}
            </span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-[0.70rem] uppercase text-gray-400">
              JUMLAH TERJUAL
            </span>
            <span className="font-bold text-xs">
              {data.quantity} unit
            </span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-[0.70rem] uppercase text-gray-400">
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
  
  const chartConfig = {
    quantity: {
      label: "Jumlah",
      color: "hsl(var(--chart-1))",
    },
    amount: {
      label: "Omset",
      color: "hsl(var(--chart-2))",
    },
  } satisfies ChartConfig

  return (
    <Card className="bg-[#121212] text-white border-gray-800">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-white">{showAmount ? 'Omset per Produk' : 'Penjualan per Produk'}</CardTitle>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 border border-gray-700 rounded-md p-1 bg-[#121212]">
            <Button
              variant={limit === 5 ? "default" : "ghost"}
              size="sm"
              onClick={() => setLimit(5)}
              className="h-7 text-xs"
            >
              Top 5
            </Button>
            <Button
              variant={limit === 10 ? "default" : "ghost"}
              size="sm"
              onClick={() => setLimit(10)}
              className="h-7 text-xs"
            >
              Top 10
            </Button>
            <Button
              variant={limit === 20 ? "default" : "ghost"}
              size="sm"
              onClick={() => setLimit(20)}
              className="h-7 text-xs"
            >
              Top 20
            </Button>
          </div>
          
          <div className="flex gap-1 border border-gray-700 rounded-md p-1 bg-[#121212]">
            <Button
              variant={showAmount ? "ghost" : "default"}
              size="sm"
              onClick={() => setShowAmount(false)}
              className="h-7 text-xs"
            >
              Jumlah
            </Button>
            <Button
              variant={showAmount ? "default" : "ghost"}
              size="sm"
              onClick={() => setShowAmount(true)}
              className="h-7 text-xs"
            >
              Omset
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ChartContainer config={chartConfig}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={chartData}
                margin={{ top: 20, right: 10, left: 10, bottom: 1 }}
              >
                <CartesianGrid vertical={false} stroke="#333333" />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  angle={limit === 20 ? -45 : 0}
                  textAnchor={limit === 20 ? "end" : "middle"}
                  height={limit === 20 ? 80 : 40}
                  interval={0}
                  tick={{ fontSize: 12, fill: "#AAAAAA" }}
                  tickFormatter={(value) => {
                    if (limit === 5) {
                      return value.length > 20 ? value.substring(0, 20) + '...' : value;
                    } else if (limit === 10) {
                      return value.length > 6 ? value.substring(0, 6) + '...' : value;
                    } else {
                      return value.length > 15 ? value.substring(0, 15) + '...' : value;
                    }
                  }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }}
                  content={<CustomTooltip />}
                />
                {showAmount ? (
                  <Bar dataKey="amount" fill="#4169E1" radius={8}>
                    <LabelList
                      dataKey="amount"
                      position="top"
                      offset={12}
                      className="fill-white"
                      fontSize={12}
                      formatter={(value: number) => formatAmountLabel(value)}
                      angle={limit === 20 && showAmount ? -45 : 0}
                    />
                  </Bar>
                ) : (
                  <Bar dataKey="quantity" fill="#4169E1" radius={8}>
                    <LabelList
                      dataKey="quantity"
                      position="top"
                      offset={12}
                      className="fill-white"
                      fontSize={12}
                      angle={limit === 20 && !showAmount ? -45 : 0}
                    />
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 font-medium leading-none items-center text-white">
          {isTrendingUp ? (
            <>
              Produk teratas mendominasi 
              <span className="text-green-400 mx-1">{topProductPercentage}%</span> 
              penjualan 
              <TrendingUp className="h-4 w-4 text-green-400 ml-1" />
            </>
          ) : (
            <>
              Penjualan terdistribusi merata 
              <TrendingDown className="h-4 w-4 text-red-400 ml-1" />
            </>
          )}
        </div>
        <div className="leading-none text-gray-400">
          {showAmount 
            ? `Total omset: ${formatRupiah(totalAmount)}`
            : `Total penjualan: ${totalQuantity} unit`
          }
        </div>
      </CardFooter>
    </Card>
  )
} 