'use client'

import { useState } from "react"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, LabelList } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown } from "lucide-react"
import type { Order } from "@/app/hooks/useOrders"

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
    
    if (order.order_status !== 'CANCELLED' && 
        order.order_status !== 'UNPAID' && 
        order.cancel_reason !== 'Failed Delivery') {
      shopMap[shopName].quantity += 1 // Tambah 1 pesanan
      shopMap[shopName].amount += parseFloat(order.total_amount)
    }
  })
  
  // Konversi ke array dan urutkan
  return Object.values(shopMap)
    .sort((a, b) => b.quantity - a.quantity) // Urutkan berdasarkan jumlah pesanan
}

// Custom Tooltip Component
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    
    return (
      <div className="rounded-lg border border-gray-800 bg-[#1e1e1e] p-2 shadow-sm text-white">
        <div className="grid gap-2">
          <div className="flex flex-col">
            <span className="text-[0.70rem] uppercase text-gray-400">
              TOKO
            </span>
            <span className="font-bold text-xs">
              {data.name}
            </span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-[0.70rem] uppercase text-gray-400">
              JUMLAH PESANAN
            </span>
            <span className="font-bold text-xs">
              {data.quantity} pesanan
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
export const ShopOrderChart = ({ orders }: { orders: Order[] }) => {
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
  const totalOrders = orders.filter(order => 
    order.order_status !== 'CANCELLED' && 
    order.order_status !== 'UNPAID' && 
    order.cancel_reason !== 'Failed Delivery'
  ).length
  
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
  
  return (
    <Card className="bg-[#121212] text-white border-gray-800">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium text-white">
            {showAmount ? 'Omset per Toko' : 'Pesanan per Toko' } {'(' + sortedData.length + ')'}
          </CardTitle>
          
        </div>
        <div className="flex gap-2">
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
        <div className="h-[300px] overflow-y-auto">
          <div className="min-h-[300px]" style={{ height: `${Math.max(300, sortedData.length * 40)}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sortedData}
                layout="vertical"
                margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
                barCategoryGap={16}
                barGap={8}
              >
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  horizontal={true} 
                  vertical={false}
                  stroke="#333333" 
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
                  cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }}
                />
                <Bar
                  dataKey={showAmount ? "amount" : "quantity"}
                  fill="#4169E1"
                  radius={8}
                  barSize={30}
                  minPointSize={60}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="shortName"
                    position="insideLeft"
                    offset={8}
                    className="fill-white"
                    fontSize={12}
                    formatter={(value: string) => {
                      return value.length > 12 ? value.substring(0, 12) + '...' : value;
                    }}
                  />
                  <LabelList
                    dataKey={showAmount ? "amount" : "quantity"}
                    position="right"
                    offset={8}
                    className="fill-white"
                    fontSize={12}
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
        <div className="flex gap-2 font-medium leading-none items-center text-white">
          {top3Percentage > 70 ? (
            <>
              3 toko teratas menghasilkan {top3Percentage}% pesanan
              <TrendingUp className="h-4 w-4 text-yellow-400 ml-1" />
            </>
          ) : (
            <>
              3 toko teratas memiliki porsi {top3Percentage}%
              <TrendingDown className="h-4 w-4 text-blue-400 ml-1" />
            </>
          )}
        </div>
        <div className="leading-none text-gray-400">
          {showAmount 
            ? `Total omset: ${formatRupiah(totalAmount)}`
            : `Total pesanan: ${totalOrders} pesanan`
          }
        </div>
      </CardFooter>
    </Card>
  )
} 