/**
 * Shopee Service - Discount Operations
 * Migrated to use @congminh1254/shopee-sdk
 */

import { getShopeeSDK } from '@/lib/shopee-sdk';
import { getValidAccessToken } from '@/app/services/tokenManager';

export async function createDiscount(
    shopId: number,
    discountData: { discount_name: string, start_time: number, end_time: number }
): Promise<any> {
    try {
        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);
        const result: any = await sdk.discount.addDiscount(discountData as any);

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
        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);
        const result: any = await sdk.discount.addDiscountItem({
            discount_id: discountId,
            item_list: items,
        } as any);

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
        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);
        const result: any = await sdk.discount.getDiscount({
            discount_id: discountId,
            page_no: 1,
            page_size: 50,
        });

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
        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);
        const result: any = await sdk.discount.getDiscountList({
            discount_status: options.discount_status,
            page_size: options.page_size,
            cursor: options.cursor,
        } as any);

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
        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);
        const result: any = await sdk.discount.updateDiscount({
            discount_id: discountId,
            ...updateData,
        } as any);

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
        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);
        const result: any = await sdk.discount.updateDiscountItem({
            discount_id: discountId,
            item_list: items,
        } as any);

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
        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);
        const result: any = await sdk.discount.deleteDiscount({
            discount_id: discountId,
        });

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
        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);
        const result: any = await sdk.discount.deleteDiscountItem({
            discount_id: discountId,
            item_list: itemIds,
        } as any);

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
        await getValidAccessToken(shopId);
        const sdk = getShopeeSDK(shopId);
        const result: any = await sdk.discount.endDiscount({
            discount_id: discountId,
        });

        if (result.error) {
            return { success: false, error: result.error, message: result.message || 'Gagal mengakhiri diskon' };
        }

        return { success: true, data: result.response, request_id: result.request_id };
    } catch (error) {
        console.error('Kesalahan saat mengakhiri diskon:', error);
        return { success: false, error: "internal_server_error", message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui' };
    }
}
