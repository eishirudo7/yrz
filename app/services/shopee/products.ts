/**
 * Shopee Service - Product Operations
 */

import { shopeeApi } from '@/lib/shopeeConfig';
import { getValidAccessToken } from '@/app/services/tokenManager';

export async function getItemList(
    shopId: number,
    options: {
        offset?: number,
        page_size?: number,
        item_status?: ('NORMAL' | 'BANNED' | 'DELETED' | 'UNLIST')[],
        update_time_from?: number,
        update_time_to?: number,
        item_id_list?: number[],
        need_complaint_policy?: boolean,
        need_tax_info?: boolean
    } = {}
): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        const result = await shopeeApi.getItemList(shopId, accessToken, options);

        if (result.error) {
            return { success: false, error: result.error, message: result.message || 'Gagal mengambil daftar produk' };
        }

        return { success: true, data: result.response, request_id: result.request_id };
    } catch (error) {
        console.error('Kesalahan saat mengambil daftar produk:', error);
        return { success: false, error: "internal_server_error", message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui' };
    }
}

export async function getItemBaseInfo(shopId: number, itemIdList: number[]): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        const result = await shopeeApi.getItemBaseInfo(shopId, accessToken, itemIdList);

        if (result.error) {
            return { success: false, error: result.error, message: result.message || 'Gagal mengambil informasi dasar produk' };
        }

        return { success: true, data: result.response, request_id: result.request_id };
    } catch (error) {
        console.error('Kesalahan saat mengambil informasi dasar produk:', error);
        return { success: false, error: "internal_server_error", message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui' };
    }
}

export async function getModelList(shopId: number, itemId: number): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        const result = await shopeeApi.getModelList(shopId, accessToken, itemId);

        if (result.error) {
            return { success: false, error: result.error, message: result.message || 'Gagal mengambil daftar model' };
        }

        return { success: true, data: result.response, request_id: result.request_id };
    } catch (error) {
        console.error('Kesalahan saat mengambil daftar model:', error);
        return { success: false, error: "internal_server_error", message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui' };
    }
}

export async function getItemLimit(shopId: number): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        const result = await shopeeApi.getItemLimit(shopId, accessToken);

        if (result.data?.error) {
            return { error: result.data.error, message: result.data.message || 'Gagal mengambil limit produk', request_id: result.data.request_id };
        }

        return { error: '', message: '', request_id: result.data.request_id, response: result.data.response };
    } catch (error) {
        console.error('Kesalahan saat mengambil limit produk:', error);
        return { error: "internal_server_error", message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui', request_id: '', response: null };
    }
}

export async function addItem(shopId: number, itemData: any): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        const result = await shopeeApi.addItem(shopId, accessToken, itemData);

        if (result.error) {
            return { success: false, error: result.error, message: result.message || 'Gagal menambah produk' };
        }

        return { success: true, data: result.response, request_id: result.request_id };
    } catch (error) {
        console.error('Kesalahan saat menambah produk:', error);
        return { success: false, error: "internal_server_error", message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui' };
    }
}

export async function updateItem(shopId: number, itemId: number, updateData: any): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        const result = await shopeeApi.updateItem(shopId, accessToken, itemId, updateData);

        if (result.error) {
            return { success: false, error: result.error, message: result.message || 'Gagal mengupdate produk' };
        }

        return { success: true, data: result.response, request_id: result.request_id };
    } catch (error) {
        console.error('Kesalahan saat mengupdate produk:', error);
        return { success: false, error: "internal_server_error", message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui' };
    }
}

export async function deleteItem(shopId: number, itemId: number): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        const result = await shopeeApi.deleteItem(shopId, accessToken, itemId);

        if (result.error) {
            return { success: false, error: result.error, message: result.message || 'Gagal menghapus produk' };
        }

        return { success: true, data: result.response, request_id: result.request_id };
    } catch (error) {
        console.error('Kesalahan saat menghapus produk:', error);
        return { success: false, error: "internal_server_error", message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui' };
    }
}

