'use client';

import { useShops } from '@/app/hooks/useShops';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
interface SyncStatus {
  [shopId: number]: {
    progress: { current: number; total: number } | null;
    error: string | null;
    isSyncing: boolean;
  };
}


interface TokenStatus {
  [shopId: number]: {
    is_active: boolean;
    message: string;
    isChecking: boolean;
  };
}

interface MetricTarget {
  value: number;
  comparator: string;
}

interface Metric {
  metric_type: number;
  metric_id: number;
  parent_metric_id: number | null;
  metric_name: string;
  current_period: number | null;
  last_period: number | null;
  unit: number;
  target?: MetricTarget;
}


interface OngoingPunishment {
  punishment_name: string;
  punishment_tier: number;
  days_left: number;
}



function ShopSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-md p-4 border border-gray-100 dark:border-gray-700">
      {/* Header Skeleton */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      </div>

      {/* Performance Skeleton */}
      <div className="mb-3">
        <div className="bg-gray-100 dark:bg-gray-700/50 p-2 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-200 dark:bg-gray-600 rounded-full animate-pulse" />
              <div className="h-4 w-28 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-200 dark:bg-gray-600 rounded-full animate-pulse" />
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Token Status Skeleton */}
      <div className="space-y-2 mb-3">
        <div className="bg-gray-100 dark:bg-gray-700/50 p-2 rounded-md">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full animate-pulse" />
            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Buttons Skeleton */}
      <div className="flex gap-2">
        <div className="flex-1 h-8 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
      </div>
    </div>
  );
}

function MetricItem({ metric }: { metric: Metric }) {
  const { helpers } = useShops();
  
  const getMetricDisplayName = (name: string) => {
    const nameMap: { [key: string]: string } = {
      'non_fulfillment_rate': 'Pesanan Tidak Dipenuhi',
      'cancellation_rate': 'Tingkat Pembatalan',
      'return_refund_rate': 'Tingkat Pengembalian Dana',
      'late_shipment_rate': 'Pengiriman Terlambat',
      'preparation_time': 'Waktu Pengemasan',
      'severe_listing_violations': 'Pelanggaran Produk Berat',
      'spam_listings': 'Produk Spam',
      'counterfeit_ip_infringement': 'Pelanggaran Hak Cipta',
      'prohibited_listings': 'Produk Terlarang',
      'pre_order_listing_rate': 'Tingkat Pre-Order',
      'the_amount_of_pre_order_listing': 'Jumlah Produk Pre-Order',
      'other_listing_violations': 'Pelanggaran Produk Lainnya',
      'response_time': 'Waktu Respon',
      'response_rate': 'Tingkat Respon',
      'csat_rate': 'Tingkat Kepuasan',
      'shop_rating': 'Rating Toko',
      'customer_satisfaction': 'Kepuasan Pelanggan'
    };

    return nameMap[name] || name;
  };

  const formatValue = (value: number | null, unit: number, metricName: string) => {
    if (value === null) {
      return unit === 2 ? '0.0' : '0';
    }
    
    if (unit === 2 || metricName.toLowerCase().includes('preparation_time')) {
      if (metricName.toLowerCase().includes('preparation_time')) {
        return Math.ceil(value * 10) / 10;
      }
      return value.toFixed(1);
    }
    
    return value;
  };

  return (
    <div className="text-sm p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
      <div className="flex justify-between items-center">
        <span className="text-gray-600 dark:text-gray-300">
          {getMetricDisplayName(metric.metric_name)}
        </span>
        <div className="space-x-2 text-right">
          <span className="font-medium text-gray-700 dark:text-gray-200">
            {formatValue(metric.current_period, metric.unit, metric.metric_name)}
            {metric.unit === 2 ? '%' : ''}
          </span>
          {metric.target && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Target: {formatValue(metric.target.value, metric.unit, metric.metric_name)}
              {metric.unit === 2 ? '%' : ''}
            </span>
          )}
        </div>
      </div>
      {metric.last_period !== null && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Periode sebelumnya: {formatValue(metric.last_period, metric.unit, metric.metric_name)}
          {metric.unit === 2 ? '%' : ''}
        </div>
      )}
    </div>
  );
}

function MetricGroup({ 
  title, 
  metrics,
  type 
}: { 
  title: string;
  metrics: Metric[];
  type: number;
}) {
  const filteredMetrics = metrics.filter(m => m.metric_type === type);
  
  if (filteredMetrics.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="font-medium text-gray-700 dark:text-gray-300">{title}</h3>
      <div className="space-y-1">
        {filteredMetrics.map(metric => (
          <MetricItem key={metric.metric_id} metric={metric} />
        ))}
      </div>
    </div>
  );
}

