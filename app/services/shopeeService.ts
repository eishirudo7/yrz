import { supabase } from '@/lib/supabase';
import { SHOPEE_PARTNER_ID, SHOPEE_PARTNER_KEY, shopeeApi } from '@/lib/shopeeConfig';
import { getValidAccessToken } from './tokenManager';
import { JSONStringify, JSONParse } from 'json-with-bigint';




export async function getShopInfo(shopId: number): Promise<any> {
    try {
        if (!shopId) {
            throw new Error('ID Toko diperlukan');
        }

        const { data, error } = await supabase
            .from('shopee_tokens')
            .select('*')
            .eq('shop_id', shopId)
            .single();

        if (error) {
            console.error('Gagal mengambil informasi toko:', error);
            throw error;
        }

        if (!data) {
            throw new Error('Toko tidak ditemukan');
        }

        return data;
    } catch (error) {
        console.error('Gagal mendapatkan informasi toko:', error);
        throw new Error('Gagal mengambil informasi toko dari database');
    }
}

export async function getAllShops(): Promise<any[]> {
    try {
        const { data, error } = await supabase
                .from('shopee_tokens')
                .select('*')
                .eq('is_active', true);

            if (error) throw error;
            if (!data || data.length === 0) {
                throw new Error("Gagal mengambil daftar toko aktif dari database");
            }
            return data;
        } catch (error) {
            console.error('Gagal mengambil daftar toko:', error);
            throw new Error('Gagal mengambil daftar toko aktif dari database');
        }
    }

export async function getRefreshCount(shopId: number): Promise<number> {
    try {
        const shopInfo = await getShopInfo(shopId);
            return shopInfo?.refresh_count || 0;
        } catch (error) {
            console.error('Gagal mendapatkan jumlah refresh:', error);
            return 0;
        }
    }

export async function getTrackingNumber(
    shopId: number, 
    orderSn: string, 
    packageNumber?: string, 
    
): Promise<any> {
  const accessToken = await getValidAccessToken(shopId);
  return shopeeApi.getTrackingNumber(shopId, orderSn, accessToken);
}

export async function getReadyToShipOrders(shopId: number, accessToken: string, pageSize: number = 20, cursor: string = ""): Promise<any> {
    return shopeeApi.getReadyToShipOrders(shopId, accessToken, pageSize, cursor);
}

export async function processReadyToShipOrders(shopId: number, orderSn: string, shippingMethod: string = 'dropoff'): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    
    const shippingParams = await shopeeApi.getShippingParameter(shopId, orderSn, accessToken);
    
    if (shippingParams.error) {
      console.error(`Error saat mendapatkan parameter pengiriman: ${JSON.stringify(shippingParams)}`);
      return shippingParams;
    }
    
    let shipResult;
    if (shippingMethod === 'pickup') {
      if (shippingParams.response.pickup) {
        shipResult = await shopeeApi.shipOrder(shopId, orderSn, accessToken, shippingParams.response.pickup);
      } else {
        return {
          success: false,
          error: "pickup_not_available",
          message: `Metode pickup tidak tersedia untuk pesanan ${orderSn}`,
          request_id: shippingParams.request_id || ''
        };
      }
    } else if (shippingMethod === 'dropoff') {
      if (shippingParams.response.dropoff) {
        shipResult = await shopeeApi.shipOrder(shopId, orderSn, accessToken, null, shippingParams.response.dropoff);
      } else {
        return {
          success: false,
          error: "dropoff_not_available",
          message: `Metode dropoff tidak tersedia untuk pesanan ${orderSn}`,
          request_id: shippingParams.request_id || ''
        };
      }
    } else {
      return {
        success: false,
        error: "invalid_shipping_method",
        message: `Metode pengiriman ${shippingMethod} tidak valid untuk pesanan ${orderSn}`,
        request_id: ''
      };
    }
    
    if (shipResult.success) {
      console.info(`Pesanan ${orderSn} berhasil dikirim : ${JSON.stringify(shipResult)}`);
    } else {
      console.error(`Terjadi kesalahan saat mengirim pesanan ${orderSn}: ${JSON.stringify(shipResult)}`);
    }
    
    return shipResult;
  } catch (error) {
    console.error(`Terjadi kesalahan internal saat memproses pesanan: ${error}`);
    return {
      success: false,
      error: "internal_server_error",
      message: `Terjadi kesalahan internal: ${error}`,
      request_id: ''
    };
  }
}

