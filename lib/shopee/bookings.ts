/**
 * Shopee API - Bookings Module
 * Handles reservation/booking orders (pre-orders)
 */

import axios from 'axios';
import { ShopeeClient, SHOPEE_API_BASE_URL } from './client';
import { BookingShippingDocument } from './types';

/**
 * Get booking list with filters
 */
export async function getBookingList(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    options: {
        time_range_field: 'create_time' | 'update_time';
        time_from: number;
        time_to: number;
        page_size?: number;
        cursor?: string;
        booking_status?: string;
        response_optional_fields?: string[];
    }
): Promise<any> {
    if (options.page_size && (options.page_size < 1 || options.page_size > 100)) {
        throw new Error('page_size must be between 1 and 100');
    }

    const params = new URLSearchParams({
        time_range_field: options.time_range_field,
        time_from: options.time_from.toString(),
        time_to: options.time_to.toString(),
        page_size: (options.page_size || 50).toString(),
        cursor: options.cursor || ''
    });

    if (options.booking_status && options.booking_status !== 'ALL') {
        params.append('booking_status', options.booking_status);
    }

    if (options.response_optional_fields?.length) {
        params.append('response_optional_fields', options.response_optional_fields.join(','));
    }

    console.info('Getting booking list');
    return client.get('/api/v2/order/get_booking_list', params, accessToken, shopId);
}

/**
 * Get booking details
 */
export async function getBookingDetail(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    bookingSnList: string[],
    responseOptionalFields?: string[]
): Promise<any> {
    if (bookingSnList.length === 0 || bookingSnList.some(sn => sn.trim().length === 0)) {
        throw new Error('booking_sn_list cannot be empty');
    }

    const params = new URLSearchParams({
        booking_sn_list: bookingSnList.map(sn => sn.trim()).join(',')
    });

    if (responseOptionalFields?.length) {
        params.append('response_optional_fields', responseOptionalFields.join(','));
    }

    console.info(`Getting booking detail for ${bookingSnList.length} bookings`);
    return client.get('/api/v2/order/get_booking_detail', params, accessToken, shopId);
}

/**
 * Get booking shipping parameter
 */
export async function getBookingShippingParameter(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    bookingSn: string
): Promise<any> {
    const params = new URLSearchParams({
        booking_sn: bookingSn
    });

    console.info(`Getting shipping parameter for booking: ${bookingSn}`);
    return client.get('/api/v2/logistics/get_booking_shipping_parameter', params, accessToken, shopId);
}

/**
 * Ship a booking (pickup or dropoff)
 */
export async function shipBooking(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    bookingSn: string,
    shippingMethod: 'pickup' | 'dropoff' = 'dropoff',
    shippingData?: any
): Promise<any> {
    const body: any = {
        booking_sn: bookingSn
    };

    if (shippingMethod === 'pickup') {
        body.pickup = shippingData || {};
    } else if (shippingMethod === 'dropoff') {
        body.dropoff = shippingData || {};
    }

    console.info(`Shipping booking: ${bookingSn} via ${shippingMethod}`);
    console.log(`[DEBUG] shipBooking Request Payload:`, JSON.stringify(body, null, 2));

    try {
        const response = await client.post('/api/v2/logistics/ship_booking', body, accessToken, shopId);
        return {
            success: !response.error,
            ...response
        };
    } catch (error) {
        console.error('Error shipping booking:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Get booking tracking number
 */
export async function getBookingTrackingNumber(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    bookingSn: string,
    packageNumber?: string
): Promise<any> {
    const params = new URLSearchParams({
        booking_sn: bookingSn
    });

    if (packageNumber) {
        params.append('package_number', packageNumber);
    }

    console.info(`Getting tracking number for booking: ${bookingSn}`);
    return client.get('/api/v2/logistics/get_booking_tracking_number', params, accessToken, shopId);
}

/**
 * Create booking shipping document
 */
export async function createBookingShippingDocument(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    bookingList: BookingShippingDocument[],
    documentType: string = 'THERMAL_AIR_WAYBILL'
): Promise<any> {
    const body = {
        booking_list: bookingList,
        shipping_document_type: documentType
    };

    console.info(`Creating shipping document for ${bookingList.length} bookings`);
    return client.post('/api/v2/logistics/create_booking_shipping_document', body, accessToken, shopId);
}

/**
 * Download booking shipping document as PDF
 */
export async function downloadBookingShippingDocument(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    bookingList: BookingShippingDocument[]
): Promise<Buffer | any> {
    const path = '/api/v2/logistics/download_booking_shipping_document';
    const { timestamp, sign } = client.generateSignature(path, accessToken, shopId);

    const params = new URLSearchParams({
        partner_id: client.partnerId.toString(),
        timestamp: timestamp.toString(),
        sign,
        shop_id: shopId.toString(),
        access_token: accessToken
    });

    const body = {
        booking_list: bookingList
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

        const errorResponse = JSON.parse(response.data.toString());
        console.error('Error response from Shopee API:', errorResponse);

        return {
            error: errorResponse.error || 'unknown_error',
            message: errorResponse.message || 'Error from Shopee API'
        };
    } catch (error) {
        console.error('Error downloading booking shipping document:', error);

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
