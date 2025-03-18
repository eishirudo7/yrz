'use client'

import { useState } from "react"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, LabelList } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, MoreHorizontal } from "lucide-react"
import type { Order } from "@/app/hooks/useOrders"
import { useTheme } from "next-themes"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ShopData {
  name: string
  shortName: string
  quantity: number
  amount: number
}

// Fungsi untuk mendapatkan kata pertama dari nama toko
const getFirstWord = (shopName: string): string => {
  // Split berdasarkan spasi dan ambil kata pertama
  const words = shopName.trim().split(/\s+/);
  return words[0];
};

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

// Fungsi untuk memproses data toko
const processShopData = (orders: Order[]): ShopData[] => {
  // Kumpulkan data penjualan per toko
  const shopMap: Record<string, ShopData> = {}
  
  orders.forEach(order => {
    const shopName = order.shop_name || 'Tidak Diketahui'
    
    if (!shopMap[shopName]) {
      shopMap[shopName] = {
        name: shopName,
        shortName: getFirstWord(shopName),
        quantity: 0,
        amount: 0
      }
    }
    
    shopMap[shopName].quantity += 1 // Tambah 1 pesanan
    shopMap[shopName].amount += parseFloat(order.total_amount)
  })
  
  // Konversi ke array dan urutkan
  return Object.values(shopMap)
    .sort((a, b) => b.quantity - a.quantity) // Urutkan berdasarkan jumlah pesanan
}

