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
  message_type: string;
  content: any;
  timestamp: number;
  source_content?: any;
}

export interface ChatState {
  isOpen: boolean;
  isMinimized: boolean;
  activeChats: {
    conversationId: string;
    shopId: number;
    toId: number;
    toName: string;
    toAvatar: string;
    shopName: string;
    metadata?: any;
  }[];
  conversations: Conversation[];
  isLoading: boolean;
  error: string | null;
  isMobile: boolean;
  searchQuery: string;
  selectedShops: number[];
  statusFilter: 'SEMUA' | 'BELUM DIBACA' | 'BELUM DIBALAS';
  isConnected: boolean;
  totalUnread: number;
  // Set untuk melacak pesan yang telah diproses
  processedMessageIds: Set<string>;
  // Timestamp terakhir kali pesan diterima, berguna untuk debouncing
  lastMessageTimestamp: number;
  // Pesan SSE terakhir yang diterima
  lastMessage: SSEMessage | null;
}

export const initialChatState: ChatState = {
  isOpen: false,
  isMinimized: false,
  activeChats: [],
  conversations: [],
  isLoading: false,
  error: null,
  isMobile: false,
  searchQuery: '',
  selectedShops: [],
  statusFilter: 'SEMUA',
  isConnected: false,
  totalUnread: 0,
  processedMessageIds: new Set<string>(),
  lastMessageTimestamp: 0,
  lastMessage: null
}; 