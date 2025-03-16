'use client'

import { useState } from "react"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Order } from "@/app/hooks/useOrders"

interface ChartData {
  date: string
  orders: number
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

// Fungsi untuk mengolah data orders menjadi format chart
const processOrdersData = (orders: Order[]): ChartData[] => {
  const groupedData = orders.reduce((acc: { [key: string]: ChartData }, order) => {
    const date = new Date(order.create_time * 1000).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short'
    })
    
    if (!acc[date]) {
      acc[date] = {
        date,
        orders: 0,
        amount: 0
      }
    }
    
    // Hanya hitung pesanan yang tidak dibatalkan dan bukan COD gagal
    if (order.order_status !== 'CANCELLED' && order.cancel_reason !== 'Failed Delivery') {
      acc[date].orders += 1
      acc[date].amount += parseFloat(order.total_amount)
    }
    
    return acc
  }, {})
  
  // Ubah pengurutan menjadi dari yang terlama ke terbaru
  return Object.values(groupedData).sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  ).reverse() // Tambahkan reverse() untuk membalik urutan
}

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col">
            <span className="text-[0.70rem] uppercase text-muted-foreground">
              Tanggal
            </span>
            <span className="font-bold text-xs">
              {label}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[0.70rem] uppercase text-muted-foreground">
              {payload[0].name}
            </span>
            <span className="font-bold text-xs">
              {payload[0].name === "Jumlah Pesanan"
                ? payload[0].value
                : formatRupiah(payload[0].value)
              }
            </span>
          </div>
        </div>
      </div>
    )
  }
  return null
}

// Komponen Chart
export const OrderTrendChart = ({ orders }: { orders: Order[] }) => {
  const [showAmount, setShowAmount] = useState(false)
  const data = processOrdersData(orders)
  
  // Hitung perubahan persentase
  const getPercentageChange = () => {
    if (data.length < 2) return 0
    
    const currentValue = showAmount 
      ? data[data.length - 1].amount 
      : data[data.length - 1].orders
    const previousValue = showAmount 
      ? data[data.length - 2].amount 
      : data[data.length - 2].orders
    
    if (previousValue === 0) return 100
    
    return ((currentValue - previousValue) / previousValue) * 100
  }
  
  const percentageChange = getPercentageChange()
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium">
            {showAmount ? 'Tren Omset' : 'Tren Pesanan'}
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
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
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
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey={showAmount ? "amount" : "orders"}
                name={showAmount ? "Total Omset" : "Jumlah Pesanan"}
                stroke={showAmount ? "#16a34a" : "#2563eb"}
                fill={showAmount ? "#16a34a" : "#2563eb"}
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
} 