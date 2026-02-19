/**
 * Shopee Service - Order Operations
 */

import { shopeeApi } from '@/lib/shopeeConfig';
import { getValidAccessToken } from '@/app/services/tokenManager';
import { OrderListOptions } from './utils';

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

export async function getOrderList(shopId: number, options: OrderListOptions = {}) {
    try {
        const accessToken = await getValidAccessToken(shopId);
        const response = await shopeeApi.getOrderList(shopId, accessToken, {
            time_range_field: options.timeRangeField || 'create_time',
            time_from: options.startTime || Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60),
            time_to: options.endTime || Math.floor(Date.now() / 1000),
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

export async function handleBuyerCancellation(
    shopId: number,
    orderSn: string,
    operation: 'ACCEPT' | 'REJECT'
): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        const response = await shopeeApi.handleBuyerCancellation(shopId, accessToken, orderSn, operation);

        if (response.error) {
            console.error(`Error saat menangani pembatalan: ${JSON.stringify(response)}`);
            return {
                success: false,
                error: response.error,
                message: response.message || 'Gagal menangani pembatalan',
                request_id: response.request_id
            };
        }

        return {
            success: true,
            data: response.response,
            request_id: response.request_id
        };
    } catch (error) {
        console.error('Gagal menangani pembatalan:', error);
        return {
            success: false,
            error: "internal_error",
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
        const response = await shopeeApi.cancelOrder(shopId, accessToken, orderSn, itemList);

        if (response.error) {
            console.error(`Error saat membatalkan pesanan: ${JSON.stringify(response)}`);
            return {
                success: false,
                error: response.error,
                message: response.message || 'Gagal membatalkan pesanan',
                request_id: response.request_id
            };
        }

        return {
            success: true,
            data: response.response,
            request_id: response.request_id
        };
    } catch (error) {
        console.error('Gagal membatalkan pesanan:', error);
        return {
            success: false,
            error: "internal_error",
            message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
        };
    }
}

export async function getEscrowDetail(shopId: number, orderSn: string): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        const response = await shopeeApi.getEscrowDetail(shopId, orderSn, accessToken);

        if (response.error) {
            console.error(`Error saat mengambil escrow detail: ${JSON.stringify(response)}`);
            return {
                success: false,
                error: response.error,
                message: response.message || 'Gagal mengambil escrow detail',
                request_id: response.request_id
            };
        }

        return {
            success: true,
            data: response.response,
            request_id: response.request_id
        };
    } catch (error) {
        console.error('Gagal mengambil escrow detail:', error);
        return {
            success: false,
            error: "fetch_failed",
            message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
        };
    }
}

export async function getEscrowDetailBatch(shopId: number, orderSnList: string[]): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        const response = await shopeeApi.getEscrowDetailBatch(shopId, orderSnList, accessToken);

        if (response.error) {
            console.error(`Error saat mengambil batch escrow detail: ${JSON.stringify(response)}`);
            return {
                success: false,
                error: response.error,
                message: response.message || 'Gagal mengambil batch escrow detail',
                request_id: response.request_id
            };
        }

        return {
            success: true,
            data: response.response,
            request_id: response.request_id
        };
    } catch (error) {
        console.error('Gagal mengambil batch escrow detail:', error);
        return {
            success: false,
            error: "fetch_failed",
            message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
        };
    }
}
