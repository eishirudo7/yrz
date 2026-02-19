/**
 * Shopee API - Discounts & Promotions Module
 * Handles discounts, flash sales, and promotional activities
 */

import axios from 'axios';
import { ShopeeClient } from './client';
import { DiscountData, DiscountItem, DiscountItemUpdate, DiscountListOptions, FlashSaleItem } from './types';

/**
 * Create a new discount
 */
export async function addDiscount(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    discountData: DiscountData
): Promise<any> {
    // Validate input
    if (!discountData.discount_name || discountData.discount_name.trim().length === 0) {
        throw new Error('Discount name cannot be empty');
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const oneHourInSeconds = 3600;
    const maxDurationInSeconds = 180 * 24 * 3600; // 180 days

    if (discountData.start_time <= currentTime + oneHourInSeconds) {
        throw new Error('Start time must be at least 1 hour from now');
    }

    if (discountData.end_time <= discountData.start_time + oneHourInSeconds) {
        throw new Error('End time must be at least 1 hour after start time');
    }

    if (discountData.end_time - discountData.start_time > maxDurationInSeconds) {
        throw new Error('Discount period cannot exceed 180 days');
    }

    console.info(`Creating discount: ${discountData.discount_name}`);
    return client.post('/api/v2/discount/add_discount', discountData, accessToken, shopId);
}

/**
 * Add items to a discount
 */
export async function addDiscountItem(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    discountId: number,
    items: DiscountItem[]
): Promise<any> {
    if (!items || items.length === 0 || items.length > 50) {
        throw new Error('items must contain between 1 and 50 items');
    }

    const body = {
        discount_id: discountId,
        item_list: items
    };

    console.info(`Adding ${items.length} items to discount ${discountId}`);
    return client.post('/api/v2/discount/add_discount_item', body, accessToken, shopId);
}

/**
 * Get discount details
 */
export async function getDiscount(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    discountId: number
): Promise<any> {
    const params = new URLSearchParams({
        discount_id: discountId.toString()
    });

    return client.get('/api/v2/discount/get_discount', params, accessToken, shopId);
}

/**
 * Get list of discounts
 */
export async function getDiscountList(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    options: DiscountListOptions
): Promise<any> {
    const params = new URLSearchParams({
        discount_status: options.discount_status
    });

    if (options.page_size) {
        params.append('page_size', options.page_size.toString());
    }
    if (options.cursor) {
        params.append('cursor', options.cursor);
    }

    return client.get('/api/v2/discount/get_discount_list', params, accessToken, shopId);
}

/**
 * Update discount information
 */
export async function updateDiscount(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    discountId: number,
    updateData: {
        discount_name?: string;
        start_time?: number;
        end_time?: number;
    }
): Promise<any> {
    const body = {
        discount_id: discountId,
        ...updateData
    };

    return client.post('/api/v2/discount/update_discount', body, accessToken, shopId);
}

/**
 * Update discount items
 */
export async function updateDiscountItem(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    discountId: number,
    items: DiscountItemUpdate[]
): Promise<any> {
    const body = {
        discount_id: discountId,
        item_list: items
    };

    console.info(`Updating ${items.length} items in discount ${discountId}`);
    return client.post('/api/v2/discount/update_discount_item', body, accessToken, shopId);
}

/**
 * Delete a discount
 */
export async function deleteDiscount(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    discountId: number
): Promise<any> {
    const body = {
        discount_id: discountId
    };

    console.info(`Deleting discount ${discountId}`);
    return client.post('/api/v2/discount/delete_discount', body, accessToken, shopId);
}

/**
 * Delete items from a discount
 */
export async function deleteDiscountItem(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    discountId: number,
    itemIds: Array<{ item_id: number; model_id?: number }>
): Promise<any> {
    const body = {
        discount_id: discountId,
        item_id_list: itemIds
    };

    console.info(`Deleting ${itemIds.length} items from discount ${discountId}`);
    return client.post('/api/v2/discount/delete_discount_item', body, accessToken, shopId);
}

/**
 * End a discount
 */
export async function endDiscount(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    discountId: number
): Promise<any> {
    const body = {
        discount_id: discountId
    };

    console.info(`Ending discount ${discountId}`);
    return client.post('/api/v2/discount/end_discount', body, accessToken, shopId);
}

// ============= Flash Sale Functions =============

/**
 * Get flash sale time slot IDs
 */
export async function getFlashSaleTimeSlotId(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    options: { start_time: number; end_time: number }
): Promise<any> {
    const params = new URLSearchParams({
        start_time: options.start_time.toString(),
        end_time: options.end_time.toString()
    });

    return client.get('/api/v2/shop_flash_sale/get_time_slot_id', params, accessToken, shopId);
}

/**
 * Create a shop flash sale
 */
export async function createShopFlashSale(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    timeslotId: number
): Promise<any> {
    const body = {
        timeslot_id: timeslotId
    };

    console.info(`Creating flash sale for timeslot ${timeslotId}`);
    return client.post('/api/v2/shop_flash_sale/create_shop_flash_sale', body, accessToken, shopId);
}

/**
 * Get flash sale item criteria
 */
export async function getFlashSaleItemCriteria(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    itemIdList: number[]
): Promise<any> {
    const params = new URLSearchParams({
        item_id_list: itemIdList.join(',')
    });

    return client.get('/api/v2/shop_flash_sale/get_item_criteria', params, accessToken, shopId);
}

/**
 * Add items to a flash sale
 */
export async function addShopFlashSaleItems(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    flashSaleId: number,
    items: FlashSaleItem[]
): Promise<any> {
    const body = {
        flash_sale_id: flashSaleId,
        items
    };

    console.info(`Adding ${items.length} items to flash sale ${flashSaleId}`);
    return client.post('/api/v2/shop_flash_sale/add_shop_flash_sale_items', body, accessToken, shopId);
}

/**
 * Get shop flash sale list
 */
export async function getShopFlashSaleList(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    options: { page_no?: number; page_size?: number; time_status?: string }
): Promise<any> {
    const params = new URLSearchParams({
        page_no: (options.page_no || 1).toString(),
        page_size: (options.page_size || 20).toString()
    });

    if (options.time_status) {
        params.append('time_status', options.time_status);
    }

    return client.get('/api/v2/shop_flash_sale/get_shop_flash_sale_list', params, accessToken, shopId);
}

/**
 * Get shop flash sale detail
 */
export async function getShopFlashSaleDetail(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    flashSaleId: number
): Promise<any> {
    const params = new URLSearchParams({
        flash_sale_id: flashSaleId.toString()
    });

    return client.get('/api/v2/shop_flash_sale/get_shop_flash_sale', params, accessToken, shopId);
}

/**
 * Update flash sale status
 */
export async function updateShopFlashSaleStatus(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    flashSaleId: number,
    action: 'enable' | 'disable'
): Promise<any> {
    const body = {
        flash_sale_id: flashSaleId,
        action
    };

    console.info(`Updating flash sale ${flashSaleId} status to ${action}`);
    return client.post('/api/v2/shop_flash_sale/update_shop_flash_sale_status', body, accessToken, shopId);
}

/**
 * Delete a flash sale
 */
export async function deleteShopFlashSale(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    flashSaleId: number
): Promise<any> {
    const body = {
        flash_sale_id: flashSaleId
    };

    console.info(`Deleting flash sale ${flashSaleId}`);
    return client.post('/api/v2/shop_flash_sale/delete_shop_flash_sale', body, accessToken, shopId);
}

/**
 * Delete items from flash sale
 */
export async function deleteShopFlashSaleItems(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    flashSaleId: number,
    itemIds: number[]
): Promise<any> {
    if (!itemIds || itemIds.length === 0) {
        throw new Error('item_ids cannot be empty');
    }

    const body = {
        flash_sale_id: flashSaleId,
        item_ids: itemIds
    };

    console.info(`Deleting ${itemIds.length} items from flash sale ${flashSaleId}`);
    return client.post('/api/v2/shop_flash_sale/delete_shop_flash_sale_items', body, accessToken, shopId);
}
