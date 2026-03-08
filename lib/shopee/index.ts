/**
 * Shopee API - Legacy Module (trimmed)
 * 
 * Only chat and auth remain as legacy — all other modules migrated to @congminh1254/shopee-sdk.
 * This file is kept for backward compatibility with:
 * - chat.ts (SDK does not support chat)
 * - shop.ts generateDeauthUrl (SDK does not support deauth URL)
 */

// Re-export types
export * from './types';

// Re-export client utilities
export {
    ShopeeClient,
    generateSign,
    generateSignature,
    shopeeGet,
    shopeePost,
    SHOPEE_API_BASE_URL
} from './client';
export type { ShopeeClientConfig } from './client';

// Re-export remaining domain modules
export * as auth from './auth';
export * as chat from './chat';

// Import modules for the backward-compatible class
import { ShopeeClient } from './client';
import * as auth from './auth';
import * as chat from './chat';

/**
 * Backward-compatible ShopeeAPI class (trimmed)
 * Only exposes auth and chat methods — everything else uses the SDK now.
 * 
 * @deprecated Use SDK for new code. This class only exists for chat and deauth URL.
 */
export class ShopeeAPI {
    private client: ShopeeClient;

    constructor(partnerId: number, partnerKey: string) {
        this.client = new ShopeeClient(partnerId, partnerKey);
    }

    // ============= Auth =============
    generateAuthUrl(redirectUrl: string): string {
        return auth.generateAuthUrl(this.client, redirectUrl);
    }

    generateDeauthUrl(redirectUrl: string): string {
        return auth.generateDeauthUrl(this.client, redirectUrl);
    }

    async getTokens(code: string, shopId: number): Promise<any> {
        return auth.getTokens(this.client, code, shopId);
    }

    async refreshAccessToken(refreshToken: string, shopId: number): Promise<any> {
        return auth.refreshAccessToken(this.client, refreshToken, shopId);
    }

    async getShopInfo(shopId: number, accessToken: string): Promise<any> {
        return auth.getShopInfo(this.client, shopId, accessToken);
    }

    // ============= Chat =============
    async getConversationList(shopId: number, accessToken: string, options: any): Promise<any> {
        return chat.getConversationList(this.client, shopId, accessToken, options);
    }

    async getOneConversation(shopId: number, accessToken: string, conversationId: string): Promise<any> {
        return chat.getOneConversation(this.client, shopId, accessToken, conversationId);
    }

    async getMessages(shopId: number, accessToken: string, conversationId: string, options: any = {}): Promise<any> {
        return chat.getMessages(this.client, shopId, accessToken, conversationId, options);
    }

    async sendMessage(shopId: number, accessToken: string, toId: number, messageType: string, content: any): Promise<any> {
        return chat.sendMessage(this.client, shopId, accessToken, toId, messageType as any, content);
    }

    async readConversation(shopId: number, accessToken: string, conversationId: any, lastReadMessageId: string): Promise<any> {
        return chat.readConversation(this.client, shopId, accessToken, conversationId, lastReadMessageId);
    }

    async unreadConversation(shopId: number, accessToken: string, conversationId: string): Promise<any> {
        return chat.unreadConversation(this.client, shopId, accessToken, conversationId);
    }

    async getUnreadConversationCount(shopId: number, accessToken: string): Promise<any> {
        return chat.getUnreadConversationCount(this.client, shopId, accessToken);
    }

    async uploadImage(shopId: number, accessToken: string, file: File): Promise<any> {
        return chat.uploadImage(this.client, shopId, accessToken, file);
    }

    async uploadVideo(shopId: number, accessToken: string, file: File): Promise<any> {
        return chat.uploadVideo(this.client, shopId, accessToken, file);
    }

    async getVideoUploadResult(shopId: number, accessToken: string, vid: string): Promise<any> {
        return chat.getVideoUploadResult(this.client, shopId, accessToken, vid);
    }
}
