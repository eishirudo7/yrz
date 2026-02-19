/**
 * Shopee API - Orders Module
 * Handles order listing, details, shipping, and cancellation
 */

import { ShopeeClient } from './client';
import { OrderListOptions } from './types';

/**
 * Get order details by order SN
 */
export async function getOrderDetail(
    client: ShopeeClient,
    shopId: number,
    orderSn: string,
    accessToken: string
): Promise<any> {
    const params = new URLSearchParams({
        order_sn_list: orderSn,
        response_optional_fields: 'buyer_user_id,buyer_username,estimated_shipping_fee,recipient_address,actual_shipping_fee,goods_to_declare,note,note_update_time,item_list,pay_time,dropshipper,dropshipper_phone,split_up,buyer_cancel_reason,cancel_by,cancel_reason,actual_shipping_fee_confirmed,buyer_cpf_id,fulfillment_flag,pickup_done_time,package_list,shipping_carrier,payment_method,total_amount,buyer_username,invoice_data,no_plastic_packing,order_chargeable_weight_gram,edt'
    });

    console.info(`Getting order detail for: ${orderSn}`);
    return client.get('/api/v2/order/get_order_detail', params, accessToken, shopId);
}

/**
 * Get list of orders with filters
 */
export async function getOrderList(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    options: OrderListOptions
): Promise<any> {
    const params = new URLSearchParams({
        time_range_field: options.time_range_field,
        time_from: options.time_from.toString(),
        time_to: options.time_to.toString(),
        page_size: (options.page_size || 20).toString(),
    });

    if (options.cursor) {
        params.append('cursor', options.cursor);
    }

    if (options.order_status && options.order_status !== 'ALL') {
        params.append('order_status', options.order_status);
    }

    if (options.response_optional_fields?.length) {
        params.append('response_optional_fields', options.response_optional_fields.join(','));
    }

    console.info(`Getting order list with filters`);
    return client.get('/api/v2/order/get_order_list', params, accessToken, shopId);
}

/**
 * Get orders ready to ship (shipment list)
 */
export async function getReadyToShipOrders(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    pageSize: number = 20,
    cursor: string = ''
): Promise<any> {
    const params = new URLSearchParams({
        page_size: pageSize.toString(),
    });

    if (cursor) {
        params.append('cursor', cursor);
    }

    return client.get('/api/v2/order/get_shipment_list', params, accessToken, shopId);
}

/**
 * Ship an order (pickup or dropoff)
 */
export async function shipOrder(
    client: ShopeeClient,
    shopId: number,
    orderSn: string,
    accessToken: string,
    pickup?: any,
    dropoff?: any
): Promise<any> {
    const body: any = { order_sn: orderSn };

    if (pickup) {
        body.pickup = pickup;
    } else if (dropoff) {
        body.dropoff = dropoff;
    } else {
        throw new Error('Harus menyediakan informasi pickup atau dropoff');
    }

    console.info(`Shipping order: ${orderSn}`);

    try {
        const response = await client.post('/api/v2/logistics/ship_order', body, accessToken, shopId);
        return {
            success: !response.error,
            ...response
        };
    } catch (error) {
        console.error('Error shipping order:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            message: (error as any)?.response?.data?.message || '',
            request_id: (error as any)?.response?.data?.request_id || ''
        };
    }
}

/**
 * Handle buyer cancellation request (accept or reject)
 */
export async function handleBuyerCancellation(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    orderSn: string,
    operation: 'ACCEPT' | 'REJECT'
): Promise<any> {
    const body = {
        order_sn: orderSn,
        operation
    };

    console.info(`Handling buyer cancellation for order: ${orderSn}, operation: ${operation}`);
    return client.post('/api/v2/order/handle_buyer_cancellation', body, accessToken, shopId);
}

/**
 * Cancel order by seller
 */
export async function cancelOrder(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    orderSn: string,
    cancelReason: string,
    itemList?: Array<{ item_id: number; model_id: number }>
): Promise<any> {
    const body: any = {
        order_sn: orderSn,
        cancel_reason: cancelReason
    };

    if (itemList) {
        body.item_list = itemList;
    }

    console.info(`Cancelling order: ${orderSn}`);
    return client.post('/api/v2/order/cancel_order', body, accessToken, shopId);
}

/**
 * Get escrow detail for an order
 */
export async function getEscrowDetail(
    client: ShopeeClient,
    shopId: number,
    orderSn: string,
    accessToken: string
): Promise<any> {
    const params = new URLSearchParams({
        order_sn: orderSn
    });

    return client.get('/api/v2/payment/get_escrow_detail', params, accessToken, shopId);
}

/**
 * Get escrow details for multiple orders
 */
export async function getEscrowDetailBatch(
    client: ShopeeClient,
    shopId: number,
    orderSnList: string[],
    accessToken: string
): Promise<any> {
    const body = {
        order_sn_list: orderSnList
    };

    return client.post('/api/v2/payment/get_escrow_detail_batch', body, accessToken, shopId);
}
