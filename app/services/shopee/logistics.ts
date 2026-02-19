/**
 * Shopee Service - Logistics Operations
 */

import { shopeeApi } from '@/lib/shopeeConfig';
import { getValidAccessToken } from '@/app/services/tokenManager';
import { retryOperation } from './utils';

export async function getTrackingNumber(
    shopId: number,
    orderSn: string,
    packageNumber?: string
): Promise<any> {
    const accessToken = await getValidAccessToken(shopId);
    return shopeeApi.getTrackingNumber(shopId, orderSn, accessToken);
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

        if (!shopId || !orderList || orderList.length === 0) {
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

        if (response instanceof Buffer) {
            return response;
        }

        if (response.error) {
            return {
                error: response.error,
                message: response.message || "Gagal mengunduh dokumen dari Shopee API"
            };
        }

        return {
            error: "invalid_response",
            message: "Response tidak valid dari Shopee API"
        };
    });
}