// Custom Tooltip Component
const CustomTooltip = ({ active, payload }: any) => {
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
              TOKO
            </span>
            <span className="font-bold text-xs">
              {data.name}
            </span>
          </div>
          
          <div className="flex flex-col">
            <span className={`text-[0.70rem] uppercase ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
              JUMLAH PESANAN
            </span>
            <span className="font-bold text-xs">
              {data.quantity} pesanan
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
export const ShopOrderChart = ({ orders }: { orders: Order[] }) => {
  const { theme } = useTheme()
  const isDarkMode = theme === 'dark'
  const [showAmount, setShowAmount] = useState(false)
  
  // Proses dan urutkan data
  const data = processShopData(orders)
  
  // Urutkan data berdasarkan jumlah atau omset
  const sortedData = [...data].sort((a, b) => {
    if (showAmount) {
      return b.amount - a.amount; // Urutkan berdasarkan omset jika mode omset aktif
    }
    return b.quantity - a.quantity; // Urutkan berdasarkan jumlah jika mode jumlah aktif
  });
  
  // Hitung total pesanan langsung dari data mentah dengan filter yang sama
  const totalOrders = orders.length  // Perubahan di sini, karena sudah difilter
  
  // Hitung total amount dari data yang sudah diproses
  const totalAmount = sortedData.reduce((sum, item) => sum + item.amount, 0)
  
  // Hitung persentase toko teratas
  const topShopPercentage = sortedData.length > 0 && totalOrders > 0
    ? Math.round((sortedData[0].quantity / totalOrders) * 100) 
    : 0
  
  // Tentukan apakah tren terkonsentrasi atau terdistribusi
  const isConcentrated = topShopPercentage > 30
  
  // Hitung nilai maksimum untuk menentukan domain
  const maxValue = showAmount 
    ? Math.max(...sortedData.map(item => item.amount))
    : Math.max(...sortedData.map(item => item.quantity));
  
  // Hitung persentase 3 toko teratas
  const calculateTop3Percentage = () => {
    if (sortedData.length <= 1) return 100;
    
    const totalOrders = sortedData.reduce((sum, shop) => sum + shop.quantity, 0);
    const top3Orders = sortedData.slice(0, 3).reduce((sum, shop) => sum + shop.quantity, 0);
    
    return Math.round((top3Orders / totalOrders) * 100);
  };

  const top3Percentage = calculateTop3Percentage();
  
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
    label: {
      text: isDarkMode ? "#ffffff" : "#333333",
      value: isDarkMode ? "#AAAAAA" : "#666666"
    },
    trend: {
      up: isDarkMode ? "#FFCA28" : "#F59E0B",
      down: isDarkMode ? "#64B5F6" : "#3B82F6"
    }
  }
  
  return (
    <Card className={isDarkMode ? "bg-[#121212] text-white border-gray-800" : "bg-white text-gray-900 border-gray-200"}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className={`text-base font-medium ${isDarkMode ? "text-white" : "text-gray-900"}`}>
            {showAmount ? 'Omset per Toko' : 'Pesanan per Toko' } {'(' + sortedData.length + ')'}
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
              <DropdownMenuItem 
                onClick={() => setShowAmount(false)}
                className={!showAmount ? (isDarkMode ? "bg-blue-900/30 text-blue-300" : "bg-blue-50 text-blue-700") : ""}
              >
                Tampilkan Jumlah
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setShowAmount(true)}
                className={showAmount ? (isDarkMode ? "bg-blue-900/30 text-blue-300" : "bg-blue-50 text-blue-700") : ""}
              >
                Tampilkan Omset
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Toggle untuk tampilan desktop */}
        <div className={`hidden sm:flex gap-1 border rounded-md p-1 ${isDarkMode ? "border-gray-700 bg-[#121212]" : "border-gray-200 bg-gray-50"}`}>
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
      </CardHeader>
      <CardContent>
        <div className="h-[300px] overflow-y-auto">
          <div className="min-h-[300px]" style={{ height: `${Math.max(300, Math.min(sortedData.length * 40, 600))}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sortedData}
                layout="vertical"
                margin={{ top: 5, right: 10, left: 5, bottom: 5 }}
                barCategoryGap={8}
                barGap={4}
              >
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  horizontal={true} 
                  vertical={false}
                  stroke={chartColors.grid} 
                  strokeOpacity={0.5}
                />
                <XAxis
                  type="number"
                  hide={true}
                  domain={[0, maxValue * 1.1]} // Sedikit lebih besar dari nilai maksimum
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  hide={true}
                  width={150}
                />
                <Tooltip 
                  content={<CustomTooltip />} 
                  cursor={{ fill: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
                  contentStyle={{
                    backgroundColor: chartColors.tooltip.bg,
                    color: chartColors.tooltip.text,
                    border: `1px solid ${chartColors.tooltip.border}`,
                  }}
                />
                <Bar
                  dataKey={showAmount ? "amount" : "quantity"}
                  fill={chartColors.bar}
                  radius={8}
                  barSize={24}
                  minPointSize={40}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="shortName"
                    position="insideLeft"
                    offset={8}
                    className={isDarkMode ? "fill-white" : "fill-gray-900"}
                    fontSize={10}
                    formatter={(value: string) => {
                      return value.length > 10 ? value.substring(0, 10) + '...' : value;
                    }}
                  />
                  <LabelList
                    dataKey={showAmount ? "amount" : "quantity"}
                    position="right"
                    offset={5}
                    className={isDarkMode ? "fill-white" : "fill-gray-900"}
                    fontSize={10}
                    formatter={(value: number) => 
                      showAmount ? formatAmountLabel(value) : value
                    }
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className={`flex gap-2 font-medium leading-none items-center ${isDarkMode ? "text-white" : "text-gray-900"}`}>
          {top3Percentage > 70 ? (
            <>
              3 toko teratas menghasilkan {top3Percentage}% pesanan
              <TrendingUp className={`h-4 w-4 ${isDarkMode ? "text-yellow-400" : "text-amber-500"} ml-1`} />
            </>
          ) : (
            <>
              3 toko teratas memiliki porsi {top3Percentage}%
              <TrendingDown className={`h-4 w-4 ${isDarkMode ? "text-blue-400" : "text-blue-500"} ml-1`} />
            </>
          )}
        </div>
        <div className={`leading-none ${isDarkMode ? "text-gray-400" : "text-gray-500"} text-xs`}>
          {showAmount 
            ? `Total omset: ${formatRupiah(totalAmount)}`
            : `Total pesanan: ${totalOrders} pesanan`
          }
        </div>
      </CardFooter>
    </Card>
  )
} 