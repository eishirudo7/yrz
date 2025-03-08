import { useState } from 'react';
import { supabase } from '@/lib/supabase';


interface ShippingDocumentParams {
  order_sn: string;
  package_number?: string;
  shipping_document_type: "THERMAL_AIR_WAYBILL";
  shipping_carrier?: string;
}

interface BulkProgress {
  processed: number;
  total: number;
  currentCarrier: string;
  currentShop: string;
}

interface DownloadResponse {
  blob: Blob;
  failedOrders: string[];
}

export function useShippingDocument() {
  const [isLoading, setIsLoading] = useState<{ [key: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress>({
    processed: 0,
    total: 0,
    currentCarrier: '',
    currentShop: ''
  });

  const downloadDocument = async (
    shopId: number, 
    orderList: ShippingDocumentParams[]
  ): Promise<DownloadResponse> => {
    try {
      setIsLoading(prev => ({
        ...prev,
        ...orderList.reduce((acc, order) => ({ ...acc, [order.order_sn]: true }), {})
      }));
      setError(null);

      const queryParams = new URLSearchParams({
        shopId: shopId.toString(),
        orderSns: orderList.map(order => order.order_sn).join(','),
        carrier: orderList[0].shipping_carrier || ''
      }).toString();

      const response = await fetch(`/api/shipping-document/view?${queryParams}`);
      
      const failedOrdersHeader = response.headers.get('X-Failed-Orders');
      const failedOrders = failedOrdersHeader ? JSON.parse(failedOrdersHeader) : [];
      
      if (response.status === 404) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Tidak ada dokumen yang berhasil diproses');
      }
      
      if (!response.ok) {
        throw new Error(`Gagal mengambil dokumen`);
      }
      
      const blob = await response.blob();
      
      const successfulOrders = orderList.filter(order => !failedOrders.includes(order.order_sn));
      await Promise.all(
        successfulOrders.map(async (order) => {
          try {
            await supabase
              .from('logistic')
              .update({ is_printed: true })
              .eq('order_sn', order.order_sn);
          } catch (err) {
            console.error(`Gagal mengupdate status is_printed untuk order ${order.order_sn}:`, err);
          }
        })
      );

      return {
        blob: blob,
        failedOrders: failedOrders
      };
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      throw err;
    } finally {
      setIsLoading(prev => ({
        ...prev,
        ...orderList.reduce((acc, order) => ({ ...acc, [order.order_sn]: false }), {})
      }));
    }
  };

  return {
    downloadDocument,
    isLoadingForOrder: (orderSn: string) => !!isLoading[orderSn],
    bulkProgress,
    setBulkProgress,
    error
  };
} 