export async function getAdsDailyPerformance(shopId: number, startDate: string, endDate: string): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
            const response = await shopeeApi.getAdsDailyPerformance(shopId, accessToken, startDate, endDate);
            
            if (response.error) {
                console.error(`Error saat mendapatkan data performa iklan harian: ${JSON.stringify(response)}`);
                return response;
            }
            
            return response.response;
        } catch (error) {
            console.error(`Terjadi kesalahan saat mengambil data performa iklan harian: ${error}`);
            return {
                error: "internal_server_error",
                message: `Terjadi kesalahan internal: ${error}`,
                request_id: ''
            };
        }
}

export async function createShippingDocument(
  shopId: number,
  orderList: Array<{
    order_sn: string,
    package_number?: string,
    tracking_number?: string
  }>,
  documentType: string = 'THERMAL_AIR_WAYBILL'
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const result = await shopeeApi.createShippingDocument(shopId, accessToken, orderList, documentType);
    
    if (result.error) {
      console.error(`Error saat membuat dokumen pengiriman: ${JSON.stringify(result)}`);
      return result;
    }
    
    return result;
  } catch (error) {
    console.error(`Terjadi kesalahan saat membuat dokumen pengiriman: ${error}`);
    return {
      error: "internal_server_error",
      message: `Terjadi kesalahan internal: ${error}`,
      request_id: ''
    };
  }
}

export async function getOrderDetail(shopId: number, orderSn: string): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const result = await shopeeApi.getOrderDetail(shopId, orderSn, accessToken);
    
    if (result.error && result.error !== "") {
      console.error(`Error saat mengambil detail pesanan: ${JSON.stringify(result)}`);
      return result;
    }
    
    console.info(`Detail pesanan berhasil diambil untuk pesanan ${orderSn}`);
    return result.response;
  } catch (error) {
    console.error(`Terjadi kesalahan saat mengambil detail pesanan: ${error}`);
    return {
      error: "internal_server_error",
      message: `Terjadi kesalahan internal: ${error}`,
      request_id: ''
    };
  }
}

export function generateAuthUrl(): string {
  try {
    const redirectUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/callback`;
    const authUrl = shopeeApi.generateAuthUrl(redirectUrl);
    console.info(`URL otentikasi berhasil dibuat: ${authUrl}`);
    return authUrl;
  } catch (error) {
    console.error('Terjadi kesalahan saat membuat URL otentikasi:', error);
    throw new Error('Gagal membuat URL otentikasi');
  }
}

export function generateDeauthUrl(): string {
  const redirectUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/shops`;
  return shopeeApi.generateDeauthUrl(redirectUrl);
}

async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  
  throw lastError;
}

export async function downloadShippingDocument(
  shopId: number,
  orderList: Array<{
    order_sn: string,
    package_number?: string,
    shipping_document_type: string
  }>
): Promise<Buffer | any> {
  return retryOperation(async () => {
    const accessToken = await getValidAccessToken(shopId);
    
    console.log('Download request:', {
      shopId,
      orderList,
      accessToken: accessToken ? 'exists' : 'missing'
    });

    if (!shopId || !orderList || orderList.length === 0) {
      console.error('Invalid parameters');
      return {
        error: "invalid_parameters",
        message: "Parameter shopId dan orderList harus diisi"
      };
    }

    const formattedOrderList = orderList.map(order => {
      const formattedOrder: {
        order_sn: string,
        package_number?: string,
        shipping_document_type: string
      } = {
        order_sn: order.order_sn,
        shipping_document_type: order.shipping_document_type || "THERMAL_AIR_WAYBILL"
      };

      if (order.package_number && order.package_number.trim() !== '') {
        formattedOrder.package_number = order.package_number;
      }

      return formattedOrder;
    });

    const response = await shopeeApi.downloadShippingDocument(
      shopId, 
      accessToken, 
      formattedOrderList
    );

    console.log('Shopee API Response:', {
      isBuffer: response instanceof Buffer,
      responseType: typeof response,
      error: response.error,
      message: response.message
    });
    
    if (response instanceof Buffer) {
      return response;
    }

    if (response.error) {
      console.error('Shopee API Error:', response);
      return {
        error: response.error,
        message: response.message || "Gagal mengunduh dokumen dari Shopee API"
      };
    }

    console.error('Unexpected response format:', response);
    return {
      error: "invalid_response",
      message: "Response tidak valid dari Shopee API"
    };
  });
}

