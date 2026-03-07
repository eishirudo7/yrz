'use client'

// ============================================================
// SHARED TYPES untuk Webchat
// ============================================================

export interface Conversation {
    conversation_id: string;
    to_id: number;
    to_name: string;
    to_avatar: string;
    shop_id: number;
    shop_name: string;
    latest_message_content: {
        text?: string;
    } | null;
    latest_message_from_id: number;
    last_message_timestamp: number;
    unread_count: number;
}

export interface Message {
    message_id: string;
    conversation_id: string;
    from_id: number;
    to_id: number;
    from_shop_id: number;
    to_shop_id: number;
    content: {
        text?: string;
        image_url?: string;
        thumb_url?: string;
        thumb_height?: number;
        thumb_width?: number;
        order_sn?: string;
        shop_id?: number;
        [key: string]: any;
    };
    message_type: string;
    created_timestamp: number;
    status: string;
    sender_name?: string;
    receiver_name?: string;
}

export interface MessageInputProps {
    onSendMessage: (message: string) => void;
    isSendingMessage: boolean;
}

export interface ConversationItemProps {
    conversation: Conversation;
    isSelected: boolean;
    isMobileView: boolean;
    onSelect: (conversation: Conversation) => void;
}

export interface OrderItem {
    item_id: number;
    item_name: string;
    model_name: string;
    model_quantity_purchased: number;
    model_discounted_price: number;
    model_original_price: number;
    image_url: string;
    item_sku: string;
}

export interface Order {
    shop_name: string;
    order_sn: string;
    order_status: string;
    total_amount: number;
    shipping_carrier: string;
    payment_method: string;
    order_items: OrderItem[];
    tracking_number: string;
}

export interface MessageBubbleProps {
    message: import('@/types/shopeeMessage').UIMessage;
    orders: Order[];
    isMobileView: boolean;
}

export interface ItemDetail {
    item_id: number;
    item_sku: string;
    item_name: string;
    image: {
        image_ratio: string;
        image_id_list: string[];
        image_url_list: string[];
    };
}

export interface ChatContentProps {
    messages: import('@/types/shopeeMessage').UIMessage[];
    orders: Order[];
    isLoading: boolean;
    error: string | null;
    hasMoreMessages: boolean;
    isLoadingConversation: boolean;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    setActiveTab: (tab: 'chat' | 'orders') => void;
    selectedConversation: string | null;
    isMobileView: boolean;
}

export interface OrderItemProps {
    item: OrderItem;
}

export interface OrderDetailProps {
    order: Order;
}

export interface OrderListProps {
    orders: Order[];
    isLoading: boolean;
}
