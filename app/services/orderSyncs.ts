import { getOrderList, getOrderDetail } from '@/app/services/shopeeService';
import { upsertOrderData, upsertOrderItems, upsertLogisticData } from '@/app/services/databaseOperations';

interface OrderSyncOptions {
  timeRangeField?: 'create_time' | 'update_time';
  startTime?: number;
  endTime?: number;
  orderStatus?: 'UNPAID' | 'READY_TO_SHIP' | 'PROCESSED' | 'SHIPPED' | 'COMPLETED' | 'IN_CANCEL' | 'CANCELLED' | 'ALL';
  pageSize?: number;
  onProgress?: (progress: { current: number; total: number }) => void;
  onError?: (error: string) => void;
}

interface ShopeeOrder {
  order_sn: string;
}

interface OrderListResponse {
  success: boolean;
  data?: {
    order_list: ShopeeOrder[];
    more: boolean;
    next_cursor: string;
  };
  message?: string;
}

async function processOrderDetails(shopId: number, orderSns: string[]) {
  try {
    const response = await getOrderDetail(shopId, orderSns.join(','));
    const orders = response.order_list || [];
    
    if (!orders.length) {
      throw new Error(`Data pesanan kosong untuk orders: ${orderSns.join(',')}`);
    }

    const results = await Promise.all(orders.map(async (orderData: { order_sn: any; }) => {
      try {
        if (!orderData.order_sn) {
          throw new Error(`Data pesanan tidak memiliki order_sn yang valid`);
        }

        await upsertOrderData(orderData, shopId);
        await Promise.all([
          upsertOrderItems(orderData),
          upsertLogisticData(orderData, shopId)
        ]);
        
        return { orderSn: orderData.order_sn, success: true };
      } catch (error) {
        console.error(`Gagal memproses pesanan ${orderData.order_sn}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return { orderSn: orderData.order_sn, success: false };
      }
    }));

    return results;
  } catch (error) {
    console.error(`Gagal memproses batch pesanan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return orderSns.map(sn => ({ orderSn: sn, success: false }));
  }
}

interface SyncOrdersResult {
  success: boolean;
  data?: {
    total: number;
    processed: number;
    orderSns: string[];
  };
  error?: string;
}

interface OrderListParams {
  timeRangeField: 'create_time' | 'update_time';
  startTime: number;
  endTime: number;
  orderStatus: string;
  pageSize: number;
  cursor: string;
}

export async function syncOrders(shopId: number, options: OrderSyncOptions = {}) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const syncOptions = {
      timeRangeField: 'create_time' as const,
      startTime: now - (7 * 24 * 60 * 60),
      endTime: now,
      orderStatus: 'ALL' as const,
      pageSize: 50,
      ...options
    };

    let processedCount = 0;
    let totalOrders = 0;
    const processedOrders: string[] = [];

    // Ambil data pertama untuk mendapatkan total orders
    const initialResponse = await getOrderList(shopId, { 
      ...syncOptions, 
      cursor: '' 
    }) as OrderListResponse;

    if (!initialResponse.success || !initialResponse.data) {
      throw new Error(initialResponse.message || 'Gagal mengambil daftar pesanan');
    }

    // Set total awal
    totalOrders = initialResponse.data.order_list.length;
    console.log(totalOrders)
    
    // Update progress awal
    if (options.onProgress) {
      options.onProgress({ 
        current: 0, 
        total: totalOrders 
      });
    }

    // Mulai proses sync
    let hasMore = initialResponse.data.more;
    let cursor = initialResponse.data.next_cursor;

    // Proses batch pertama
    const BATCH_SIZE = 50; // Sesuaikan dengan batasan API Shopee
    const firstBatch = initialResponse.data.order_list;
    for (let i = 0; i < firstBatch.length; i += BATCH_SIZE) {
      const orderBatch = firstBatch.slice(i, i + BATCH_SIZE);
      const results = await processOrderDetails(shopId, orderBatch.map(o => o.order_sn));
      
      results.forEach(result => {
        if (result.success) {
          processedCount++;
          processedOrders.push(result.orderSn);
        }
      });

      if (options.onProgress) {
        options.onProgress({ 
          current: processedCount, 
          total: totalOrders 
        });
      }
    }

    // Proses batch selanjutnya jika ada
    while (hasMore) {
      const response = await getOrderList(shopId, { ...syncOptions, cursor }) as OrderListResponse;
      
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Gagal mengambil daftar pesanan');
      }

      // Update total orders
      totalOrders += response.data.order_list.length;

      for (let i = 0; i < response.data.order_list.length; i += BATCH_SIZE) {
        const orderBatch = response.data.order_list.slice(i, i + BATCH_SIZE);
        const results = await processOrderDetails(shopId, orderBatch.map(o => o.order_sn));
        
        results.forEach(result => {
          if (result.success) {
            processedCount++;
            processedOrders.push(result.orderSn);
          }
        });

        if (options.onProgress) {
          options.onProgress({ 
            current: processedCount, 
            total: totalOrders 
          });
        }
      }

      hasMore = response.data.more;
      cursor = response.data.next_cursor;
    }

    return {
      success: true,
      data: {
        total: totalOrders,
        processed: processedCount,
        orderSns: processedOrders
      }
    };

  } catch (err: any) {
    if (options.onError) {
      options.onError(err.message || 'Terjadi kesalahan yang tidak diketahui');
    }
    return {
      success: false,
      error: err.message || 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function syncOrdersByOrderSns(shopId: number, orderSns: string[], options: Omit<OrderSyncOptions, 'timeRangeField' | 'startTime' | 'endTime' | 'orderStatus' | 'pageSize'> = {}) {
  try {
    let processedCount = 0;
    const totalOrders = orderSns.length;
    const processedOrders: string[] = [];

    // Update progress awal
    if (options.onProgress) {
      options.onProgress({ 
        current: 0, 
        total: totalOrders 
      });
    }

    // Proses dalam batch
    const BATCH_SIZE = 50;
    for (let i = 0; i < orderSns.length; i += BATCH_SIZE) {
      const orderBatch = orderSns.slice(i, i + BATCH_SIZE);
      const results = await processOrderDetails(shopId, orderBatch);
      
      results.forEach(result => {
        if (result.success) {
          processedCount++;
          processedOrders.push(result.orderSn);
        }
      });

      if (options.onProgress) {
        options.onProgress({ 
          current: processedCount, 
          total: totalOrders 
        });
      }
    }

    return {
      success: true,
      data: {
        total: totalOrders,
        processed: processedCount,
        orderSns: processedOrders
      }
    };

  } catch (err: any) {
    if (options.onError) {
      options.onError(err.message || 'Terjadi kesalahan yang tidak diketahui');
    }
    return {
      success: false,
      error: err.message || 'Terjadi kesalahan yang tidak diketahui'
    };
  }
} 