export async function unlistItems(
    shopId: number,
    items: Array<{ item_id: number, unlist: boolean }>
): Promise<any> {
    try {
        if (!shopId) throw new Error('ID Toko diperlukan');
        if (!items || items.length === 0) throw new Error('Daftar item diperlukan');
        if (items.length > 50) throw new Error('Maksimal 50 item dapat diproses dalam satu waktu');

        const accessToken = await getValidAccessToken(shopId);
        const result = await shopeeApi.unlistItem(shopId, accessToken, items);

        if (result.error) {
            return { success: false, error: result.error, message: result.message || 'Gagal unlist item', request_id: result.request_id };
        }

        return { success: true, data: result.response, request_id: result.request_id, warning: result.warning };
    } catch (error) {
        console.error('Kesalahan saat memproses unlist item:', error);
        return { success: false, error: 'UNLIST_ITEMS_FAILED', message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui' };
    }
}

export async function updateStock(
    shopId: number,
    itemId: number,
    stockInfo: { stock_list: Array<{ model_id?: number, seller_stock: Array<{ location_id?: string, stock: number }> }> }
): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);

        if (!stockInfo.stock_list || stockInfo.stock_list.length === 0) {
            throw new Error('stock_list tidak boleh kosong');
        }

        const batchSize = 50;
        const batches = [];
        for (let i = 0; i < stockInfo.stock_list.length; i += batchSize) {
            batches.push(stockInfo.stock_list.slice(i, i + batchSize));
        }

        let successList: any[] = [];
        let failureList: any[] = [];

        for (const batch of batches) {
            const batchResult = await shopeeApi.updateStock(shopId, accessToken, itemId, { stock_list: batch });

            if (batchResult.error) {
                failureList = [...failureList, ...(batchResult.response?.failure_list || [])];
            } else {
                successList = [...successList, ...(batchResult.response?.success_list || [])];
                if (batchResult.response?.failure_list?.length > 0) {
                    failureList = [...failureList, ...batchResult.response.failure_list];
                }
            }
        }

        return {
            success: true,
            data: { success_list: successList, failure_list: failureList },
            warning: failureList.length > 0 ? 'Beberapa model gagal diupdate' : undefined
        };
    } catch (error) {
        console.error('Kesalahan saat mengupdate stok:', error);
        return { success: false, error: "internal_server_error", message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui' };
    }
}

export async function getItemPromotion(shopId: number, itemIdList: number[]): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        const result = await shopeeApi.getItemPromotion(shopId, accessToken, itemIdList);

        if (result.error) {
            return { success: false, error: result.error, message: result.message || 'Gagal mengambil informasi promosi produk' };
        }

        return { success: true, data: result.response, request_id: result.request_id };
    } catch (error) {
        console.error('Kesalahan saat mengambil informasi promosi produk:', error);
        return { success: false, error: "internal_server_error", message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui' };
    }
}

export async function getProductComment(
    shopId: number,
    options: { item_id?: number, comment_id?: number, cursor?: string, page_size?: number }
): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        const result = await shopeeApi.getProductComment(shopId, accessToken, options);

        if (result.error) {
            return { success: false, error: result.error, message: result.message || 'Gagal mengambil komentar produk' };
        }

        return { success: true, data: result.response, request_id: result.request_id };
    } catch (error) {
        console.error('Kesalahan saat mengambil komentar produk:', error);
        return { success: false, error: "internal_server_error", message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui' };
    }
}

export async function replyProductComment(
    shopId: number,
    commentList: Array<{ comment_id: number, comment: string }>
): Promise<any> {
    try {
        if (!commentList || commentList.length === 0) {
            return { success: false, error: "invalid_input", message: 'Daftar komentar tidak boleh kosong' };
        }
        if (commentList.length > 100) {
            return { success: false, error: "invalid_input", message: 'Jumlah komentar tidak boleh lebih dari 100' };
        }

        const accessToken = await getValidAccessToken(shopId);
        const result = await shopeeApi.replyProductComment(shopId, accessToken, commentList);

        if (result.error) {
            return { success: false, error: result.error, message: result.message || 'Gagal membalas komentar produk' };
        }

        return { success: true, data: result.response, request_id: result.request_id };
    } catch (error) {
        console.error('Kesalahan saat membalas komentar produk:', error);
        return { success: false, error: "internal_server_error", message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui' };
    }
}

export async function getReturnList(
    shopId: number,
    options: { page_no?: number, page_size?: number, create_time_from?: number, create_time_to?: number, status?: string } = {}
): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        const finalOptions = { page_no: 0, page_size: 50, ...options };

        const result = await shopeeApi.getReturnList(shopId, accessToken, finalOptions);

        if (result.error) {
            return { success: false, error: result.error, message: result.message || 'Gagal mengambil daftar retur', request_id: result.request_id };
        }

        return { success: true, data: result.response, more: result.more, request_id: result.request_id };
    } catch (error) {
        console.error('Kesalahan saat mengambil daftar retur:', error);
        return { success: false, error: 'FETCH_RETURNS_FAILED', message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui' };
    }
}
