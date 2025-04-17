'use client'

import { useState, useEffect, useContext } from "react"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, LabelList } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
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

interface ChartData {
  date: string
  time?: string
  datetime: string
  orders: number
  amount: number
}

type TimeFrame = 'hour' | 'day' | 'weekly'

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
const processOrdersData = (orders: Order[], timeframe: TimeFrame): ChartData[] => {
  if (!orders || orders.length === 0) {
    return [];
  }

  const getOrderTimestamp = (order: Order): number => {
    // Untuk pesanan COD, selalu gunakan create_time
    if (order.cod) {
      return order.create_time;
    }
    // Untuk non-COD, gunakan pay_time jika ada, jika tidak ada gunakan create_time
    return order.pay_time || order.create_time;
  };

  if (timeframe === 'hour') {
    // Inisialisasi array untuk 24 jam
    const hourlyTotals: ChartData[] = Array.from({ length: 24 }, (_, hour) => ({
      date: '',
      time: `${hour.toString().padStart(2, '0')}:00`,
      datetime: new Date().setHours(hour, 0, 0, 0).toString(),
      orders: 0,
      amount: 0
    }));

    // Kelompokkan orders berdasarkan jam
    orders.forEach(order => {
      const orderDate = new Date(getOrderTimestamp(order) * 1000);
      const hour = orderDate.getHours();
      hourlyTotals[hour].orders += 1;
      hourlyTotals[hour].amount += parseFloat(order.total_amount);
    });

    return hourlyTotals;
  } else if (timeframe === 'day') {
    // Urutkan orders berdasarkan timestamp
    const sortedOrders = [...orders].sort((a, b) => getOrderTimestamp(a) - getOrderTimestamp(b));
    
    // Tentukan rentang tanggal
    const firstOrder = new Date(getOrderTimestamp(sortedOrders[0]) * 1000);
    const lastOrder = new Date(getOrderTimestamp(sortedOrders[sortedOrders.length - 1]) * 1000);
    
    // Set ke awal dan akhir hari
    const startDate = new Date(firstOrder);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(lastOrder);
    endDate.setHours(23, 59, 59, 999);

    // Buat array untuk menyimpan data
    const dailyData: ChartData[] = [];
    const currentDate = new Date(startDate);

    // Generate data untuk setiap hari dalam rentang waktu
    while (currentDate <= endDate) {
      const displayDate = currentDate.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
      });

      dailyData.push({
        date: displayDate,
        datetime: currentDate.toISOString(),
        orders: 0,
        amount: 0
      });

      // Tambah 1 hari
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Kelompokkan orders ke dalam hari yang sesuai
    sortedOrders.forEach(order => {
      const orderDate = new Date(getOrderTimestamp(order) * 1000);
      const orderDateStr = orderDate.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
      });
      
      const dayData = dailyData.find(d => d.date === orderDateStr);
      if (dayData) {
        dayData.orders += 1;
        dayData.amount += parseFloat(order.total_amount);
      }
    });

    return dailyData;
  } else {
    // Logika untuk tampilan mingguan
    const sortedOrders = [...orders].sort((a, b) => getOrderTimestamp(a) - getOrderTimestamp(b));
    if (sortedOrders.length === 0) return [];

    // Tentukan rentang minggu
    const firstOrder = new Date(getOrderTimestamp(sortedOrders[0]) * 1000);
    const lastOrder = new Date(getOrderTimestamp(sortedOrders[sortedOrders.length - 1]) * 1000);

    // Set ke awal minggu (Senin) dan akhir minggu (Minggu)
    const startDate = new Date(firstOrder);
    startDate.setDate(startDate.getDate() - startDate.getDay() + (startDate.getDay() === 0 ? -6 : 1)); // Mulai dari Senin
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(lastOrder);
    endDate.setDate(endDate.getDate() + (7 - endDate.getDay())); // Sampai Minggu
    endDate.setHours(23, 59, 59, 999);

    // Buat array untuk menyimpan data mingguan
    const weeklyData: ChartData[] = [];
    const currentDate = new Date(startDate);

    // Generate data untuk setiap minggu dalam rentang waktu
    while (currentDate <= endDate) {
      const weekStart = new Date(currentDate);
      const weekEnd = new Date(currentDate);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const weekLabel = `${weekStart.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short'
      })} - ${weekEnd.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short'
      })}`;

      weeklyData.push({
        date: weekLabel,
        datetime: currentDate.toISOString(),
        orders: 0,
        amount: 0
      });

      // Pindah ke minggu berikutnya
      currentDate.setDate(currentDate.getDate() + 7);
    }

    // Kelompokkan orders ke dalam minggu yang sesuai
    sortedOrders.forEach(order => {
      const orderDate = new Date(getOrderTimestamp(order) * 1000);
      
      // Cari minggu yang sesuai
      const weekData = weeklyData.find(week => {
        const weekStart = new Date(week.datetime);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        
        return orderDate >= weekStart && orderDate <= weekEnd;
      });

      if (weekData) {
        weekData.orders += 1;
        weekData.amount += parseFloat(order.total_amount);
      }
    });

    return weeklyData;
  }
}

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label, timeframe }: any) => {
  const { theme } = useTheme()
  const isDarkMode = theme === 'dark'
  
  if (active && payload && payload.length) {
    // Ambil data lengkap dari payload
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
              {timeframe === 'hour' ? 'RENTANG WAKTU' : 'TANGGAL'}
            </span>
            <span className="font-bold text-xs">
              {timeframe === 'hour' 
                ? `${getPreviousHour(label)} - ${label}`  // Contoh: "08:00 - 09:00"
                : `${label} (00:00 - 23:59)`}
            </span>
          </div>
          
          {/* Tampilkan jumlah pesanan */}
          <div className="flex flex-col">
            <span className={`text-[0.70rem] uppercase ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
              JUMLAH PESANAN
            </span>
            <span className="font-bold text-xs">
              {data.orders} pesanan
            </span>
          </div>
          
          {/* Tampilkan total omset */}
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

// Helper function untuk mendapatkan jam sebelumnya
const getPreviousHour = (timeStr: string) => {
  const [hour] = timeStr.split(':')
  const prevHour = (parseInt(hour) - 1 + 24) % 24
  return `${prevHour.toString().padStart(2, '0')}:00`
}

// Tambahkan fungsi untuk menghitung interval yang lebih fleksibel
const calculateHourInterval = (dataLength: number) => {
  // Untuk data <= 12 jam, tampilkan semua
  if (dataLength <= 12) return 0
  
  // Untuk data > 12 jam, hitung interval yang optimal
  // Kita ingin menampilkan sekitar 8-12 label untuk keterbacaan yang baik
  const idealInterval = Math.ceil(dataLength / 10)
  
  // Bulatkan ke atas ke kelipatan 2 untuk interval yang lebih rapi
  return Math.ceil(idealInterval / 2) * 2
}

// Tambah konstanta untuk batasan
const MAX_DAILY_RANGE = 31 // maksimal 31 hari
const MAX_HOURLY_RANGE = 7 // maksimal 2 hari untuk view per jam

// Modifikasi fungsi shouldUseHourlyView
const getViewRecommendation = (orders: Order[]): {
  allowHourly: boolean;
  allowDaily: boolean;
  message?: string;
} => {
  if (orders.length === 0) return { allowHourly: true, allowDaily: true }
  
  const dates = orders.map(order => new Date(order.create_time * 1000))
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))
  
  // Set waktu ke tengah malam untuk perbandingan yang akurat
  minDate.setHours(0, 0, 0, 0)
  maxDate.setHours(0, 0, 0, 0)
  
  // Hitung selisih hari
  const diffDays = Math.floor((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24))
  
  return {
    allowHourly: diffDays <= MAX_HOURLY_RANGE,
    allowDaily: diffDays <= MAX_DAILY_RANGE,
    message: diffDays > MAX_DAILY_RANGE 
      ? 'Rentang waktu terlalu panjang, maksimal 31 hari'
      : undefined
  }
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

// Komponen Chart
export const OrderTrendChart = ({ orders }: { orders: Order[] }) => {
  const { theme } = useTheme()
  const isDarkMode = theme === 'dark'
  
  const viewRecommendation = getViewRecommendation(orders)
  const defaultTimeframe = viewRecommendation.allowHourly ? 'hour' : 'day'
  
  const [showAmount, setShowAmount] = useState(false)
  const [timeframe, setTimeframe] = useState<TimeFrame>(defaultTimeframe)
  const data = processOrdersData(orders, timeframe)
  
  // Hitung total dan rata-rata untuk periode yang ditampilkan
  const totalPeriodOrders = data.reduce((sum, item) => sum + item.orders, 0)
  const totalPeriodAmount = data.reduce((sum, item) => sum + item.amount, 0)
  
  // Hitung rata-rata per jam dan per hari
  const averageHourlyOrders = totalPeriodOrders / (timeframe === 'hour' ? data.length || 1 : data.length * 24 || 1)
  const averageHourlyAmount = totalPeriodAmount / (timeframe === 'hour' ? data.length || 1 : data.length * 24 || 1)
  
  const averageDailyOrders = totalPeriodOrders / (timeframe === 'day' ? data.length || 1 : data.length / 24 || 1)
  const averageDailyAmount = totalPeriodAmount / (timeframe === 'day' ? data.length || 1 : data.length / 24 || 1)
  
  // Tambahkan useEffect untuk mengupdate timeframe saat orders berubah
  useEffect(() => {
    const recommendation = getViewRecommendation(orders)
    if (!recommendation.allowHourly && timeframe === 'hour') {
      setTimeframe('day')
    }
    if (!recommendation.allowDaily) {
      // Bisa tambahkan notifikasi atau handling khusus
      console.warn(recommendation.message)
    }
  }, [orders, timeframe])

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
    area: {
      fill: isDarkMode ? "#4169E1" : "#3b82f6", 
      stroke: isDarkMode ? "#4169E1" : "#3b82f6"
    },
    label: isDarkMode ? "#AAAAAA" : "#666666"
  }

  return (
    <Card className={isDarkMode ? "bg-[#121212] text-white border-gray-800" : "bg-white text-gray-900 border-gray-200"}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className={`text-base font-medium ${isDarkMode ? "text-white" : "text-gray-900"}`}>
            {showAmount ? 'Omset' : 'Pesanan'} {timeframe === 'hour' ? 'Per Jam' : timeframe === 'day' ? 'Per Hari' : 'Mingguan'}
          </CardTitle>
        </div>
        
        {/* Dropdown untuk tampilan mobile */}
        <div className="sm:hidden flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className={`h-8 w-8 ${isDarkMode ? "text-white" : "text-gray-700"}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={isDarkMode ? "bg-[#1e1e1e] text-white border-gray-700" : "bg-white text-gray-900 border-gray-200"}>
              <DropdownMenuItem 
                onClick={() => setTimeframe('hour')}
                className={timeframe === 'hour' ? (isDarkMode ? "bg-blue-900/30 text-blue-300" : "bg-blue-50 text-blue-700") : ""}
              >
                Per Jam
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setTimeframe('day')}
                className={timeframe === 'day' ? (isDarkMode ? "bg-blue-900/30 text-blue-300" : "bg-blue-50 text-blue-700") : ""}
              >
                Per Hari
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setTimeframe('weekly')}
                className={timeframe === 'weekly' ? (isDarkMode ? "bg-blue-900/30 text-blue-300" : "bg-blue-50 text-blue-700") : ""}
              >
                Mingguan
              </DropdownMenuItem>
              <DropdownMenuItem className={isDarkMode ? "opacity-50 cursor-default" : "opacity-70 cursor-default"}>
                Tampilkan
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setShowAmount(true)}
                className={showAmount ? (isDarkMode ? "bg-blue-900/30 text-blue-300" : "bg-blue-50 text-blue-700") : ""}
              >
                Omset
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setShowAmount(false)}
                className={!showAmount ? (isDarkMode ? "bg-blue-900/30 text-blue-300" : "bg-blue-50 text-blue-700") : ""}
              >
                Jumlah
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Toggle untuk tampilan desktop */}
        <div className="hidden sm:flex gap-2">
          <div className={`flex gap-1 border rounded-md p-1 ${isDarkMode ? "border-gray-700 bg-[#121212]" : "border-gray-200 bg-gray-50"}`}>
            <Button
              variant={timeframe === 'hour' ? "default" : "ghost"}
              size="sm"
              onClick={() => setTimeframe('hour')}
              className="h-7 text-xs px-2 sm:px-3"
            >
              Per Jam
            </Button>
            <Button
              variant={timeframe === 'day' ? "default" : "ghost"}
              size="sm"
              onClick={() => setTimeframe('day')}
              className="h-7 text-xs px-2 sm:px-3"
            >
              Per Hari
            </Button>
            <Button
              variant={timeframe === 'weekly' ? "default" : "ghost"}
              size="sm"
              onClick={() => setTimeframe('weekly')}
              className="h-7 text-xs px-2 sm:px-3"
            >
              Mingguan
            </Button>
          </div>
          <div className={`flex gap-1 border rounded-md p-1 ${isDarkMode ? "border-gray-700 bg-[#121212]" : "border-gray-200 bg-gray-50"}`}>
            <Button
              variant={showAmount ? "default" : "ghost"}
              size="sm"
              onClick={() => setShowAmount(true)}
              className="h-7 text-xs px-2 sm:px-3"
            >
              Omset
            </Button>
            <Button
              variant={showAmount ? "ghost" : "default"}
              size="sm"
              onClick={() => setShowAmount(false)}
              className="h-7 text-xs px-2 sm:px-3"
            >
              Jumlah
            </Button>
          </div>
        </div>
      </CardHeader>
      {viewRecommendation.message && (
        <div className="px-4 py-2 text-sm text-yellow-600 bg-yellow-50">
          {viewRecommendation.message}
        </div>
      )}
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={data}
              margin={{ top: 25, right: 10, left: 10, bottom: 10 }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke={chartColors.grid} 
                strokeOpacity={0.5}
                vertical={false}
              />
              <XAxis 
                dataKey={timeframe === 'hour' ? 'time' : 'date'}
                tickLine={false}
                axisLine={false}
                fontSize={12}
                tickMargin={8}
                interval={timeframe === 'hour' ? 2 : 'preserveStartEnd'}
                padding={{ left: 10, right: 10 }}
                tick={{ fill: chartColors.label }}
              />
              <YAxis hide={true} />
              <Tooltip 
                content={(props) => <CustomTooltip {...props} timeframe={timeframe} />} 
                cursor={{ stroke: isDarkMode ? '#666' : '#999', strokeWidth: 1, strokeDasharray: '5 5' }}
                contentStyle={{
                  backgroundColor: chartColors.tooltip.bg,
                  color: chartColors.tooltip.text,
                  border: `1px solid ${chartColors.tooltip.border}`,
                }}
              />
              <Area
                type="monotone"
                dataKey={showAmount ? "amount" : "orders"}
                name={showAmount ? "Total Omset" : "Jumlah Pesanan"}
                stroke={chartColors.area.stroke}
                fill={chartColors.area.fill}
                fillOpacity={0.2}
                isAnimationActive={false}
                activeDot={{ r: 6, strokeWidth: 2, stroke: isDarkMode ? "white" : "#3b82f6" }}
                dot={{ r: 4, strokeWidth: 2, stroke: isDarkMode ? "white" : "#3b82f6" }}
              >
                <LabelList
                  dataKey={showAmount ? "amount" : "orders"}
                  position="top"
                  offset={10}
                  formatter={showAmount ? formatAmountLabel : (value: any) => value}
                  style={{
                    fontSize: '10px',
                    fill: chartColors.label
                  }}
                />
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className={`flex gap-2 font-medium leading-none ${isDarkMode ? "text-white" : "text-gray-900"}`}>
          {showAmount ? (
            <>Total omset periode ini: {formatRupiah(totalPeriodAmount)}</>
          ) : (
            <>Total pesanan periode ini: {totalPeriodOrders} pesanan</>
          )}
        </div>
        <div className={`leading-none ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
          {timeframe === 'hour' 
            ? 'Rata-rata ' + (showAmount 
                ? formatRupiah(averageHourlyAmount) + ' per jam'
                : averageHourlyOrders.toFixed(1) + ' pesanan per jam')
            : timeframe === 'day' 
                ? 'Rata-rata ' + (showAmount 
                    ? formatRupiah(averageDailyAmount) + ' per hari'
                    : averageDailyOrders.toFixed(1) + ' pesanan per hari')
                : 'Rata-rata pesanan mingguan'
          }
        </div>
      </CardFooter>
    </Card>
  )
} 