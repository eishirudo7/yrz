/**
 * Shopee API - Logistics Module
 * Handles shipping documents, tracking, and shipping parameters
 */

import axios from 'axios';
import { ShopeeClient, SHOPEE_API_BASE_URL } from './client';
import { ShippingDocumentOrder } from './types';

/**
 * Get tracking number for an order
 */
export async function getTrackingNumber(
    client: ShopeeClient,
    shopId: number,
    orderSn: string,
    accessToken: string,
    packageNumber?: string
): Promise<any> {
    const params = new URLSearchParams({
        order_sn: orderSn,
    });

    if (packageNumber) {
        params.append('package_number', packageNumber);
    }

    console.info(`Getting tracking number for order: ${orderSn}`);
    return client.get('/api/v2/logistics/get_tracking_number', params, accessToken, shopId);
}

/**
 * Get shipping parameter for an order
 */
export async function getShippingParameter(
    client: ShopeeClient,
    shopId: number,
    orderSn: string,
    accessToken: string
): Promise<any> {
    const params = new URLSearchParams({
        order_sn: orderSn
    });

    return client.get('/api/v2/logistics/get_shipping_parameter', params, accessToken, shopId);
}

/**
 * Create shipping document
 */
export async function createShippingDocument(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    orderList: ShippingDocumentOrder[],
    documentType: string = 'THERMAL_AIR_WAYBILL'
): Promise<any> {
    const body = {
        order_list: orderList,
        shipping_document_type: documentType
    };

    console.info(`Creating shipping document for ${orderList.length} orders`);
    return client.post('/api/v2/logistics/create_shipping_document', body, accessToken, shopId);
}

/**
 * Download shipping document as PDF
 */
export async function downloadShippingDocument(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    orderList: ShippingDocumentOrder[]
): Promise<Buffer | any> {
    const path = '/api/v2/logistics/download_shipping_document';
    const { timestamp, sign } = client.generateSignature(path, accessToken, shopId);

    const params = new URLSearchParams({
        partner_id: client.partnerId.toString(),
        timestamp: timestamp.toString(),
        sign,
        shop_id: shopId.toString(),
        access_token: accessToken
    });

    const body = {
        order_list: orderList
    };

    const url = `${SHOPEE_API_BASE_URL}${path}?${params.toString()}`;

    try {
        const response = await axios.post(url, body, {
            headers: { 'Content-Type': 'application/json' },
            responseType: 'arraybuffer'
        });

        if (response.headers['content-type']?.includes('application/pdf')) {
            return Buffer.from(response.data);
        }

        // If not PDF, parse as JSON error
        const errorResponse = JSON.parse(response.data.toString());
        console.error('Error response from Shopee API:', errorResponse);

        return {
            error: errorResponse.error || 'unknown_error',
            message: errorResponse.message || 'Error from Shopee API'
        };
    } catch (error) {
        console.error('Error downloading shipping document:', error);

        if (axios.isAxiosError(error) && error.response?.data) {
            try {
                const errorData = JSON.parse(error.response.data.toString());
                return {
                    error: errorData.error || 'api_error',
                    message: errorData.message || 'Error from Shopee API'
                };
            } catch {
                return {
                    error: 'parse_error',
                    message: `Error processing response: ${error.message}`
                };
            }
        }

        return {
            error: 'request_error',
            message: `Request error: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}
