// chatState.ts
// Definisi struktur state untuk MiniChat

import { Conversation } from './MiniChatContext';

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
  lastMessageTimestamp: 0
}; 