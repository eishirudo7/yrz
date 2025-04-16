// chatState.ts
// Definisi struktur state untuk MiniChat

import { Conversation } from './MiniChatContext';

// Definisikan tipe untuk pesan SSE yang akan disimpan
export interface SSEMessage {
  type: string;
  message_id: string;
  conversation_id: string;
  from_id: number;
  to_id: number;
  shop_id: number;
  message_type: 'text' | 'image' | 'image_with_text' | 'order' | 'sticker';
  content: {
    text?: string;
    sticker_id?: string;
    sticker_package_id?: string;
    image_url?: string;
    url?: string;
    thumb_url?: string;
    thumb_height?: number;
    thumb_width?: number;
    order_sn?: string;
    shop_id?: number;
    [key: string]: any;
  };
  timestamp: number;
  source_content?: {
    order_sn?: string;
    item_id?: number;
    [key: string]: any;
  };
  created_timestamp?: number;
  sender_name?: string;
  receiver_name?: string;
}

export interface ActiveChat {
  conversationId: string;
  toId: number;
  toName: string;
  toAvatar: string;
  shopId: number;
  shopName: string;
  metadata?: any;
}

// Interface untuk status inisialisasi percakapan
export interface ChatInitialization {
  loading: boolean;
  error: string | null;
  pendingInit: {
    toId: number;
    shopId: number;
    toName: string;
    toAvatar: string;
    shopName: string;
    metadata?: any;
  } | null;
}

export interface ChatState {
  conversations: Conversation[];
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  totalUnread: number;
  
  // Chat UI state
  isOpen: boolean;
  isMinimized: boolean;
  activeChats: ActiveChat[];
  
  // Filter
  isMobile: boolean;
  searchQuery: string;
  selectedShops: number[];
  statusFilter: string;
  
  // SSE tracking
  lastMessage: SSEMessage | null;
  processedMessageIds: Set<string>;
  lastMessageTimestamp: number;
  
  // Status inisialisasi percakapan
  chatInitialization: ChatInitialization;
}

export const initialChatState: ChatState = {
  conversations: [],
  isLoading: false,
  error: null,
  isConnected: false,
  totalUnread: 0,
  
  // Chat UI state
  isOpen: false,
  isMinimized: false,
  activeChats: [],
  
  // Filter
  isMobile: false,
  searchQuery: '',
  selectedShops: [],
  statusFilter: 'all',
  
  // SSE tracking
  lastMessage: null,
  processedMessageIds: new Set<string>(),
  lastMessageTimestamp: 0,
  
  // Status inisialisasi percakapan
  chatInitialization: {
    loading: false,
    error: null,
    pendingInit: null
  }
}; 