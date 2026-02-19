/**
 * Shopee API - Products Module
 * Handles product/item listing, management, and stock updates
 */

import { ShopeeClient } from './client';
import { ItemListOptions, StockInfo } from './types';

/**
 * Get item list with filters
 */
export async function getItemList(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    options: ItemListOptions = {}
): Promise<any> {
    const params = new URLSearchParams({
        offset: (options.offset || 0).toString(),
        page_size: (options.page_size || 20).toString()
    });

    if (options.item_status?.length) {
        options.item_status.forEach(status => {
            params.append('item_status', status);
        });
    }

    if (options.update_time_from) {
        params.append('update_time_from', options.update_time_from.toString());
    }

    if (options.update_time_to) {
        params.append('update_time_to', options.update_time_to.toString());
    }

    return client.get('/api/v2/product/get_item_list', params, accessToken, shopId);
}

/**
 * Get item base info for multiple items
 */
export async function getItemBaseInfo(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    itemIdList: number[]
): Promise<any> {
    const params = new URLSearchParams({
        item_id_list: itemIdList.join(',')
    });

    return client.get('/api/v2/product/get_item_base_info', params, accessToken, shopId);
}

/**
 * Get model/variant list for an item
 */
export async function getModelList(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    itemId: number
): Promise<any> {
    const params = new URLSearchParams({
        item_id: itemId.toString()
    });

    console.info(`Getting model list for item: ${itemId}`);
    return client.get('/api/v2/product/get_model_list', params, accessToken, shopId);
}

/**
 * Get item limit for shop
 */
export async function getItemLimit(
    client: ShopeeClient,
    shopId: number,
    accessToken: string
): Promise<any> {
    console.info('Getting item limit for shop');
    return client.get('/api/v2/product/get_item_limit', new URLSearchParams(), accessToken, shopId);
}

/**
 * Update item stock
 */
export async function updateStock(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    itemId: number,
    stockInfo: StockInfo
): Promise<any> {
    // Validate input
    if (!stockInfo.stock_list || stockInfo.stock_list.length === 0 || stockInfo.stock_list.length > 50) {
        throw new Error('stock_list must contain between 1 and 50 items');
    }

    const body = {
        item_id: itemId,
        ...stockInfo
    };

    console.info(`Updating stock for item: ${itemId}`);
    return client.post('/api/v2/product/update_stock', body, accessToken, shopId);
}

/**
 * Update item information
 */
export async function updateItem(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    itemId: number,
    updateData: {
        name?: string;
        description?: string;
        item_status?: 'NORMAL' | 'UNLIST';
        category_id?: number;
        brand?: {
            brand_id?: number;
            original_brand_name?: string;
        };
    }
): Promise<any> {
    const body = {
        item_id: itemId,
        ...updateData
    };

    console.info(`Updating item: ${itemId}`);
    return client.post('/api/v2/product/update_item', body, accessToken, shopId);
}

/**
 * Unlist items (batch)
 */
export async function unlistItem(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    itemList: Array<{ item_id: number; unlist: boolean }>
): Promise<any> {
    const body = {
        item_list: itemList
    };

    console.info(`Unlisting ${itemList.length} items`);
    return client.post('/api/v2/product/unlist_item', body, accessToken, shopId);
}

/**
 * Add new item
 */
export async function addItem(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    itemData: {
        original_price: number;
        description: string;
        weight: number;
        item_name: string;
        category_id: number;
        brand?: {
            brand_id?: number;
            original_brand_name?: string;
        };
        logistic_info?: Array<{
            enabled?: boolean;
            shipping_fee?: number;
            size_id?: number;
            logistic_id: number;
        }>;
        condition?: string;
        item_status?: 'NORMAL' | 'UNLIST';
        item_sku?: string;
        image?: {
            image_id_list?: string[];
        };
    }
): Promise<any> {
    console.info('Adding new item');
    return client.post('/api/v2/product/add_item', itemData, accessToken, shopId);
}

/**
 * Delete item
 */
export async function deleteItem(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    itemId: number
): Promise<any> {
    const body = {
        item_id: itemId
    };

    console.info(`Deleting item: ${itemId}`);
    return client.post('/api/v2/product/delete_item', body, accessToken, shopId);
}

/**
 * Get item promotion info
 */
export async function getItemPromotion(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    itemIdList: number[]
): Promise<any> {
    const params = new URLSearchParams({
        item_id_list: itemIdList.join(',')
    });

    return client.get('/api/v2/product/get_item_promotion', params, accessToken, shopId);
}
