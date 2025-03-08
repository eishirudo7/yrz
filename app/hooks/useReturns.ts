import { useState, useEffect, useMemo } from 'react';
import { getAllShops } from '@/app/services/shopeeService';
import { ReturnData } from '@/app/(dashboard)/return/page';

interface Shop {
  id: number;
  shop_id: number;
  shop_name: string;
}

interface UseReturnsResult {
  returns: ReturnData[];
  shops: Shop[];
  isLoading: boolean;
  error: string | null;
  selectedShop: string | null;
  setSelectedShop: (shopId: string | null) => void;
  filters: ReturnFilters;
  setFilters: (filters: ReturnFilters) => void;
  hasMore: boolean;
  page: number;
  setPage: (page: number) => void;
}

interface ReturnFilters {
  status: string;
  negotiation_status: string;
  seller_proof_status: string;
  seller_compensation_status: string;
}

export function useReturns(): UseReturnsResult {
  const [allReturns, setAllReturns] = useState<ReturnData[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  
  // Set default status ke PROCESSING
  const [filters, setFilters] = useState<ReturnFilters>({
    status: 'PROCESSING',  // Default status
    negotiation_status: '',
    seller_proof_status: '',
    seller_compensation_status: '',
  });

  // Fetch daftar toko
  useEffect(() => {
    const fetchShops = async () => {
      try {
        const shopsData = await getAllShops();
        setShops(shopsData);
        
        if (!selectedShop && shopsData.length > 0) {
          setSelectedShop(String(shopsData[0].shop_id));
        }
      } catch (err) {
        setError('Gagal mengambil daftar toko');
        console.error('Error fetching shops:', err);
      }
    };

    fetchShops();
  }, []);

  // Fetch semua data return sekali saja saat shop berubah
  useEffect(() => {
    const fetchReturns = async () => {
      if (!selectedShop) return;

      try {
        setIsLoading(true);
        setError(null);

        const pageNo = page - 1;
        const url = new URL('/api/return', window.location.origin);
        
        // Parameter dasar
        url.searchParams.append('shop_id', selectedShop);
        url.searchParams.append('page_no', pageNo.toString());
        
        // PENTING: Selalu kirim status, default ke 'ALL' jika tidak ada
        const currentStatus = filters.status || 'ALL';
        
        // Jika status ALL, tambahkan filter 15 hari terakhir dan page_size 50
        if (currentStatus === 'ALL') {
          const now = Math.floor(Date.now() / 1000);
          const fifteenDaysAgo = now - (15 * 24 * 60 * 60);
          
          url.searchParams.append('create_time_from', fifteenDaysAgo.toString());
          url.searchParams.append('create_time_to', now.toString());
          url.searchParams.append('page_size', '50');  // Page size 50 untuk ALL
        } else {
          // Untuk status spesifik, gunakan page_size 20
          url.searchParams.append('status', currentStatus);
          url.searchParams.append('page_size', '20');
        }

        console.log('Fetching URL:', url.toString()); // Untuk debugging

        const response = await fetch(url);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Terjadi kesalahan saat mengambil data');
        }

        if (page === 1) {
          setAllReturns(data.data.return || []);
        } else {
          setAllReturns(prev => [...prev, ...(data.data.return || [])]);
        }
        
        setHasMore(data.data.more || false);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      } finally {
        setIsLoading(false);
      }
    };

    fetchReturns();
  }, [selectedShop, page, filters.status]);

  // Reset page ke 1 saat filter berubah
  useEffect(() => {
    setPage(1);
  }, [filters.status, selectedShop]);

  // Filter data di client-side menggunakan useMemo
  const returns = useMemo(() => {
    return allReturns.filter(item => {
      return Object.entries(filters).every(([key, value]) => {
        if (!value) return true; // Skip filter jika nilainya kosong
        return item[key as keyof ReturnData] === value;
      });
    });
  }, [allReturns, filters]);

  return {
    returns,
    shops,
    isLoading,
    error,
    selectedShop,
    setSelectedShop,
    filters,
    setFilters,
    hasMore,
    page,
    setPage
  };
} 