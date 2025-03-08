import { shopeeApi } from '@/lib/shopeeConfig';
import { getValidAccessToken } from './tokenManager';

export async function getFlashSaleTimeSlotId(
  shopId: number,
  startTime: number,
  endTime: number
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const response = await shopeeApi.getFlashSaleTimeSlotId(shopId, accessToken, {
      start_time: startTime,
      end_time: endTime
    });

    if (response.error) {
      return {
        success: false,
        error: response.error,
        message: response.message || 'Gagal mendapatkan time slot ID'
      };
    }

    return {
      success: true,
      data: response.response,
      request_id: response.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat mendapatkan time slot ID:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function createShopFlashSale(
  shopId: number,
  timeslotId: number
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const response = await shopeeApi.createShopFlashSale(shopId, accessToken, timeslotId);

    if (response.error) {
      return {
        success: false,
        error: response.error,
        message: response.message || 'Gagal membuat flash sale'
      };
    }

    return {
      success: true,
      data: response.response,
      request_id: response.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat membuat flash sale:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function getFlashSaleItemCriteria(
  shopId: number,
  itemIdList: number[]
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const response = await shopeeApi.getFlashSaleItemCriteria(shopId, accessToken, itemIdList);

    if (response.error) {
      return {
        success: false,
        error: response.error,
        message: response.message || 'Gagal mendapatkan kriteria item'
      };
    }

    return {
      success: true,
      data: response.response,
      request_id: response.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat mendapatkan kriteria item:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function addShopFlashSaleItems(
  shopId: number,
  data: {
    flash_sale_id: number,
    items : Array<{
      item_id: number,
      purchase_limit: number,
      models: Array<{
        model_id: number,
        input_promo_price: number,
        stock: number
      }>
    }>
  }
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const response = await shopeeApi.addShopFlashSaleItems(shopId, accessToken, data);

    if (response.error) {
      return {
        success: false,
        error: response.error,
        message: response.message || 'Gagal menambahkan item flash sale',
        failed_items: response.response?.failed_items || []
      };
    }

    return {
      success: true,
      data: response.response,
      request_id: response.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat menambahkan item flash sale:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function getShopFlashSaleList(
  shopId: number,
  options: {
    type: number,
    start_time?: number,
    end_time?: number,
    pagination_offset: number,
    pagination_entry_count: number
  }
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const response = await shopeeApi.getShopFlashSaleList(shopId, accessToken, {
      type: options.type,
      start_time: options.start_time,
      end_time: options.end_time,
      pagination_offset: options.pagination_offset,
      pagination_entry_count: options.pagination_entry_count
    });

    if (response.error) {
      return {
        success: false,
        error: response.error,
        message: response.message || 'Gagal mendapatkan daftar flash sale'
      };
    }

    return {
      success: true,
      data: response.response,
      request_id: response.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat mendapatkan daftar flash sale:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function getShopFlashSale(
  shopId: number,
  flashSaleId: number
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const response = await shopeeApi.getShopFlashSale(shopId, accessToken, flashSaleId);

    if (response.error) {
      return {
        success: false,
        error: response.error,
        message: response.message || 'Gagal mendapatkan detail flash sale'
      };
    }

    return {
      success: true,
      data: response.response,
      request_id: response.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat mendapatkan detail flash sale:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function updateShopFlashSale(
  shopId: number,
  data: {
    flash_sale_id: number,
    status: 1 | 2
  }
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const response = await shopeeApi.updateShopFlashSale(shopId, accessToken, data);

    if (response.error) {
      return {
        success: false,
        error: response.error,
        message: response.message || 'Gagal mengupdate flash sale'
      };
    }

    return {
      success: true,
      data: response.response,
      request_id: response.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat mengupdate flash sale:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function updateShopFlashSaleItems(
  shopId: number,
  data: {
    flash_sale_id: number,
    items: Array<{
      item_id: number,
      purchase_limit?: number,
      models: Array<{
        model_id: number,
        status: 0 | 1,
        input_promo_price?: number,
        stock?: number
      }>
    }>
  }
): Promise<any> {
  // Validasi dasar
  if (!Number.isInteger(data.flash_sale_id) || data.flash_sale_id < 0) {
    return {
      success: false,
      error: "invalid_parameter",
      message: "flash_sale_id harus berupa integer positif"
    };
  }

  // Validasi items
  for (const item of data.items) {
    if (item.purchase_limit !== undefined && (item.purchase_limit < 0 || !Number.isInteger(item.purchase_limit))) {
      return {
        success: false,
        error: "invalid_parameter", 
        message: "purchase_limit harus berupa integer >= 0"
      };
    }

    for (const model of item.models) {
      if (model.stock !== undefined && (model.stock < 1 || !Number.isInteger(model.stock))) {
        return {
          success: false,
          error: "invalid_parameter",
          message: "stock harus berupa integer >= 1"
        };
      }
    }
  }

  try {
    const accessToken = await getValidAccessToken(shopId);
    const response = await shopeeApi.updateShopFlashSaleItems(shopId, accessToken, data);

    if (response.error) {
      return {
        success: false,
        error: response.error,
        message: response.message || 'Gagal mengupdate item flash sale'
      };
    }

    return {
      success: true,
      data: response.response,
      request_id: response.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat mengupdate item flash sale:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function deleteShopFlashSale(
  shopId: number,
  flashSaleId: number
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const response = await shopeeApi.deleteShopFlashSale(shopId, accessToken, flashSaleId);

    if (response.error) {
      return {
        success: false,
        error: response.error,
        message: response.message || 'Gagal menghapus flash sale'
      };
    }

    return {
      success: true,
      data: response.response,
      request_id: response.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat menghapus flash sale:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function deleteShopFlashSaleItems(
  shopId: number,
  data: {
    flash_sale_id: number,
    item_ids: number[]
  }
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(shopId);
    const response = await shopeeApi.deleteShopFlashSaleItems(shopId, accessToken, data);

    if (response.error) {
      return {
        success: false,
        error: response.error,
        message: response.message || 'Gagal menghapus item flash sale'
      };
    }

    return {
      success: true,
      data: response.response,
      request_id: response.request_id
    };
  } catch (error) {
    console.error('Kesalahan saat menghapus item flash sale:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

interface FlashSaleItem {
  item_id: number;
  item_name: string;
  image: string;
  status: number;
}

interface FlashSaleModel {
  item_id: number;
  model_id: number;
  model_name: string;
  original_price: number;
  promotion_price_with_tax: number;
  campaign_stock: number;
  purchase_limit: number;
  status: number;
  stock: number;
}

interface FlashSaleItemsResponse {
  item_info: FlashSaleItem[];
  models: FlashSaleModel[];
}

export function processFlashSaleItems(response: any): FlashSaleItemsResponse {
  const items = response.response.item_info.map((item: any) => ({
    item_id: item.item_id,
    item_name: item.item_name,
    image: item.image,
    status: item.status
  }));

  const models = response.response.models.map((model: any) => ({
    item_id: model.item_id,
    model_id: model.model_id,
    model_name: model.model_name,
    original_price: model.original_price,
    promotion_price_with_tax: model.promotion_price_with_tax,
    campaign_stock: model.campaign_stock,
    purchase_limit: model.purchase_limit,
    status: model.status,
    stock: model.stock
  }));

  return {
    item_info: items,
    models: models
  };
}

export async function getShopFlashSaleItems(
  shopId: number,
  flashSaleId: number,
  options?: {
    minItems?: number,
    offset?: number
  }
): Promise<any> {
  try {
    const minItems = options?.minItems || 50;
    const limit = 100;
    const offset = options?.offset || 0;
    let allItems: any[] = [];
    
    const accessToken = await getValidAccessToken(shopId);
    
    const firstResponse = await shopeeApi.getShopFlashSaleItems(shopId, accessToken, {
      flash_sale_id: flashSaleId,
      offset: offset,
      limit: limit
    });

    if (firstResponse.error) {
      return {
        success: false,
        error: firstResponse.error,
        message: firstResponse.message || 'Gagal mendapatkan daftar item flash sale'
      };
    }

    allItems = [...(firstResponse.response?.item_info || [])];
    const total = firstResponse.response?.total_count || 0;
    const models = firstResponse.response?.models || [];

    return {
      success: true,
      data: {
        items: allItems,
        models: models,
        total: total,
        has_more: allItems.length < total
      },
      request_id: firstResponse.request_id
    };

  } catch (error) {
    console.error('Kesalahan saat mendapatkan daftar item flash sale:', error);
    return {
      success: false,
      error: "internal_server_error",
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
} 

interface FlashSaleAddItemModel {
  model_id: number;
  input_promo_price: number;
  stock: number;
}

interface FlashSaleAddItem {
  item_id: number;
  purchase_limit: number;
  models: FlashSaleAddItemModel[];
}

interface FlashSaleAddItemsRequest {
  shop_id: string;
  flash_sale_id: string;
  items: FlashSaleAddItem[];
}

export function prepareFlashSaleAddItems(
  shopId: string, 
  flashSaleId: string, 
  items: FlashSaleItemsResponse
): FlashSaleAddItemsRequest {
  // Transform items dan models menjadi format yang sesuai untuk add items
  const formattedItems = items.item_info.map(item => {
    const itemModels = items.models
      .filter(model => model.item_id === item.item_id)
      .map(model => ({
        model_id: model.model_id,
        input_promo_price: model.promotion_price_with_tax,
        stock: model.campaign_stock
      }));

    return {
      item_id: item.item_id,
      purchase_limit: 0, // Default 0 sesuai contoh
      models: itemModels
    };
  });

  return {
    shop_id: shopId,
    flash_sale_id: flashSaleId,
    items: formattedItems
  };
} 