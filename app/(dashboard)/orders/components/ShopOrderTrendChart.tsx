'use client'

import { useState } from "react"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Order } from "@/app/hooks/useOrders"

interface ChartData {
  date: string
  total: number
  totalAmount: number
  [shopName: string]: number | string
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

// Fungsi untuk mengolah data orders menjadi format chart
const processOrdersData = (orders: Order[], showAmount: boolean): ChartData[] => {
  const shopNames = Array.from(new Set(orders.map(order => order.shop_name)))
  
  const groupedData = orders.reduce((acc: { [key: string]: ChartData }, order) => {
    const date = new Date(order.create_time * 1000).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short'
    })
    
    if (!acc[date]) {
      acc[date] = {
        date,
        total: 0,
        totalAmount: 0,
        ...Object.fromEntries(shopNames.map(shop => [shop, 0]))
      }
    }
    
    if (order.order_status !== 'CANCELLED' && order.cancel_reason !== 'Failed Delivery') {
      const value = showAmount ? parseFloat(order.total_amount) : 1
      acc[date][order.shop_name] = (acc[date][order.shop_name] as number) + value
      acc[date].total += 1
      acc[date].totalAmount += parseFloat(order.total_amount)
    }
    
    return acc
  }, {})
  
  return Object.values(groupedData).sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  ).reverse()
}

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label, showAmount }: any) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum: number, entry: any) => 
      sum + (entry.value || 0), 0
    )

    return (
      <div className="rounded-lg border bg-background p-3 shadow-sm">
        <p className="text-sm font-medium mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-8">
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-muted-foreground">
                  {entry.name}
                </span>
              </div>
              <span className="text-xs font-medium">
                {showAmount 
                  ? formatRupiah(entry.value)
                  : `${entry.value} pesanan`
                }
              </span>
            </div>
          ))}
          <div className="border-t mt-2 pt-2">
            <div className="flex items-center justify-between gap-8">
              <span className="text-xs font-medium text-muted-foreground">
                Total
              </span>
              <span className="text-xs font-bold">
                {showAmount 
                  ? formatRupiah(total)
                  : `${total} pesanan`
                }
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }
  return null
}

// Komponen Chart
export const ShopOrderTrendChart = ({ orders }: { orders: Order[] }) => {
  const [showAmount, setShowAmount] = useState(false)
  const [selectedShops, setSelectedShops] = useState<string[]>([])
  
  const shopNames = Array.from(new Set(orders.map(order => order.shop_name)))
  const data = processOrdersData(orders, showAmount)
  
  // Warna untuk setiap toko
  const colors = [
    "#2563eb", // blue
    "#16a34a", // green
    "#dc2626", // red
    "#9333ea", // purple
    "#eab308", // yellow
    "#0891b2", // cyan
    "#db2777", // pink
    "#ea580c", // orange
    "#4f46e5", // indigo
    "#84cc16", // lime
  ]

  // Hitung perubahan persentase
  const getPercentageChange = () => {
    if (data.length < 2) return 0
    
    const currentTotal = Object.entries(data[data.length - 1])
      .filter(([key]) => key !== 'date' && key !== 'total' && key !== 'totalAmount')
      .reduce((sum, [key, value]) => 
        selectedShops.length === 0 || selectedShops.includes(key) 
          ? sum + (value as number) 
          : sum
      , 0)
    
    const previousTotal = Object.entries(data[data.length - 2])
      .filter(([key]) => key !== 'date' && key !== 'total' && key !== 'totalAmount')
      .reduce((sum, [key, value]) => 
        selectedShops.length === 0 || selectedShops.includes(key) 
          ? sum + (value as number) 
          : sum
      , 0)
    
    if (previousTotal === 0) return 100
    return ((currentTotal - previousTotal) / previousTotal) * 100
  }

  const percentageChange = getPercentageChange()

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium">
            {showAmount ? 'Tren Omset per Toko' : 'Tren Pesanan per Toko'}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {percentageChange > 0 ? '↑' : '↓'} {Math.abs(percentageChange).toFixed(1)}% dibanding hari sebelumnya
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={showAmount ? "outline" : "default"}
            size="sm"
            onClick={() => setShowAmount(false)}
          >
            Jumlah
          </Button>
          <Button
            variant={showAmount ? "default" : "outline"}
            size="sm"
            onClick={() => setShowAmount(true)}
          >
            Omset
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          {shopNames.map((shop, index) => (
            <Button
              key={shop}
              variant={selectedShops.includes(shop) ? "default" : "outline"}
              size="sm"
              onClick={() => {
                if (selectedShops.includes(shop)) {
                  setSelectedShops(prev => prev.filter(s => s !== shop))
                } else {
                  setSelectedShops(prev => [...prev, shop])
                }
              }}
              style={{
                borderColor: colors[index % colors.length],
                color: selectedShops.includes(shop) ? 'white' : colors[index % colors.length],
                backgroundColor: selectedShops.includes(shop) ? colors[index % colors.length] : 'transparent'
              }}
            >
              {shop}
            </Button>
          ))}
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="#666" 
                strokeOpacity={0.1}
              />
              <XAxis 
                dataKey="date"
                tickLine={false}
                axisLine={false}
                fontSize={12}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={12}
                tickMargin={8}
                tickFormatter={(value) => 
                  showAmount 
                    ? formatRupiah(value).split('Rp')[1]
                    : value.toString()
                }
              />
              <Tooltip content={<CustomTooltip showAmount={showAmount} />} />
              <Legend />
              {shopNames
                .filter(shop => selectedShops.length === 0 || selectedShops.includes(shop))
                .map((shop, index) => (
                  <Line
                    key={shop}
                    type="monotone"
                    dataKey={shop}
                    name={shop}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))
              }
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
} 