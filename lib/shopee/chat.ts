/**
 * Shopee API - Chat Module
 * Handles seller chat, conversations, and messaging
 */

import { ShopeeClient, SHOPEE_API_BASE_URL } from './client';
import { JSONStringify, JSONParse } from 'json-with-bigint';
import { ConversationListOptions, MessageOptions, MessageType, MessageContent } from './types';

/**
 * Get conversation list
 */
export async function getConversationList(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    options: ConversationListOptions
): Promise<any> {
    const params = new URLSearchParams({
        direction: options.direction,
        type: options.type,
        page_size: (options.page_size || 25).toString()
    });

    if (options.next_timestamp_nano) {
        params.append('next_timestamp_nano', options.next_timestamp_nano.toString());
    }

    return client.get('/api/v2/sellerchat/get_conversation_list', params, accessToken, shopId);
}

/**
 * Get one conversation details
 */
export async function getOneConversation(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    conversationId: string
): Promise<any> {
    const params = new URLSearchParams({
        conversation_id: conversationId
    });

    return client.get('/api/v2/sellerchat/get_one_conversation', params, accessToken, shopId);
}

/**
 * Get messages in a conversation
 */
export async function getMessages(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    conversationId: string,
    options: MessageOptions = {}
): Promise<any> {
    const params = new URLSearchParams({
        conversation_id: conversationId,
        page_size: (options.page_size || 25).toString()
    });

    if (options.offset) {
        params.append('offset', options.offset);
    }

    if (options.message_id_list?.length) {
        params.append('message_id_list', JSON.stringify(options.message_id_list));
    }

    return client.get('/api/v2/sellerchat/get_message', params, accessToken, shopId);
}

/**
 * Send a message
 */
export async function sendMessage(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    toId: number,
    messageType: MessageType,
    content: MessageContent | string
): Promise<any> {
    // Validate input
    if (!Number.isInteger(toId) || toId <= 0) {
        throw new Error('Invalid to_id. Must be a positive integer.');
    }

    if (!['text', 'sticker', 'image', 'item', 'order'].includes(messageType)) {
        throw new Error('Invalid message_type. Must be "text", "sticker", "image", "item", or "order".');
    }

    const body: any = {
        to_id: toId,
        message_type: messageType,
        content: {}
    };

    // Build content based on message type
    switch (messageType) {
        case 'text':
            if (typeof content !== 'string' || content.trim().length === 0) {
                throw new Error('Invalid content for text message. Must be a non-empty string.');
            }
            body.content.text = content;
            break;
        case 'sticker':
            const stickerContent = content as MessageContent;
            if (!stickerContent.sticker_id || !stickerContent.sticker_package_id) {
                throw new Error('Invalid content for sticker message. Must include sticker_id and sticker_package_id.');
            }
            body.content.sticker_id = stickerContent.sticker_id;
            body.content.sticker_package_id = stickerContent.sticker_package_id;
            break;
        case 'image':
            const imageContent = content as MessageContent;
            if (!imageContent.image_url) {
                throw new Error('Invalid content for image message. Must include image_url.');
            }
            body.content.image_url = imageContent.image_url;
            break;
        case 'item':
            const itemContent = content as MessageContent;
            if (!itemContent.item_id || !Number.isInteger(itemContent.item_id)) {
                throw new Error('Invalid content for item message. item_id must be a positive integer.');
            }
            body.content.item_id = itemContent.item_id;
            break;
        case 'order':
            const orderContent = content as MessageContent;
            if (!orderContent.order_sn || orderContent.order_sn.trim().length === 0) {
                throw new Error('Invalid content for order message. order_sn must be a non-empty string.');
            }
            body.content.order_sn = orderContent.order_sn;
            break;
    }

    // Use custom fetch with JSONStringify for BigInt support
    const path = '/api/v2/sellerchat/send_message';
    const { timestamp, sign } = client.generateSignature(path, accessToken, shopId);

    const params = new URLSearchParams({
        partner_id: client.partnerId.toString(),
        timestamp: timestamp.toString(),
        sign,
        shop_id: shopId.toString(),
        access_token: accessToken
    });

    const url = `${SHOPEE_API_BASE_URL}${path}?${params.toString()}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSONStringify(body)
        });

        const rawText = await response.text();
        return JSONParse(rawText);
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
}

/**
 * Mark conversation as read
 */
export async function readConversation(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    conversationId: bigint | string,
    lastReadMessageId: string
): Promise<any> {
    const body = JSONStringify({
        conversation_id: conversationId,
        last_read_message_id: lastReadMessageId
    });

    const path = '/api/v2/sellerchat/read_conversation';
    const { timestamp, sign } = client.generateSignature(path, accessToken, shopId);

    const params = new URLSearchParams({
        partner_id: client.partnerId.toString(),
        timestamp: timestamp.toString(),
        sign,
        shop_id: shopId.toString(),
        access_token: accessToken
    });

    const url = `${SHOPEE_API_BASE_URL}${path}?${params.toString()}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
        });

        const rawText = await response.text();
        return JSONParse(rawText);
    } catch (error) {
        console.error('Error reading conversation:', error);
        throw error;
    }
}

/**
 * Mark conversation as unread
 */
export async function unreadConversation(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    conversationId: string
): Promise<any> {
    const body = {
        conversation_id: conversationId
    };

    return client.post('/api/v2/sellerchat/unread_conversation', body, accessToken, shopId);
}

/**
 * Get unread conversation count
 */
export async function getUnreadConversationCount(
    client: ShopeeClient,
    shopId: number,
    accessToken: string
): Promise<any> {
    return client.get('/api/v2/sellerchat/get_unread_conversation_count', new URLSearchParams(), accessToken, shopId);
}

/**
 * Upload image for chat
 */
export async function uploadImage(
    client: ShopeeClient,
    shopId: number,
    accessToken: string,
    file: File
): Promise<any> {
    const path = '/api/v2/sellerchat/upload_image';
    const { timestamp, sign } = client.generateSignature(path, accessToken, shopId);

    const params = new URLSearchParams({
        partner_id: client.partnerId.toString(),
        timestamp: timestamp.toString(),
        sign,
        shop_id: shopId.toString(),
        access_token: accessToken
    });

    const formData = new FormData();
    formData.append('file', file);

    const url = `${SHOPEE_API_BASE_URL}${path}?${params.toString()}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });

        return response.json();
    } catch (error) {
        console.error('Error uploading image:', error);
        throw error;
    }
}
