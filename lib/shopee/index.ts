/**
 * Shopee API - Main Entry Point
 * 
 * This module provides both:
 * 1. Modular exports for specific domains (auth, orders, chat, etc.)
 * 2. A backward-compatible ShopeeAPI class for gradual migration
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

// Re-export domain modules
export * as auth from './auth';
export * as orders from './orders';
export * as bookings from './bookings';
export * as chat from './chat';
export * as logistics from './logistics';
export * as products from './products';
export * as discounts from './discounts';

// Import all modules for the backward-compatible class
import { ShopeeClient } from './client';
import * as auth from './auth';
import * as orders from './orders';
import * as bookings from './bookings';
import * as chat from './chat';
import * as logistics from './logistics';
import * as products from './products';
import * as discounts from './discounts';

/**
 * Backward-compatible ShopeeAPI class
 * This class wraps all the modular functions to maintain the original API
 * 
 * @deprecated Use individual module imports for new code
 */
export class ShopeeAPI {
    private client: ShopeeClient;

    constructor(partnerId: number, partnerKey: string) {
        this.client = new ShopeeClient(partnerId, partnerKey);
    }

    // Internal method for signature generation (maintains original interface)
    private _generateSign(path: string, accessToken?: string, shopId?: number): [number, string] {
        const { timestamp, sign } = this.client.generateSignature(path, accessToken, shopId);
        return [timestamp, sign];
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

    // ============= Orders =============
    async getOrderDetail(shopId: number, orderSn: string, accessToken: string): Promise<any> {
        return orders.getOrderDetail(this.client, shopId, orderSn, accessToken);
    }

    async getOrderList(shopId: number, accessToken: string, options: any): Promise<any> {
        return orders.getOrderList(this.client, shopId, accessToken, options);
    }

    async getReadyToShipOrders(shopId: number, accessToken: string, pageSize: number = 20, cursor: string = ''): Promise<any> {
        return orders.getReadyToShipOrders(this.client, shopId, accessToken, pageSize, cursor);
    }

    async shipOrder(shopId: number, orderSn: string, accessToken: string, pickup?: any, dropoff?: any): Promise<any> {
        return orders.shipOrder(this.client, shopId, orderSn, accessToken, pickup, dropoff);
    }

    async handleBuyerCancellation(shopId: number, accessToken: string, orderSn: string, operation: 'ACCEPT' | 'REJECT'): Promise<any> {
        return orders.handleBuyerCancellation(this.client, shopId, accessToken, orderSn, operation);
    }

    async cancelOrder(shopId: number, accessToken: string, orderSn: string, itemList: any[]): Promise<any> {
        return orders.cancelOrder(this.client, shopId, accessToken, orderSn, 'OUT_OF_STOCK', itemList);
    }

    async getEscrowDetail(shopId: number, orderSn: string, accessToken: string): Promise<any> {
        return orders.getEscrowDetail(this.client, shopId, orderSn, accessToken);
    }

    async getEscrowDetailBatch(shopId: number, orderSnList: string[], accessToken: string): Promise<any> {
        return orders.getEscrowDetailBatch(this.client, shopId, orderSnList, accessToken);
    }

    // ============= Bookings =============
    async getBookingList(shopId: number, accessToken: string, options: any): Promise<any> {
        return bookings.getBookingList(this.client, shopId, accessToken, options);
    }

    async getBookingDetail(shopId: number, accessToken: string, bookingSnList: string[], responseOptionalFields?: string[]): Promise<any> {
        return bookings.getBookingDetail(this.client, shopId, accessToken, bookingSnList, responseOptionalFields);
    }

    async getBookingShippingParameter(shopId: number, accessToken: string, bookingSn: string): Promise<any> {
        return bookings.getBookingShippingParameter(this.client, shopId, accessToken, bookingSn);
    }

    async shipBooking(shopId: number, accessToken: string, bookingSn: string, shippingMethod: 'pickup' | 'dropoff' = 'dropoff', shippingData?: any): Promise<any> {
        return bookings.shipBooking(this.client, shopId, accessToken, bookingSn, shippingMethod, shippingData);
    }

    async getBookingTrackingNumber(shopId: number, accessToken: string, bookingSn: string, packageNumber?: string): Promise<any> {
        return bookings.getBookingTrackingNumber(this.client, shopId, accessToken, bookingSn, packageNumber);
    }

    async createBookingShippingDocument(shopId: number, accessToken: string, bookingList: any[], documentType: string = 'THERMAL_AIR_WAYBILL'): Promise<any> {
        return bookings.createBookingShippingDocument(this.client, shopId, accessToken, bookingList, documentType);
    }

    async downloadBookingShippingDocument(shopId: number, accessToken: string, bookingList: any[]): Promise<Buffer | any> {
        return bookings.downloadBookingShippingDocument(this.client, shopId, accessToken, bookingList);
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

    // ============= Logistics =============
    async getTrackingNumber(shopId: number, orderSn: string, accessToken: string, packageNumber?: string): Promise<any> {
        return logistics.getTrackingNumber(this.client, shopId, orderSn, accessToken, packageNumber);
    }

    async getShippingParameter(shopId: number, orderSn: string, accessToken: string): Promise<any> {
        return logistics.getShippingParameter(this.client, shopId, orderSn, accessToken);
    }

    async createShippingDocument(shopId: number, accessToken: string, orderList: any[], documentType: string = 'THERMAL_AIR_WAYBILL'): Promise<any> {
        return logistics.createShippingDocument(this.client, shopId, accessToken, orderList, documentType);
    }

    async downloadShippingDocument(shopId: number, accessToken: string, orderList: any[]): Promise<Buffer | any> {
        return logistics.downloadShippingDocument(this.client, shopId, accessToken, orderList);
    }

    // ============= Products =============
    async getItemList(shopId: number, accessToken: string, options: any = {}): Promise<any> {
        return products.getItemList(this.client, shopId, accessToken, options);
    }

    async getItemBaseInfo(shopId: number, accessToken: string, itemIdList: number[]): Promise<any> {
        return products.getItemBaseInfo(this.client, shopId, accessToken, itemIdList);
    }

    async getModelList(shopId: number, accessToken: string, itemId: number): Promise<any> {
        return products.getModelList(this.client, shopId, accessToken, itemId);
    }

    async getItemLimit(shopId: number, accessToken: string): Promise<any> {
        return products.getItemLimit(this.client, shopId, accessToken);
    }

    async updateStock(shopId: number, accessToken: string, itemId: number, stockInfo: any): Promise<any> {
        return products.updateStock(this.client, shopId, accessToken, itemId, stockInfo);
    }

    async updateItem(shopId: number, accessToken: string, itemId: number, updateData: any): Promise<any> {
        return products.updateItem(this.client, shopId, accessToken, itemId, updateData);
    }

    async unlistItem(shopId: number, accessToken: string, items: any[]): Promise<any> {
        return products.unlistItem(this.client, shopId, accessToken, items);
    }

    async addItem(shopId: number, accessToken: string, itemData: any): Promise<any> {
        return products.addItem(this.client, shopId, accessToken, itemData);
    }

    async deleteItem(shopId: number, accessToken: string, itemId: number): Promise<any> {
        return products.deleteItem(this.client, shopId, accessToken, itemId);
    }

    async getItemPromotion(shopId: number, accessToken: string, itemIdList: number[]): Promise<any> {
        return products.getItemPromotion(this.client, shopId, accessToken, itemIdList);
    }

    // ============= Discounts =============
    async addDiscount(shopId: number, accessToken: string, discountData: any): Promise<any> {
        return discounts.addDiscount(this.client, shopId, accessToken, discountData);
    }

    async addDiscountItem(shopId: number, accessToken: string, discountId: number, items: any[]): Promise<any> {
        return discounts.addDiscountItem(this.client, shopId, accessToken, discountId, items);
    }

    async getDiscount(shopId: number, accessToken: string, discountId: number): Promise<any> {
        return discounts.getDiscount(this.client, shopId, accessToken, discountId);
    }

    async getDiscountList(shopId: number, accessToken: string, options: any): Promise<any> {
        return discounts.getDiscountList(this.client, shopId, accessToken, options);
    }

    async updateDiscount(shopId: number, accessToken: string, discountId: number, updateData: any): Promise<any> {
        return discounts.updateDiscount(this.client, shopId, accessToken, discountId, updateData);
    }

    async updateDiscountItem(shopId: number, accessToken: string, discountId: number, items: any[]): Promise<any> {
        return discounts.updateDiscountItem(this.client, shopId, accessToken, discountId, items);
    }

    async deleteDiscount(shopId: number, accessToken: string, discountId: number): Promise<any> {
        return discounts.deleteDiscount(this.client, shopId, accessToken, discountId);
    }

    async deleteDiscountItem(shopId: number, accessToken: string, discountId: number, itemIds: any[]): Promise<any> {
        return discounts.deleteDiscountItem(this.client, shopId, accessToken, discountId, itemIds);
    }

    async endDiscount(shopId: number, accessToken: string, discountId: number): Promise<any> {
        return discounts.endDiscount(this.client, shopId, accessToken, discountId);
    }

    // ============= Flash Sales =============
    async getFlashSaleTimeSlotId(shopId: number, accessToken: string, options: any): Promise<any> {
        return discounts.getFlashSaleTimeSlotId(this.client, shopId, accessToken, options);
    }

    async createShopFlashSale(shopId: number, accessToken: string, timeslotId: number): Promise<any> {
        return discounts.createShopFlashSale(this.client, shopId, accessToken, timeslotId);
    }

    async getFlashSaleItemCriteria(shopId: number, accessToken: string, itemIdList: number[]): Promise<any> {
        return discounts.getFlashSaleItemCriteria(this.client, shopId, accessToken, itemIdList);
    }

    async addShopFlashSaleItems(shopId: number, accessToken: string, data: { flash_sale_id: number; items: any[] }): Promise<any> {
        return discounts.addShopFlashSaleItems(this.client, shopId, accessToken, data.flash_sale_id, data.items);
    }

    async getShopFlashSaleList(shopId: number, accessToken: string, options: any): Promise<any> {
        return discounts.getShopFlashSaleList(this.client, shopId, accessToken, options);
    }

    async getShopFlashSale(shopId: number, accessToken: string, flashSaleId: number): Promise<any> {
        return discounts.getShopFlashSaleDetail(this.client, shopId, accessToken, flashSaleId);
    }

    async getShopFlashSaleDetail(shopId: number, accessToken: string, flashSaleId: number): Promise<any> {
        return discounts.getShopFlashSaleDetail(this.client, shopId, accessToken, flashSaleId);
    }

    async updateShopFlashSale(shopId: number, accessToken: string, data: { flash_sale_id: number; status: 1 | 2 }): Promise<any> {
        const action = data.status === 1 ? 'enable' : 'disable';
        return discounts.updateShopFlashSaleStatus(this.client, shopId, accessToken, data.flash_sale_id, action);
    }

    async updateShopFlashSaleItems(shopId: number, accessToken: string, data: any): Promise<any> {
        // Pass through to client directly for complex update
        return this.client.post('/api/v2/shop_flash_sale/update_shop_flash_sale_items', data, accessToken, shopId);
    }

    async getShopFlashSaleItems(shopId: number, accessToken: string, options: { flash_sale_id: number; offset?: number; limit?: number }): Promise<any> {
        const params = new URLSearchParams({
            flash_sale_id: options.flash_sale_id.toString(),
            offset: (options.offset || 0).toString(),
            limit: (options.limit || 20).toString()
        });
        return this.client.get('/api/v2/shop_flash_sale/get_shop_flash_sale_items', params, accessToken, shopId);
    }

    async deleteShopFlashSale(shopId: number, accessToken: string, flashSaleId: number): Promise<any> {
        return discounts.deleteShopFlashSale(this.client, shopId, accessToken, flashSaleId);
    }

    async deleteShopFlashSaleItems(shopId: number, accessToken: string, data: { flash_sale_id: number; item_ids: number[] }): Promise<any> {
        return discounts.deleteShopFlashSaleItems(this.client, shopId, accessToken, data.flash_sale_id, data.item_ids);
    }

    // ============= Shop Performance (inline) =============
    async getShopPerformance(shopId: number, accessToken: string): Promise<any> {
        return this.client.get('/api/v2/account_health/get_shop_performance', new URLSearchParams(), accessToken, shopId);
    }

    async getShopPenalty(shopId: number, accessToken: string): Promise<any> {
        return this.client.get('/api/v2/account_health/shop_penalty', new URLSearchParams(), accessToken, shopId);
    }

    // ============= Returns (inline) =============
    async getReturnList(shopId: number, accessToken: string, options: any): Promise<any> {
        const params = new URLSearchParams({
            page_no: options.page_no.toString(),
            page_size: options.page_size.toString()
        });

        if (options.create_time_from) params.append('create_time_from', options.create_time_from.toString());
        if (options.create_time_to) params.append('create_time_to', options.create_time_to.toString());
        if (options.status) params.append('status', options.status);

        return this.client.get('/api/v2/returns/get_return_list', params, accessToken, shopId);
    }

    // ============= Product Comments (inline) =============
    async getProductComment(shopId: number, accessToken: string, options: any): Promise<any> {
        const params = new URLSearchParams({
            cursor: options.cursor || '',
            page_size: (options.page_size || 10).toString()
        });

        if (options.item_id) params.append('item_id', options.item_id.toString());
        if (options.comment_id) params.append('comment_id', options.comment_id.toString());

        return this.client.get('/api/v2/product/get_comment', params, accessToken, shopId);
    }

    async replyProductComment(shopId: number, accessToken: string, commentList: any[]): Promise<any> {
        return this.client.post('/api/v2/product/reply_comment', { comment_list: commentList }, accessToken, shopId);
    }

    // ============= Ads (inline) =============
    async getAdsDailyPerformance(shopId: number, accessToken: string, startDate: string, endDate: string): Promise<any> {
        const params = new URLSearchParams({
            start_date: startDate,
            end_date: endDate
        });

        return this.client.get('/api/v2/ads/get_all_cpc_ads_daily_performance', params, accessToken, shopId);
    }

    // ============= Push Config (inline) =============
    async setAppPushConfig(options: any): Promise<any> {
        const path = '/api/v2/push/set_app_push_config';
        const { timestamp, sign } = this.client.generateSignature(path);

        const params = new URLSearchParams({
            partner_id: this.client.partnerId.toString(),
            timestamp: timestamp.toString(),
            sign
        });

        const url = `https://partner.shopeemobile.com${path}?${params.toString()}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(options)
        });

        return response.json();
    }

    async getAppPushConfig(): Promise<any> {
        const path = '/api/v2/push/get_app_push_config';
        const { timestamp, sign } = this.client.generateSignature(path);

        const params = new URLSearchParams({
            partner_id: this.client.partnerId.toString(),
            timestamp: timestamp.toString(),
            sign
        });

        const url = `https://partner.shopeemobile.com${path}?${params.toString()}`;
        const response = await fetch(url, {
            headers: { 'Content-Type': 'application/json' }
        });

        return response.json();
    }
}
