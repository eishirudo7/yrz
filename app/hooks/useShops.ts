import { useState, useEffect } from 'react';
import { getAllShops } from '@/app/services/shopeeService';

interface MetricTarget {
  value: number;
  comparator: string;
}

interface Metric {
  metric_type: number;
  metric_id: number;
  parent_metric_id: number;
  metric_name: string;
  current_period: number | null;
  last_period: number | null;
  unit: number;
  target: MetricTarget;
}

interface PenaltyPoints {
  overall_penalty_points: number;
  non_fulfillment_rate: number;
  late_shipment_rate: number;
  listing_violations: number;
  opfr_violations: number;
  others: number;
}

interface OngoingPunishment {
  punishment_name: string;
  punishment_tier: number;
  days_left: number;
}

interface ShopPenalty {
  penalty_points: PenaltyPoints;
  ongoing_punishment: OngoingPunishment[];
}

interface ShopPerformance {
  overall_performance: {
    rating: number;
    fulfillment_failed: number;
    listing_failed: number;
    custom_service_failed: number;
  };
  metric_list: Metric[];
  penalty?: ShopPenalty;
}

interface Shop {
  shop_id: number;
  shop_name: string;
  is_active: boolean;
  performance?: ShopPerformance;
}

export function useShops() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fungsi untuk mengambil daftar toko saja
    async function fetchShops() {
      try {
        setIsLoading(true);
        const shopsData = await getAllShops();
        setShops(shopsData);
        setIsLoading(false);

        // Setelah data toko dimuat, mulai memuat metrik
        fetchShopsPerformance(shopsData);
      } catch (err) {
        setError((err as Error).message);
        setIsLoading(false);
      }
    }

    // Fungsi terpisah untuk mengambil performa toko
    async function fetchShopsPerformance(shopsData: Shop[]) {
      setIsLoadingMetrics(true);
      
      for (const shop of shopsData) {
        try {
          const response = await fetch(`/api/performance?shop_id=${shop.shop_id}`);
          const performanceData = await response.json();
          
          if (performanceData.success) {
            setShops(currentShops => 
              currentShops.map(s => 
                s.shop_id === shop.shop_id 
                  ? {
                      ...s,
                      performance: {
                        ...performanceData.data.performance,
                        penalty: performanceData.data.penalty
                      }
                    }
                  : s
              )
            );
          } else {
            console.error(`Gagal mengambil performa untuk toko ${shop.shop_id}:`, performanceData.message);
          }
        } catch (error) {
          console.error(`Error mengambil performa untuk toko ${shop.shop_id}:`, error);
        }
      }
      
      setIsLoadingMetrics(false);
    }

    fetchShops();
  }, []);

  // Helper function untuk mendapatkan nama metrik berdasarkan unit
  const getUnitName = (unit: number) => {
    switch (unit) {
      case 1: return 'Angka';
      case 2: return '%';
      case 3: return 'Detik';
      case 4: return 'Hari';
      case 5: return 'Jam';
      default: return '';
    }
  };

  // Helper function untuk mendapatkan nama tipe metrik
  const getMetricTypeName = (type: number) => {
    switch (type) {
      case 1: return 'Performa Pengiriman';
      case 2: return 'Performa Listing';
      case 3: return 'Performa Layanan Pelanggan';
      default: return 'Lainnya';
    }
  };

  // Helper function untuk mendapatkan rating text
  const getRatingText = (rating: number) => {
    switch (rating) {
      case 1: return 'Buruk';
      case 2: return 'Perlu Perbaikan';
      case 3: return 'Baik';
      case 4: return 'Sangat Baik';
      default: return 'Tidak Diketahui';
    }
  };

  // Helper function untuk mendapatkan nama hukuman
  const getPunishmentName = (name: string) => {
    switch (name.toLowerCase()) {
      case 'deboost': return 'Penurunan Peringkat';
      case 'listing_violation': return 'Pelanggaran Listing';
      case 'search_exposure': return 'Pembatasan Pencarian';
      default: return name;
    }
  };

  return { 
    shops, 
    isLoading,
    isLoadingMetrics,
    error,
    helpers: {
      getUnitName,
      getMetricTypeName,
      getRatingText,
      getPunishmentName
    }
  };
}