/**
 * Shared types for Shopee API
 */

// Base API Response
export interface ShopeeApiResponse<T = any> {
    error?: string;
    message?: string;
    warning?: string;
    request_id?: string;
    response?: T;
}

// Order Types
export interface OrderListOptions {
    time_range_field: 'create_time' | 'update_time';
    time_from: number;
    time_to: number;
    page_size?: number;
    cursor?: string;
    order_status?: 'UNPAID' | 'READY_TO_SHIP' | 'PROCESSED' | 'SHIPPED' | 'COMPLETED' | 'IN_CANCEL' | 'CANCELLED' | 'ALL';
    response_optional_fields?: string[];
}

// Booking Types
export interface BookingListOptions {
    time_range_field?: 'create_time' | 'update_time';
    start_time?: number;
    end_time?: number;
    booking_status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'ALL';
    page_size?: number;
    cursor?: string;
}

// Shipping Document Types
export interface ShippingDocumentOrder {
    order_sn: string;
    package_number?: string;
    tracking_number?: string;
    shipping_document_type?: string;
}

export interface BookingShippingDocument {
    booking_sn: string;
    package_number?: string;
    tracking_number?: string;
    shipping_document_type?: string;
}

// Discount Types
export interface DiscountData {
    discount_name: string;
    start_time: number;
    end_time: number;
}

export interface DiscountItem {
    item_id: number;
    purchase_limit: number;
    model_id?: number;
    promotion_price: number;
    stock: number;
}

export interface DiscountItemUpdate {
    item_id: number;
    purchase_limit?: number;
    model_list: Array<{
        model_id: number;
        model_promotion_price: number;
    }>;
}

export interface DiscountListOptions {
    discount_status: 'upcoming' | 'ongoing' | 'expired' | 'all';
    page_size?: number;
    cursor?: string;
}

// Product Types
export interface ItemListOptions {
    offset?: number;
    page_size?: number;
    item_status?: ('NORMAL' | 'BANNED' | 'DELETED' | 'UNLIST')[];
    update_time_from?: number;
    update_time_to?: number;
    item_id_list?: number[];
    need_complaint_policy?: boolean;
    need_tax_info?: boolean;
}

export interface StockInfo {
    stock_list: Array<{
        model_id?: number;
        seller_stock: {
            location_id?: string;
            stock: number;
        }[];
    }>;
}

// Chat Types
export interface ConversationListOptions {
    direction: 'latest' | 'older';
    type: 'all' | 'pinned' | 'unread';
    next_timestamp_nano?: number;
    page_size?: number;
}

export interface MessageOptions {
    offset?: string;
    page_size?: number;
    message_id_list?: number[];
}

export type MessageType = 'text' | 'sticker' | 'image' | 'item' | 'order';

export interface MessageContent {
    text?: string;
    sticker_id?: string;
    sticker_package_id?: string;
    image_url?: string;
    item_id?: number;
    order_sn?: string;
}

// Flash Sale Types
export interface FlashSaleTimeSlotOptions {
    start_time: number;
    end_time: number;
}

export interface FlashSaleItem {
    item_id: number;
    flash_sale_stock?: number;
    model_list?: Array<{
        model_id: number;
        flash_sale_stock: number;
        original_price?: number;
        promotion_price?: number;
    }>;
}

// Return Types
export interface ReturnListOptions {
    page_no?: number;
    page_size?: number;
    create_time_from?: number;
    create_time_to?: number;
    status?: 'REQUESTED' | 'ACCEPTED' | 'CANCELLED' | 'JUDGING' | 'CLOSED' | 'PROCESSING' | 'SELLER_DISPUTE' | 'REFUND_PAID';
    returnable?: boolean;
}

// Shop Types
export interface ShopPerformance {
    shop_id: number;
    shop_name?: string;
    performance?: any;
}