function ShopCard({ 
  shop, 
  tokenStatus, 
  syncStatus, 
  onSync, 
  onDeauth, 
  helpers,
  blockingShops
}: {
  shop: any;
  tokenStatus: any;
  syncStatus: any;
  onSync: (shopId: number) => void;
  onDeauth: (shopId: number) => void;
  helpers: {
    getRatingText: (rating: number) => string;
    getPunishmentName: (name: string) => string;
  };
  blockingShops: {[key: number]: boolean};
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-md p-3 sm:p-4 border border-gray-100 dark:border-gray-700 
                   hover:border-gray-200 dark:hover:border-gray-600 transition-all">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 mb-3">
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-50 dark:bg-orange-900/30 rounded-md flex items-center justify-center">
          <span className="text-orange-500 dark:text-orange-400 text-base sm:text-lg font-semibold">
            {shop.shop_name.charAt(0)}
          </span>
        </div>
        <div>
          <h2 className="font-medium text-sm sm:text-base text-gray-800 dark:text-gray-100">{shop.shop_name}</h2>
          <div className="flex items-center gap-2">
            <p className="text-gray-400 dark:text-gray-500 text-xs">ID: {shop.shop_id}</p>
            {tokenStatus[shop.shop_id]?.isChecking ? (
              <div className="flex items-center gap-1.5">
                <svg className="animate-spin h-3 w-3 text-blue-500 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : (
              <div className={`w-1.5 h-1.5 rounded-full ${
                tokenStatus[shop.shop_id]?.is_active ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
            )}
          </div>
        </div>
      </div>

      {/* Performance Section */}
      <div className="mb-3">
        {shop.performance ? (
          <Dialog>
            <DialogTrigger asChild>
              <button className="w-full text-left">
                <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded-md space-y-2">
                  {/* Baris pertama - Performa dan Poin */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        shop.performance.overall_performance.rating >= 3 ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <span className="text-xs text-gray-600 dark:text-gray-300">
                        Performa: {helpers.getRatingText(shop.performance.overall_performance.rating)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        (shop.performance.penalty?.penalty_points.overall_penalty_points || 0) <= 5 
                          ? 'bg-green-500' 
                          : 'bg-red-500'
                      }`} />
                      <span className="text-xs text-gray-600 dark:text-gray-300">
                        Poin: {shop.performance.penalty?.penalty_points.overall_penalty_points || 0}
                      </span>
                    </div>
                  </div>

                  {/* Baris kedua - Pesanan tidak terpenuhi dan terlambat */}
                  <div className="flex gap-2 text-xs">
                    <div className="flex-1 bg-gray-100 dark:bg-gray-600/50 p-1.5 rounded">
                      <span className="block text-gray-500 dark:text-gray-400">Tidak Dipenuhi</span>
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        {(shop.performance.metric_list.find((m: Metric) => m.metric_name === 'non_fulfillment_rate')?.current_period || 0).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex-1 bg-gray-100 dark:bg-gray-600/50 p-1.5 rounded">
                      <span className="block text-gray-500 dark:text-gray-400">Terlambat</span>
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        {(shop.performance.metric_list.find((m: Metric) => m.metric_name === 'late_shipment_rate')?.current_period || 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Baris ketiga - Tingkat respon dan rating toko */}
                  <div className="flex gap-2 text-xs">
                    <div className="flex-1 bg-gray-100 dark:bg-gray-600/50 p-1.5 rounded">
                      <span className="block text-gray-500 dark:text-gray-400">Tingkat Respon</span>
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        {(shop.performance.metric_list.find((m: Metric) => m.metric_name === 'response_rate')?.current_period || 0).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex-1 bg-gray-100 dark:bg-gray-600/50 p-1.5 rounded">
                      <span className="block text-gray-500 dark:text-gray-400">Rating Toko</span>
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        {(shop.performance.metric_list.find((m: Metric) => m.metric_name === 'shop_rating')?.current_period || 0).toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-3 sm:p-6">
              <DialogHeader className="mb-4">
                <DialogTitle className="text-base sm:text-lg font-semibold">
                  {shop.shop_name}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 sm:space-y-6">
                {/* Overall Performance */}
                <div className="space-y-2">
                  <h3 className="text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300">
                    Performa Keseluruhan
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Rating</p>
                      <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100">
                        {helpers.getRatingText(shop.performance.overall_performance.rating)}
                      </p>
                    </div>
                    <div className="p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Pengiriman Gagal</p>
                      <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100">
                        {shop.performance.overall_performance.fulfillment_failed}
                      </p>
                    </div>
                    <div className="p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Listing Gagal</p>
                      <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100">
                        {shop.performance.overall_performance.listing_failed}
                      </p>
                    </div>
                    <div className="p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Layanan Gagal</p>
                      <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100">
                        {shop.performance.overall_performance.custom_service_failed}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Penalty Points */}
                {shop.performance.penalty && (
                  <div className="space-y-2">
                    <h3 className="text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300">
                      Poin Penalti
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Total</p>
                        <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100">
                          {shop.performance.penalty.penalty_points.overall_penalty_points} poin
                        </p>
                      </div>
                      <div className="p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Pembatalan</p>
                        <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100">
                          {shop.performance.penalty.penalty_points.non_fulfillment_rate} poin
                        </p>
                      </div>
                      <div className="p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Keterlambatan</p>
                        <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100">
                          {shop.performance.penalty.penalty_points.late_shipment_rate} poin
                        </p>
                      </div>
                      <div className="p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Produk</p>
                        <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100">
                          {shop.performance.penalty.penalty_points.listing_violations} poin
                        </p>
                      </div>
                    </div>

                    {/* Ongoing Punishments */}
                    {shop.performance.penalty.ongoing_punishment?.length > 0 && (
                      <div className="mt-3 sm:mt-4 space-y-2">
                        <h3 className="text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300">
                          Hukuman Berlangsung
                        </h3>
                        <div className="space-y-2">
                          {shop.performance.penalty.ongoing_punishment.map((punishment: OngoingPunishment, idx: number) => (
                            <div 
                              key={idx}
                              className="p-2 sm:p-3 bg-red-50 dark:bg-red-900/20 rounded flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0"
                            >
                              <span className="text-xs sm:text-sm text-red-600 dark:text-red-400">
                                {helpers.getPunishmentName(punishment.punishment_name)}
                                <span className="ml-1 text-red-500">
                                  (Tier {punishment.punishment_tier})
                                </span>
                              </span>
                              <span className="text-xs sm:text-sm text-red-500">
                                {punishment.days_left} hari lagi
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Detailed Metrics */}
                <div className="space-y-4 sm:space-y-6">
                  <MetricGroup 
                    title="Performa Pengiriman" 
                    metrics={shop.performance.metric_list}
                    type={1}
                  />
                  <MetricGroup 
                    title="Performa Listing" 
                    metrics={shop.performance.metric_list}
                    type={2}
                  />
                  <MetricGroup 
                    title="Performa Layanan Pelanggan" 
                    metrics={shop.performance.metric_list}
                    type={3}
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded-md">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4">
                <svg className="animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-300">
                Memuat metrik performa...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Sync Progress */}
      {syncStatus[shop.shop_id]?.isSyncing && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-1.5 sm:p-2 rounded-md">
          <div className="w-full bg-blue-100 dark:bg-blue-800/50 rounded-full h-1.5">
            <div 
              className="bg-blue-500 dark:bg-blue-400 h-1.5 rounded-full transition-all duration-300"
              style={{ 
                width: (() => {
                  const total = syncStatus[shop.shop_id]?.progress?.total || 0;
                  const current = syncStatus[shop.shop_id]?.progress?.current || 0;
                  return total > 0 ? `${Math.round((current / total) * 100)}%` : '0%';
                })()
              }}
            ></div>
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            {syncStatus[shop.shop_id]?.progress?.current || 0}/{syncStatus[shop.shop_id]?.progress?.total || 0}
          </p>
        </div>
      )}

      {/* Action Buttons - Penyesuaian ukuran dan spacing */}
      <div className="flex gap-1.5 sm:gap-2">
        <button
          onClick={() => onSync(shop.shop_id)}
          disabled={syncStatus[shop.shop_id]?.isSyncing}
          className="flex-1 px-2 sm:px-3 py-1.5 bg-orange-500 text-white text-xs sm:text-sm rounded-md 
                    hover:bg-orange-600 disabled:bg-gray-200 dark:disabled:bg-gray-700 
                    disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
        >
          {syncStatus[shop.shop_id]?.isSyncing ? 'Sinkronisasi...' : 'Sinkronisasi'}
        </button>

        <button
          onClick={() => onDeauth(shop.shop_id)}
          disabled={blockingShops[shop.shop_id]}
          className="p-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-md 
                    hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors
                    disabled:bg-gray-200 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
          title="Putuskan koneksi toko"
        >
          {blockingShops[shop.shop_id] ? (
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

export default function ShopsPage() {
  const { shops, isLoading, isLoadingMetrics, error, helpers } = useShops();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({});
  const [tokenStatus, setTokenStatus] = useState<TokenStatus>({});
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasCheckedTokens, setHasCheckedTokens] = useState(false);
  const [blockingShops, setBlockingShops] = useState<{[key: number]: boolean}>({});

  const checkTokens = async (shopsList: any[]) => {
    if (!shopsList || shopsList.length === 0) return;

    // Reset status untuk toko yang ada saja
    const initialStatus = shopsList.reduce((acc, shop) => ({
      ...acc,
      [shop.shop_id]: { 
        isChecking: true, 
        is_active: false, 
        message: 'Mengecek token...' 
      }
    }), {});
    setTokenStatus(initialStatus);

    try {
      const response = await fetch('/api/cek-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shop_ids: shopsList.map(shop => shop.shop_id)
        })
      });

      if (!response.ok) {
        throw new Error('Gagal mengecek token');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message);
      }

      const newStatus = result.data.reduce((acc: TokenStatus, status: any) => ({
        ...acc,
        [status.shop_id]: {
          is_active: status.is_active,
          message: status.message,
          isChecking: false
        }
      }), {});

      setTokenStatus(prev => ({
        ...prev,
        ...newStatus
      }));
      
      setHasCheckedTokens(true);
    } catch (err) {
      console.error('Gagal mengecek token:', err);
      setTokenStatus(prev => {
        const errorStatus = Object.keys(prev).reduce((acc, shopId) => ({
          ...acc,
          [shopId]: {
            isChecking: false,
            is_active: false,
            message: 'Gagal mengecek token'
          }
        }), {});
        return errorStatus;
      });
      setHasCheckedTokens(true);
    }
  };

  useEffect(() => {
    if (shops && !isLoading && !hasCheckedTokens) {
      checkTokens(shops);
    }
  }, [shops, isLoading, hasCheckedTokens]);

  useEffect(() => {
    setHasCheckedTokens(false);
  }, [shops.length]);

  const handleSync = async (shopId: number) => {
    try {
      setSyncStatus(prev => ({
        ...prev,
        [shopId]: { 
          progress: { current: 0, total: 0 },
          error: null,
          isSyncing: true
        }
      }));

      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shopId })
      });

      if (!response.ok) {
        throw new Error('Gagal melakukan sinkronisasi');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Stream tidak tersedia');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        try {
          const progress = JSON.parse(chunk);
          
          if (typeof progress.processed === 'number' && typeof progress.total === 'number') {
            setSyncStatus(prev => ({
              ...prev,
              [shopId]: {
                ...prev[shopId],
                progress: { 
                  current: progress.processed, 
                  total: progress.total 
                },
                isSyncing: true
              }
            }));
          }
        } catch (e) {
          // Biarkan error parsing tanpa logging
        }
      }

      setSyncStatus(prev => ({
        ...prev,
        [shopId]: {
          ...prev[shopId],
          isSyncing: false
        }
      }));

    } catch (err: any) {
      setSyncStatus(prev => ({
        ...prev,
        [shopId]: {
          ...prev[shopId],
          error: err.message || 'Gagal melakukan sinkronisasi',
          isSyncing: false
        }
      }));
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch('/api/generate-auth-url');
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Gagal mendapatkan URL autentikasi:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleBlock = async (shopId: number) => {
    setBlockingShops(prev => ({ ...prev, [shopId]: true }));
    
    try {
      const response = await fetch(`/api/shops/block?shopId=${shopId}`, {
        method: 'POST'
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Gagal memblokir toko');
      }

      toast.success('Toko berhasil diblokir');
    } catch (error) {
      console.error('Gagal memblokir toko:', error);
      toast.error(error instanceof Error ? error.message : 'Gagal memblokir toko');
    } finally {
      setBlockingShops(prev => ({ ...prev, [shopId]: false }));
    }
  };

  return (
    <div className="p-3 sm:p-6">
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-gray-100">Toko Shopee</h1>
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 
                    disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors
                    flex items-center gap-2 text-sm"
        >
          {isConnecting ? (
            <>
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Menghubungkan</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Tambah Toko</span>
            </>
          )}
        </button>
      </div>

      {/* Grid layout optimization */}
      {isLoading ? (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {[...Array(10)].map((_, index) => (
            <ShopSkeleton key={index} />
          ))}
        </div>
      ) : shops.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-6 text-center">
          <p className="text-gray-500 dark:text-gray-400">Belum ada toko yang terhubung</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Silakan hubungkan toko Shopee Anda</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {shops.map((shop) => (
            <ShopCard
              key={shop.shop_id}
              shop={shop}
              tokenStatus={tokenStatus}
              syncStatus={syncStatus}
              onSync={handleSync}
              onDeauth={handleBlock}
              helpers={helpers}
              blockingShops={blockingShops}
            />
          ))}
        </div>
      )}
    </div>
  );
}