/**
 * Shopee Service - Chat Operations
 */

import { shopeeApi } from '@/lib/shopeeConfig';
import { getValidAccessToken } from '@/app/services/tokenManager';
import { retryOperation } from './utils';

export async function getConversationList(
    shopId: number,
    options: { direction?: 'latest' | 'older', type?: 'all' | 'pinned' | 'unread', next_timestamp_nano?: number, page_size?: number } = {}
): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        if (!accessToken) {
            throw new Error(`Tidak dapat menemukan toko dengan ID: ${shopId}`);
        }

        const result = await retryOperation(async () => {
            return await shopeeApi.getConversationList(shopId, accessToken, {
                direction: options.direction || 'older',
                type: options.type || 'all',
                next_timestamp_nano: options.next_timestamp_nano,
                page_size: options.page_size || 50
            });
        });

        return result;
    } catch (error) {
        console.error(`Error saat mengambil daftar percakapan untuk toko ${shopId}:`, error);
        throw error;
    }
}

export async function getOneConversation(shopId: number, conversationId: string): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        if (!accessToken) {
            throw new Error(`Tidak dapat menemukan toko dengan ID: ${shopId}`);
        }

        const result = await retryOperation(async () => {
            return await shopeeApi.getOneConversation(shopId, accessToken, conversationId);
        });

        return result;
    } catch (error) {
        console.error(`Error saat mengambil data percakapan ${conversationId} untuk toko ${shopId}:`, error);
        throw error;
    }
}

export async function getMessages(
    shopId: number,
    conversationId: string,
    options: { offset?: string, page_size?: number, message_id_list?: number[] } = {}
): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        if (!accessToken) {
            throw new Error(`Tidak dapat menemukan toko dengan ID: ${shopId}`);
        }

        const result = await retryOperation(async () => {
            return await shopeeApi.getMessages(shopId, accessToken, conversationId, {
                offset: options.offset,
                page_size: options.page_size || 25,
                message_id_list: options.message_id_list
            });
        });

        return result;
    } catch (error) {
        console.error(`Error saat mengambil pesan untuk percakapan ${conversationId} di toko ${shopId}:`, error);
        throw error;
    }
}

export async function sendMessage(shopId: number, toId: number, messageType: string, content: any): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        if (!accessToken) {
            throw new Error(`Tidak dapat menemukan toko dengan ID: ${shopId}`);
        }

        const result = await retryOperation(async () => {
            return await shopeeApi.sendMessage(shopId, accessToken, toId, messageType, content);
        });

        return result;
    } catch (error) {
        console.error(`Error saat mengirim pesan ke pengguna ${toId} dari toko ${shopId}:`, error);
        throw error;
    }
}

export async function readConversation(shopId: number, conversationId: string, lastReadMessageId: string): Promise<any> {
    try {
        const accessToken = await getValidAccessToken(shopId);
        const result = await shopeeApi.readConversation(shopId, accessToken, conversationId, lastReadMessageId);

        if (result.error) {
            return { success: false, error: result.error, message: result.message || 'Gagal menandai percakapan sebagai dibaca' };
        }

        return { success: true, data: result.response, request_id: result.request_id };
    } catch (error) {
        console.error('Kesalahan saat menandai percakapan sebagai dibaca:', error);
        return { success: false, error: "internal_server_error", message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui' };
    }
}
