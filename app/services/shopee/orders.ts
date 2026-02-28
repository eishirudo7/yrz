/**
 * Shopee Service - Order Operations
 * Migrated to use @congminh1254/shopee-sdk
 */

import { getShopeeSDK } from '@/lib/shopee-sdk';
import { getValidAccessToken } from '@/app/services/tokenManager';
import { OrderListOptions } from './utils';

export async function getOrderDetail(shopId: number, orderSn: string): Promise<any> {
    try {
        await getValidAccessToken(shopId); // ensures token is valid + auto-refresh
        const sdk = getShopeeSDK(shopId);
        const result: any = await sdk.order.getOrdersDetail({
            order_sn_list: [orderSn],
            response_optional_fields: 'buyer_user_id,buyer_username,estimated_shipping_fee,recipient_address,actual_shipping_fee,note,note_update_time,item_list,pay_time,dropshipper,dropshipper_phone,split_up,buyer_cancel_reason,cancel_by,cancel_reason,actual_shipping_fee_confirmed,fulfillment_flag,pickup_done_time,package_list,shipping_carrier,payment_method,total_amount,invoice_data',
        });

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
        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);
        const response: any = await sdk.order.getOrderList({
            time_range_field: options.timeRangeField || 'create_time',
            time_from: options.startTime || Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60),
            time_to: options.endTime || Math.floor(Date.now() / 1000),
            page_size: options.pageSize || 50,
            cursor: options.cursor || '',
            order_status: (options.orderStatus || 'ALL') as any
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
    const sdk = getShopeeSDK(shopId);
    return sdk.order.getShipmentList({
        page_size: pageSize,
        cursor: cursor || undefined,
    });
}

export async function processReadyToShipOrders(shopId: number, orderSn: string, shippingMethod: string = 'dropoff'): Promise<any> {
    try {
        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);

        const shippingParams: any = await sdk.logistics.getShippingParameter({
            order_sn: orderSn,
        });

        if (shippingParams.error) {
            console.error(`Error saat mendapatkan parameter pengiriman: ${JSON.stringify(shippingParams)}`);
            return shippingParams;
        }

        let shipResult: any;
        if (shippingMethod === 'pickup') {
            if (shippingParams.response?.pickup) {
                shipResult = await sdk.logistics.shipOrder({
                    order_sn: orderSn,
                    pickup: shippingParams.response.pickup,
                });
            } else {
                return {
                    success: false,
                    error: "pickup_not_available",
                    message: `Metode pickup tidak tersedia untuk pesanan ${orderSn}`,
                    request_id: shippingParams.request_id || ''
                };
            }
        } else if (shippingMethod === 'dropoff') {
            if (shippingParams.response?.dropoff) {
                shipResult = await sdk.logistics.shipOrder({
                    order_sn: orderSn,
                    dropoff: shippingParams.response.dropoff,
                });
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

        if (shipResult.success !== false) {
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
        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);
        const response: any = await sdk.order.handleBuyerCancellation({
            order_sn: orderSn,
            operation: operation,
        });

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
        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);
        const response: any = await sdk.order.cancelOrder({
            order_sn: orderSn,
            cancel_reason: 'CUSTOMER_REQUEST',
            item_list: itemList,
        });

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
        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);
        const response: any = await sdk.payment.getEscrowDetail({
            order_sn: orderSn,
        });

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
        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);
        const response: any = await sdk.payment.getEscrowDetailBatch({
            order_sn_list: orderSnList,
        });

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
