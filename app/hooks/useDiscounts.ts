import { useState, useEffect } from 'react';

interface Discount {
  discount_id: number;
  discount_name: string;
  start_time_formatted: string;
  end_time_formatted: string;
  source: number;
  status: string;
}

interface ShopDiscount {
  shop_name: string;
  shop_id: number;
  discounts: Discount[];
}

interface DiscountResponse {
  success: boolean;
  data: ShopDiscount[];
  message: string;
}

export const useDiscounts = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [discounts, setDiscounts] = useState<ShopDiscount[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const fetchDiscounts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/discount', {
        cache: 'no-store'
      });
      const data: DiscountResponse = await response.json();
      
      if (data.success) {
        setDiscounts(data.data);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Terjadi kesalahan saat mengambil data diskon');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const filteredDiscounts = discounts.map(shop => ({
    ...shop,
    discounts: shop.discounts.filter(discount => 
      selectedStatus === 'all' || discount.status === selectedStatus
    )
  })).filter(shop => shop.discounts.length > 0);

  return {
    discounts: filteredDiscounts,
    isLoading,
    error,
    selectedStatus,
    setSelectedStatus,
    refetch: fetchDiscounts,
  };
}; 