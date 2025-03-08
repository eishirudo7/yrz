"use client"

import { useState, useCallback, useRef, useEffect } from 'react'
import { DatePickerWithRange } from '@/components/ui/date-picker-with-range'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from "@/components/ui/skeleton"

import {Store, DollarSign } from "lucide-react"

interface AdData {
  shop_id: number
  shop_name: string
  cost: string
  direct_roas: number
}

interface AdsResponse {
  ads_data: AdData[]
  direct_roas: number
  total_cost: string
}

export default function AdsPage() {
  const [adsData, setAdsData] = useState<AdsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const fetchAdsData = useCallback(async (from: string | undefined, to: string | undefined) => {
    if (from && to) {
      // Batalkan timeout sebelumnya jika ada
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Atur timeout baru
      timeoutRef.current = setTimeout(async () => {
        setIsLoading(true)
        try {
          const response = await fetch(`/api/ads?start_date=${from}&end_date=${to}&_timestamp=${Date.now()}`);
          if (!response.ok) {
            throw new Error('Gagal mengambil data iklan');
          }
          const data: AdsResponse = await response.json();
          setAdsData(data);
        } catch (error) {
          console.error('Error saat mengambil data iklan:', error);
          // Tangani keadaan error di sini
        } finally {
          setIsLoading(false)
        }
      }, 300) // Tunggu 300ms sebelum memanggil API
    }
  }, []);

  useEffect(() => {
    // Fungsi untuk mendapatkan tanggal hari ini dalam format dd-mm-yyyy
    const getTodayDate = () => {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0'); // Januari adalah 0!
      const yyyy = today.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    };

    // Panggil fetchAdsData dengan tanggal hari ini saat komponen dimuat
    const today = getTodayDate();
    fetchAdsData(today, today);
  }, [fetchAdsData]);

  return (
    <div className="container mx-auto p-4 space-y-8">
      <h1 className="text-3xl font-bold text-center mb-6">Kinerja Iklan per Toko</h1>
      
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Pilih Rentang Tanggal</CardTitle>
        </CardHeader>
        <CardContent>
          <DatePickerWithRange onDateChange={fetchAdsData} />
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingSkeleton />
      ) : adsData ? (
        <>
          <TotalCostCard totalCost={adsData.total_cost} />
          <AdCards adsData={adsData.ads_data} />
          
        </>
      ) : null}
    </div>
  )
}

function AdCards({ adsData }: { adsData: AdData[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {adsData.map((ad) => (
        <Card key={ad.shop_id} className="transition-all hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{ad.shop_name}</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ad.cost}</div>
            <div className="text-sm font-medium">{ad.direct_roas}</div>
            <p className="text-xs text-muted-foreground">Ad spend for this store</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function TotalCostCard({ totalCost }: { totalCost: string }) {
  return (
    <Card className="bg-primary text-primary-foreground">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Total Ad Spend
          <DollarSign className="h-5 w-5" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-4xl font-extrabold">{totalCost}</p>
        <p className="text-sm opacity-80">Across all stores</p>
      </CardContent>
    </Card>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="space-y-0 pb-2">
              <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-4 w-3/4 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-4 w-1/2 mt-2" />
        </CardContent>
      </Card>
    </div>
  )
}