interface OrderListOptions {
  timeRangeField?: 'create_time' | 'update_time';
  startTime?: number;
  endTime?: number;
  orderStatus?: 'UNPAID' | 'READY_TO_SHIP' | 'PROCESSED' | 'SHIPPED' | 'COMPLETED' | 'IN_CANCEL' | 'CANCELLED' | 'ALL';
  pageSize?: number;
  cursor?: string;
}

export async function getOrderList(shopId: number, options: OrderListOptions = {}) {
  try {
    console.log(shopId)
    const accessToken = await getValidAccessToken(shopId);
    console.log(accessToken)
    const response = await shopeeApi.getOrderList(shopId, accessToken, {
      time_range_field: options.timeRangeField || 'create_time',
      time_from: options.startTime || Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60), // Default to 7 days ago
      time_to: options.endTime || Math.floor(Date.now() / 1000), // Default to current time
      page_size: options.pageSize || 50,
      cursor: options.cursor || '',
      order_status: options.orderStatus || 'ALL'
    });

    if (response.error) {
      throw new Error(response.message || 'Gagal mengambil daftar pesanan');
    }

    return {
      success: true,
      data: response.response,
      request_id: response.request_id
    };

  } catch (error: unknown) {
    console.error('Gagal mengambil daftar pesanan:', error);
    return {
      success: false,
      error: "fetch_failed",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function handleBuyerCancellation(
  shopId: number,
  orderSn: string,
  operation: 'ACCEPT' | 'REJECT'
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    
    console.info(`Memproses pembatalan pembeli untuk pesanan ${orderSn} dengan operasi ${operation}`);
    
    const result = await shopeeApi.handleBuyerCancellation(
      shopId,
      accessToken,
      orderSn,
      operation
    );

    if (result.error) {
      console.error(`Error saat memproses pembatalan pembeli: ${JSON.stringify(result)}`);
      return {
        success: false,
        error: result.error,
        message: result.message || 'Gagal memproses pembatalan pembeli',
        request_id: result.request_id || ''
      };
    }

    console.info(`Berhasil memproses pembatalan pembeli untuk pesanan ${orderSn}`);
    return {
      success: true,
      data: result.response,
      request_id: result.request_id
    };

  } catch (error) {
    console.error(`Terjadi kesalahan saat memproses pembatalan pembeli: ${error}`);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui',
      request_id: ''
    };
  }
}

export async function readConversation(
  shopId: number, 
  conversationId: string, 
  lastReadMessageId: string
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    // Konversi string ke BigInt
    const conversationIdBigInt = BigInt(conversationId);
    const result = await shopeeApi.readConversation(shopId, accessToken, conversationIdBigInt, lastReadMessageId);
    
    // Parse result dengan JSONParse jika perlu
    return JSONParse(JSON.stringify(result));
  } catch (error) {
    console.error('Error reading conversation:', error);
    throw error;
  }
}

