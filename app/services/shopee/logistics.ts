/**
 * Shopee Service - Logistics Operations
 * Migrated to use @congminh1254/shopee-sdk
 */

import { getShopeeSDK } from '@/lib/shopee-sdk';
import { getValidAccessToken } from '@/app/services/tokenManager';
import { retryOperation } from './utils';

export async function getTrackingNumber(
    shopId: number,
    orderSn: string,
    packageNumber?: string
): Promise<any> {
    await getValidAccessToken(shopId);
    const sdk = getShopeeSDK(shopId);
    return sdk.logistics.getTrackingNumber({
        order_sn: orderSn,
        ...(packageNumber ? { package_number: packageNumber } : {}),
    });
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
        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);
        const result: any = await sdk.logistics.createShippingDocument({
            order_list: orderList.map(o => ({
                order_sn: o.order_sn,
                ...(o.package_number ? { package_number: o.package_number } : {}),
                ...(o.tracking_number ? { tracking_number: o.tracking_number } : {}),
            })),
            document_type: documentType,
        } as any);

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
        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);

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

        const response: any = await sdk.logistics.downloadShippingDocument({
            order_list: formattedOrderList,
        } as any);

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
