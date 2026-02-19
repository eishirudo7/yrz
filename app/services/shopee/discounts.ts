/**
 * Shopee Service - Discount Operations
 */

import { shopeeApi } from '@/lib/shopeeConfig';
import { getValidAccessToken } from '@/app/services/tokenManager';

export async function createDiscount(
    shopId: number,
    discountData: { discount_name: string, start_time: number, end_time: number }
): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        const result = await shopeeApi.addDiscount(shopId, accessToken, discountData);

        if (result.error) {
            return { success: false, error: result.error, message: result.message || 'Gagal membuat diskon' };
        }

        return { success: true, data: result.response, request_id: result.request_id };
    } catch (error) {
        console.error('Kesalahan saat membuat diskon:', error);
        return { success: false, error: "internal_server_error", message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui' };
    }
}

export async function addDiscountItems(
    shopId: number,
    discountId: number,
    items: Array<{ item_id: number, purchase_limit: 0, model_id?: number, promotion_price: number, stock: number }>
): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        const result = await shopeeApi.addDiscountItem(shopId, accessToken, discountId, items);

        if (result.error) {
            return { success: false, error: result.error, message: result.message || 'Gagal menambahkan item diskon' };
        }

        return { success: true, data: result.response, request_id: result.request_id };
    } catch (error) {
        console.error('Kesalahan saat menambahkan item diskon:', error);
        return { success: false, error: "internal_server_error", message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui' };
    }
}

export async function getDiscountDetails(shopId: number, discountId: number): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        const result = await shopeeApi.getDiscount(shopId, accessToken, discountId);

        if (result.error) {
            return { success: false, error: result.error, message: result.message || 'Gagal mendapatkan detail diskon' };
        }

        return { success: true, data: result.response, request_id: result.request_id };
    } catch (error) {
        console.error('Kesalahan saat mendapatkan detail diskon:', error);
        return { success: false, error: "internal_server_error", message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui' };
    }
}

export async function getDiscountList(
    shopId: number,
    options: { discount_status: 'upcoming' | 'ongoing' | 'expired' | 'all', page_size?: number, cursor?: string }
): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        const result = await shopeeApi.getDiscountList(shopId, accessToken, options);

        if (result.error) {
            return { success: false, error: result.error, message: result.message || 'Gagal mendapatkan daftar diskon' };
        }

        return { success: true, data: result.response, request_id: result.request_id };
    } catch (error) {
        console.error('Kesalahan saat mendapatkan daftar diskon:', error);
        return { success: false, error: "internal_server_error", message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui' };
    }
}

export async function updateDiscount(
    shopId: number,
    discountId: number,
    updateData: { discount_name?: string, start_time?: number, end_time?: number }
): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        const result = await shopeeApi.updateDiscount(shopId, accessToken, discountId, updateData);

        if (result.error) {
            return { success: false, error: result.error, message: result.message || 'Gagal mengupdate diskon' };
        }

        return { success: true, data: result.response, request_id: result.request_id };
    } catch (error) {
        console.error('Kesalahan saat mengupdate diskon:', error);
        return { success: false, error: "internal_server_error", message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui' };
    }
}

export async function updateDiscountItems(
    shopId: number,
    discountId: number,
    items: Array<{ item_id: number, purchase_limit?: number, model_list: Array<{ model_id: number, model_promotion_price: number }> }>
): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        const result = await shopeeApi.updateDiscountItem(shopId, accessToken, discountId, items);

        if (result.error) {
            return { success: false, error: result.error, message: result.message || 'Gagal mengupdate item diskon' };
        }

        return { success: true, data: result.response, request_id: result.request_id };
    } catch (error) {
        console.error('Kesalahan saat mengupdate item diskon:', error);
        return { success: false, error: "internal_server_error", message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui' };
    }
}

export async function deleteDiscount(shopId: number, discountId: number): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        const result = await shopeeApi.deleteDiscount(shopId, accessToken, discountId);

        if (result.error) {
            return { success: false, error: result.error, message: result.message || 'Gagal menghapus diskon' };
        }

        return { success: true, data: result.response, request_id: result.request_id };
    } catch (error) {
        console.error('Kesalahan saat menghapus diskon:', error);
        return { success: false, error: "internal_server_error", message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui' };
    }
}

export async function deleteDiscountItems(
    shopId: number,
    discountId: number,
    itemIds: Array<{ item_id: number, model_id?: number }>
): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        const result = await shopeeApi.deleteDiscountItem(shopId, accessToken, discountId, itemIds);

        if (result.error) {
            return { success: false, error: result.error, message: result.message || 'Gagal menghapus item diskon' };
        }

        return { success: true, data: result.response, request_id: result.request_id };
    } catch (error) {
        console.error('Kesalahan saat menghapus item diskon:', error);
        return { success: false, error: "internal_server_error", message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui' };
    }
}

export async function endDiscount(shopId: number, discountId: number): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        const result = await shopeeApi.endDiscount(shopId, accessToken, discountId);

        if (result.error) {
            return { success: false, error: result.error, message: result.message || 'Gagal mengakhiri diskon' };
        }

        return { success: true, data: result.response, request_id: result.request_id };
    } catch (error) {
        console.error('Kesalahan saat mengakhiri diskon:', error);
        return { success: false, error: "internal_server_error", message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui' };
    }
}