export async function createDiscount(
  shopId: number,
  discountData: {
    discount_name: string,
    start_time: number,
    end_time: number
  }
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const result = await shopeeApi.addDiscount(shopId, accessToken, discountData);
    
    if (result.error) {
      console.error(`Error saat membuat diskon: ${JSON.stringify(result)}`);
      return {
        success: false,
        error: result.error,
        message: result.message || 'Gagal membuat diskon'
      };
    }
    
    return {
      success: true,
      data: result.response,
      request_id: result.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat membuat diskon:', error);
    return {
      success: false,
      error: "internal_server_error", 
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function addDiscountItems(
  shopId: number,
  discountId: number,
  items: Array<{
    item_id: number,
    purchase_limit: 0,
    model_id?: number,
    promotion_price: number,
    stock: number
  }>
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const result = await shopeeApi.addDiscountItem(shopId, accessToken, discountId, items);
    
    if (result.error) {
      console.error(`Error saat menambah item diskon: ${JSON.stringify(result)}`);
      return {
        success: false,
        error: result.error,
        message: result.message || 'Gagal menambah item diskon'
      };
    }
    
    return {
      success: true,
      data: result.response,
      request_id: result.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat menambah item diskon:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function deleteDiscount(
  shopId: number,
  discountId: number
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const result = await shopeeApi.deleteDiscount(shopId, accessToken, discountId);
    
    if (result.error) {
      return {
        success: false,
        error: result.error,
        message: result.message || 'Gagal menghapus diskon'
      };
    }
    
    return {
      success: true,
      data: result.response,
      request_id: result.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat menghapus diskon:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function deleteDiscountItems(
  shopId: number,
  discountId: number,
  itemIds: Array<{
    item_id: number,
    model_id?: number
  }>
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const result = await shopeeApi.deleteDiscountItem(shopId, accessToken, discountId, itemIds);
    
    if (result.error) {
      return {
        success: false,
        error: result.error,
        message: result.message || 'Gagal menghapus item diskon'
      };
    }
    
    return {
      success: true,
      data: result.response,
      request_id: result.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat menghapus item diskon:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function getDiscountDetails(
  shopId: number,
  discountId: number
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const result = await shopeeApi.getDiscount(shopId, accessToken, discountId);
    
    if (result.error) {
      return {
        success: false,
        error: result.error,
        message: result.message || 'Gagal mendapatkan detail diskon'
      };
    }
    
    return {
      success: true,
      data: result.response,
      request_id: result.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat mendapatkan detail diskon:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function getDiscountList(
  shopId: number,
  options: {
    discount_status: 'upcoming' | 'ongoing' | 'expired' | 'all',
    page_size?: number,
    cursor?: string
  }
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const result = await shopeeApi.getDiscountList(shopId, accessToken, options);
    
    if (result.error) {
      return {
        success: false,
        error: result.error,
        message: result.message || 'Gagal mendapatkan daftar diskon'
      };
    }
    
    return {
      success: true,
      data: result.response,
      request_id: result.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat mendapatkan daftar diskon:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function updateDiscount(
  shopId: number,
  discountId: number,
  updateData: {
    discount_name?: string,
    start_time?: number,
    end_time?: number
  }
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const result = await shopeeApi.updateDiscount(shopId, accessToken, discountId, updateData);
    
    if (result.error) {
      return {
        success: false,
        error: result.error,
        message: result.message || 'Gagal mengupdate diskon'
      };
    }
    
    return {
      success: true,
      data: result.response,
      request_id: result.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat mengupdate diskon:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function updateDiscountItems(
  shopId: number,
  discountId: number,
  items: Array<{
    item_id: number,
    purchase_limit?: number,
    model_list: Array<{
      model_id: number,
      model_promotion_price: number
    }>
  }>
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const result = await shopeeApi.updateDiscountItem(shopId, accessToken, discountId, items);
    
    if (result.error) {
      return {
        success: false,
        error: result.error,
        message: result.message || 'Gagal mengupdate item diskon'
      };
    }
    
    return {
      success: true,
      data: result.response,
      request_id: result.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat mengupdate item diskon:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function endDiscount(
  shopId: number,
  discountId: number
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const result = await shopeeApi.endDiscount(shopId, accessToken, discountId);
    
    if (result.error) {
      return {
        success: false,
        error: result.error,
        message: result.message || 'Gagal mengakhiri diskon'
      };
    }
    
    return {
      success: true,
      data: result.response,
      request_id: result.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat mengakhiri diskon:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function getItemList(
  shopId: number,
  options: {
    offset?: number,
    page_size?: number,
    item_status?: ('NORMAL' | 'BANNED' | 'DELETED' | 'UNLIST')[],
    update_time_from?: number,
    update_time_to?: number,
    item_id_list?: number[],
    need_complaint_policy?: boolean,
    need_tax_info?: boolean
  } = {}
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const result = await shopeeApi.getItemList(shopId, accessToken, options);

    if (result.error) {
      console.error(`Error saat mengambil daftar produk: ${JSON.stringify(result)}`);
      return {
        success: false,
        error: result.error,
        message: result.message || 'Gagal mengambil daftar produk'
      };
    }

    return {
      success: true,
      data: result.response,
      request_id: result.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat mengambil daftar produk:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function getItemBaseInfo(
  shopId: number,
  itemIdList: number[]
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const result = await shopeeApi.getItemBaseInfo(shopId, accessToken, itemIdList);

    if (result.error) {
      return {
        success: false,
        error: result.error,
        message: result.message || 'Gagal mengambil informasi dasar produk'
      };
    }

    return {
      success: true,
      data: result.response,
      request_id: result.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat mengambil informasi dasar produk:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function updateItem(
  shopId: number,
  itemId: number,
  updateData: {
    name?: string,
    description?: string,
    item_status?: 'NORMAL' | 'UNLIST',
    category_id?: number,
    brand?: {
      brand_id?: number,
      original_brand_name?: string
    }
  }
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const result = await shopeeApi.updateItem(shopId, accessToken, itemId, updateData);

    if (result.error) {
      return {
        success: false,
        error: result.error,
        message: result.message || 'Gagal mengupdate produk'
      };
    }

    return {
      success: true,
      data: result.response,
      request_id: result.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat mengupdate produk:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function addItem(
  shopId: number,
  itemData: {
    original_price: number,
    description: string,
    weight: number,
    item_name: string,
    category_id: number,
    brand?: {
      brand_id?: number,
      original_brand_name?: string
    },
    dimension?: {
      package_length: number,
      package_width: number,
      package_height: number
    },
    logistic_info?: Array<{
      enabled?: boolean,
      shipping_fee?: number,
      size_id?: number,
      logistic_id: number
    }>,
    condition?: string,
    item_status?: "NORMAL" | "UNLIST",
    item_sku?: string,
    image?: {
      image_id_list?: string[]
    }
  }
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const result = await shopeeApi.addItem(shopId, accessToken, itemData);

    if (result.error) {
      return {
        success: false,
        error: result.error,
        message: result.message || 'Gagal menambah produk'
      };
    }

    return {
      success: true,
      data: result.response,
      request_id: result.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat menambah produk:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function deleteItem(
  shopId: number,
  itemId: number
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const result = await shopeeApi.deleteItem(shopId, accessToken, itemId);

    if (result.error) {
      return {
        success: false,
        error: result.error,
        message: result.message || 'Gagal menghapus produk'
      };
    }

    return {
      success: true,
      data: result.response,
      request_id: result.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat menghapus produk:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function getModelList(
  shopId: number,
  itemId: number
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const result = await shopeeApi.getModelList(shopId, accessToken, itemId);

    if (result.error) {
      return {
        success: false,
        error: result.error,
        message: result.message || 'Gagal mengambil daftar model'
      };
    }

    return {
      success: true,
      data: result.response,
      request_id: result.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat mengambil daftar model:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function getItemLimit(shopId: number): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const result = await shopeeApi.getItemLimit(shopId, accessToken);

    if (result.data.error) {
      console.error(`Error saat mengambil limit produk: ${JSON.stringify(result.data)}`);
      return {
        error: result.data.error,
        message: result.data.message || 'Gagal mengambil limit produk',
        request_id: result.data.request_id
      };
    }

    console.info(`Berhasil mengambil limit produk untuk toko ${shopId}`);
    return {
      error: '',
      message: '',
      request_id: result.data.request_id,
      response: result.data.response
    };

  } catch (error) {
    console.error('Kesalahan saat mengambil limit produk:', error);
    return {
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui',
      request_id: '',
      response: null
    };
  }
}

export async function updateStock(
  shopId: number,
  itemId: number,
  stockInfo: {
    stock_list: Array<{
      model_id?: number,
      seller_stock: Array<{
        location_id?: string,
        stock: number
      }>
    }>
  }
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    
    // Validasi input
    if (!stockInfo.stock_list || stockInfo.stock_list.length === 0) {
      throw new Error('stock_list tidak boleh kosong');
    }

    // Bagi stock_list menjadi batch-batch 50 item
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < stockInfo.stock_list.length; i += batchSize) {
      batches.push(stockInfo.stock_list.slice(i, i + batchSize));
    }

    let successList: any[] = [];
    let failureList: any[] = [];

    // Proses setiap batch
    for (const batch of batches) {
      const batchResult = await shopeeApi.updateStock(shopId, accessToken, itemId, {
        stock_list: batch
      });

      if (batchResult.error) {
        console.error(`Error saat mengupdate batch stok: ${JSON.stringify(batchResult)}`);
        failureList = [...failureList, ...(batchResult.response?.failure_list || [])];
      } else {
        successList = [...successList, ...(batchResult.response?.success_list || [])];
        if (batchResult.response?.failure_list?.length > 0) {
          failureList = [...failureList, ...batchResult.response.failure_list];
        }
      }
    }

    // Log hasil update
    if (failureList.length > 0) {
      console.warn(`Beberapa update stok gagal: ${JSON.stringify(failureList)}`);
    }

    console.info(`Berhasil mengupdate stok untuk produk ${itemId}`);
    return {
      success: true,
      data: {
        success_list: successList,
        failure_list: failureList
      },
      warning: failureList.length > 0 ? 'Beberapa model gagal diupdate' : undefined
    };

  } catch (error) {
    console.error('Kesalahan saat mengupdate stok:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function getItemPromotion(
  shopId: number,
  itemIdList: number[]
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const result = await shopeeApi.getItemPromotion(shopId, accessToken, itemIdList);

    if (result.error) {
      console.error(`Error saat mengambil informasi promosi produk: ${JSON.stringify(result)}`);
      return {
        success: false,
        error: result.error,
        message: result.message || 'Gagal mengambil informasi promosi produk'
      };
    }

    return {
      success: true,
      data: result.response,
      request_id: result.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat mengambil informasi promosi produk:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function getShopPerformance(shopId: number): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const result = await shopeeApi.getShopPerformance(shopId, accessToken);

    if (result.error) {
      console.error(`Error saat mengambil performa toko: ${JSON.stringify(result)}`);
      return {
        success: false,
        error: result.error,
        message: result.message || 'Gagal mengambil performa toko'
      };
    }

    console.info(`Berhasil mengambil performa toko ${shopId}`);
    return {
      success: true,
      data: result.response,
      request_id: result.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat mengambil performa toko:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function getShopPenalty(shopId: number): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const result = await shopeeApi.getShopPenalty(shopId, accessToken);

    if (result.error) {
      console.error(`Error saat mengambil informasi penalti toko: ${JSON.stringify(result)}`);
      return {
        success: false,
        error: result.error,
        message: result.message || 'Gagal mengambil informasi penalti toko'
      };
    }

    console.info(`Berhasil mengambil informasi penalti untuk toko ${shopId}`);
    return {
      success: true,
      data: result.response,
      request_id: result.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat mengambil informasi penalti toko:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function cancelOrder(
  shopId: number,
  orderSn: string,
  itemList: Array<{
    item_id: number,
    model_id: number
  }>
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    
    console.info(`Memproses pembatalan pesanan ${orderSn}`);
    
    const result = await shopeeApi.cancelOrder(
      shopId,
      accessToken,
      orderSn,
      itemList
    );

    if (result.error) {
      console.error(`Error saat membatalkan pesanan: ${JSON.stringify(result)}`);
      return {
        success: false,
        error: result.error,
        message: result.message || 'Gagal membatalkan pesanan',
        request_id: result.request_id || ''
      };
    }

    console.info(`Berhasil membatalkan pesanan ${orderSn}`);
    return {
      success: true,
      data: result.response,
      request_id: result.request_id
    };

  } catch (error) {
    console.error(`Terjadi kesalahan saat membatalkan pesanan: ${error}`);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui',
      request_id: ''
    };
  }
}

export async function blockShopWebhook(shopId: number): Promise<any> {
  try {
    if (!shopId) {
      throw new Error('ID Toko diperlukan');
    }

    // 1. Dapatkan daftar toko yang diblokir saat ini
    const currentConfig = await shopeeApi.getAppPushConfig();
    
    if (currentConfig.error) {
      console.error('Gagal mendapatkan konfigurasi push:', currentConfig.error);
      return {
        success: false,
        error: currentConfig.error,
        message: currentConfig.message || 'Gagal mendapatkan konfigurasi push',
        request_id: currentConfig.request_id
      };
    }

    // 2. Gabungkan dengan daftar yang sudah ada
    const currentBlockedList = currentConfig.response.blocked_shop_id_list || [];
    if (!currentBlockedList.includes(shopId)) {
      currentBlockedList.push(shopId);
      console.log("data yang akan diblokir", currentBlockedList);
    }

    // 3. Kirim request dengan daftar yang diperbarui
    const result = await shopeeApi.setAppPushConfig({
      blocked_shop_id_list: currentBlockedList
    });

    if (result.error) {
      console.error(`Gagal memblokir webhook toko: ${JSON.stringify(result)}`);
      return {
        success: false,
        error: result.error,
        message: result.message || 'Gagal memblokir webhook toko',
        request_id: result.request_id
      };
    }

    // 4. Update status toko di database
    const { error: updateError } = await supabase
      .from('shopee_tokens')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('shop_id', shopId);

    if (updateError) {
      console.error('Gagal mengupdate status toko:', updateError);
      throw updateError;
    }

    return {
      success: true,
      message: 'Berhasil memblokir webhook toko',
      data: result.response,
      request_id: result.request_id
    };

  } catch (error) {
    console.error('Kesalahan saat memblokir webhook toko:', error);
    return {
      success: false,
      error: 'BLOCK_WEBHOOK_FAILED',
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function unblockShopWebhook(shopId: number): Promise<any> {
  try {
    if (!shopId) {
      throw new Error('ID Toko diperlukan');
    }

    // Dapatkan konfigurasi push saat ini
    const currentConfig = await shopeeApi.getAppPushConfig();
    
    if (currentConfig.error) {
      console.error('Gagal mendapatkan konfigurasi push:', currentConfig.error);
      return {
        success: false,
        error: currentConfig.error,
        message: currentConfig.message || 'Gagal mendapatkan konfigurasi push',
        request_id: currentConfig.request_id
      };
    }

    // Cek apakah toko ada dalam daftar yang diblokir
    const currentBlockedList = currentConfig.response.blocked_shop_id_list || [];
    console.log("currentBlockedList", currentBlockedList);
    if (!currentBlockedList.includes(shopId)) {
      return {
        success: true,
        message: 'Toko tidak dalam status diblokir',
        data: {
          shop_id: shopId,
          is_blocked: false
        },
        request_id: currentConfig.request_id
      };
    }

    // Hapus shopId dari daftar yang diblokir
    const newBlockedList = currentBlockedList.filter((id: number) => id !== shopId);
    console.log("newBlockedList", newBlockedList);
    
    // Kirim request dengan daftar yang diperbarui
    const result = await shopeeApi.setAppPushConfig({
      blocked_shop_id_list: newBlockedList
    });

    // Update status toko di database
    const { error: updateError } = await supabase
      .from('shopee_tokens')
      .update({ 
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('shop_id', shopId);

    if (updateError) {
      console.error('Gagal mengupdate status toko:', updateError);
      throw updateError;
    }

    return {
      success: true,
      message: 'Berhasil membuka blokir webhook toko',
      data: result.response,
      request_id: result.request_id
    };

  } catch (error) {
    console.error('Kesalahan saat membuka blokir webhook toko:', error);
    return {
      success: false,
      error: 'UNBLOCK_WEBHOOK_FAILED',
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function getReturnList(
  shopId: number,
  options: {
    page_no?: number,
    page_size?: number,
    create_time_from?: number,
    create_time_to?: number,
    update_time_from?: number,
    update_time_to?: number,
    status?: 'REQUESTED' | 'ACCEPTED' | 'CANCELLED' | 'JUDGING' | 'CLOSED' | 'PROCESSING' | 'SELLER_DISPUTE',
    return_solution?: 'RETURN_REFUND' | 'REFUND',
    return_reason?: 'NONRECEIPT' | 'WRONG_ITEM' | 'ITEM_DAMAGED' | 'DIFF_DESC' | 'MUITAL_AGREE' | 
      'OTHER' | 'USED' | 'NO_REASON' | 'ITEM_WRONGDAMAGED' | 'CHANGE_MIND' | 'ITEM_MISSING' | 
      'EXPECTATION_FAILED' | 'ITEM_FAKE' | 'PHYSICAL_DMG' | 'FUNCTIONAL_DMG' | 'ITEM_NOT_FIT' | 
      'SUSPICIOUS_PARCEL' | 'EXPIRED_PRODUCT' | 'WRONG_ORDER_INFO' | 'WRONG_ADDRESS' | 
      'CHANGE_OF_MIND' | 'SELLER_SENT_WRONG_ITEM' | 'SPILLED_CONTENTS' | 'BROKEN_PRODUCTS' | 
      'DAMAGED_PACKAGE' | 'SCRATCHED' | 'DAMAGED_OTHERS',
    negotiation_status?: 'PENDING_RESPOND' | 'ACCEPTED' | 'REJECTED' | 'PENDING_BUYER_RESPOND' | 'TERMINATED',
    seller_proof_status?: 'PENDING' | 'ACCEPTED' | 'REJECTED',
    seller_compensation_status?: 'NOT_REQUIRED' | 'PENDING_REQUEST' | 'ACCEPTED' | 'REJECTED'
  } = {}
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    
    // Set default values
    const defaultOptions = {
      page_no: 0,
      page_size: 50,
    };

    // Merge dengan options yang diberikan
    const finalOptions = {
      ...defaultOptions,
      ...options
    };

    const result = await shopeeApi.getReturnList(
      shopId,
      accessToken,
      finalOptions
    );

    if (result.error) {
      console.error(`Error saat mengambil daftar retur: ${JSON.stringify(result)}`);
      return {
        success: false,
        error: result.error,
        message: result.message || 'Gagal mengambil daftar retur',
        request_id: result.request_id
      };
    }

    return {
      success: true,
      data: result.response,
      more: result.more,
      request_id: result.request_id
    };

  } catch (error) {
    console.error('Kesalahan saat mengambil daftar retur:', error);
    return {
      success: false,
      error: 'FETCH_RETURNS_FAILED',
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function unlistItems(
  shopId: number,
  items: Array<{
    item_id: number,
    unlist: boolean
  }>
): Promise<any> {
  try {
    // Validasi input
    if (!shopId) {
      throw new Error('ID Toko diperlukan');
    }

    if (!items || items.length === 0) {
      throw new Error('Daftar item diperlukan');
    }

    if (items.length > 50) {
      throw new Error('Maksimal 50 item dapat diproses dalam satu waktu');
    }

    // Dapatkan access token
    const accessToken = await getValidAccessToken(shopId);

    // Proses unlist item
    const result = await shopeeApi.unlistItem(shopId, accessToken, items);

    if (result.error) {
      console.error(`Error saat unlist item: ${JSON.stringify(result)}`);
      return {
        success: false,
        error: result.error,
        message: result.message || 'Gagal unlist item',
        request_id: result.request_id
      };
    }

    // Log hasil untuk item yang berhasil dan gagal
    if (result.response.success_list?.length > 0) {
      console.info(`Berhasil memproses ${result.response.success_list.length} item`);
    }

    if (result.response.failure_list?.length > 0) {
      console.warn(`Gagal memproses ${result.response.failure_list.length} item:`, 
        JSON.stringify(result.response.failure_list));
    }

    return {
      success: true,
      data: result.response,
      request_id: result.request_id,
      warning: result.warning
    };

  } catch (error) {
    console.error('Kesalahan saat memproses unlist item:', error);
    return {
      success: false,
      error: 'UNLIST_ITEMS_FAILED',
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}
