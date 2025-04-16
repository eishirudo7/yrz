// chatActions.ts
// Definisi tipe untuk semua possible actions

import { Conversation } from './MiniChatContext';

export const chatActions = {
  // Pesan baru diterima melalui SSE
  messageReceived: (message: any) => ({ 
    type: 'MESSAGE_RECEIVED', 
    payload: message,
    meta: { timestamp: Date.now() }
  }),
  
  // Percakapan baru ditambahkan ke daftar
  conversationAdded: (conversation: Conversation) => ({ 
    type: 'CONVERSATION_ADDED', 
    payload: conversation 
  }),
  
  // Percakapan yang ada diperbarui
  conversationUpdated: (conversationId: string, updates: Partial<Conversation>) => ({ 
    type: 'CONVERSATION_UPDATED', 
    payload: { id: conversationId, updates } 
  }),
  
  // Pesan dalam percakapan ditandai sebagai dibaca
  markAsRead: (conversationId: string) => ({ 
    type: 'MARK_AS_READ', 
    payload: { conversationId } 
  }),
  
  // Status koneksi SSE berubah
  connectionStatusChanged: (isConnected: boolean) => ({ 
    type: 'CONNECTION_STATUS_CHANGED', 
    payload: isConnected 
  }),
  
  // Request untuk mengambil percakapan dimulai
  fetchConversationsStarted: () => ({ 
    type: 'FETCH_CONVERSATIONS_STARTED' 
  }),
  
  // Pengambilan percakapan berhasil
  fetchConversationsSucceeded: (conversations: Conversation[]) => ({ 
    type: 'FETCH_CONVERSATIONS_SUCCEEDED', 
    payload: conversations 
  }),
  
  // Pengambilan percakapan gagal
  fetchConversationsFailed: (error: string) => ({ 
    type: 'FETCH_CONVERSATIONS_FAILED', 
    payload: error 
  }),

  // Set mobile state
  setMobile: (isMobile: boolean) => ({
    type: 'SET_MOBILE',
    payload: isMobile
  }),

  // Set filter dan search parameters
  setSearchQuery: (query: string) => ({
    type: 'SET_SEARCH_QUERY',
    payload: query
  }),

  setShopFilter: (shops: number[]) => ({
    type: 'SET_SHOP_FILTER',
    payload: shops
  }),

  setStatusFilter: (status: 'SEMUA' | 'BELUM DIBACA' | 'BELUM DIBALAS') => ({
    type: 'SET_STATUS_FILTER',
    payload: status
  }),

  // Chat UI actions
  openChat: (chatInfo: any) => ({
    type: 'OPEN_CHAT',
    payload: chatInfo
  }),

  closeChat: (conversationId: string) => ({
    type: 'CLOSE_CHAT',
    payload: { conversationId }
  }),

  minimizeChat: (minimize: boolean) => ({
    type: 'MINIMIZE_CHAT', 
    payload: { minimize }
  })
};

// Definisi tipe untuk semua action yang mungkin
export type MessageReceivedAction = ReturnType<typeof chatActions.messageReceived>;
export type ConversationAddedAction = ReturnType<typeof chatActions.conversationAdded>;
export type ConversationUpdatedAction = ReturnType<typeof chatActions.conversationUpdated>;
export type MarkAsReadAction = ReturnType<typeof chatActions.markAsRead>;
export type ConnectionStatusChangedAction = ReturnType<typeof chatActions.connectionStatusChanged>;
export type FetchConversationsStartedAction = ReturnType<typeof chatActions.fetchConversationsStarted>;
export type FetchConversationsSucceededAction = ReturnType<typeof chatActions.fetchConversationsSucceeded>;
export type FetchConversationsFailedAction = ReturnType<typeof chatActions.fetchConversationsFailed>;
export type SetMobileAction = ReturnType<typeof chatActions.setMobile>;
export type SetSearchQueryAction = ReturnType<typeof chatActions.setSearchQuery>;
export type SetShopFilterAction = ReturnType<typeof chatActions.setShopFilter>;
export type SetStatusFilterAction = ReturnType<typeof chatActions.setStatusFilter>;
export type OpenChatAction = ReturnType<typeof chatActions.openChat>;
export type CloseChatAction = ReturnType<typeof chatActions.closeChat>;
export type MinimizeChatAction = ReturnType<typeof chatActions.minimizeChat>;

// Union semua tipe action
export type ChatAction = 
  | MessageReceivedAction
  | ConversationAddedAction
  | ConversationUpdatedAction
  | MarkAsReadAction
  | ConnectionStatusChangedAction
  | FetchConversationsStartedAction
  | FetchConversationsSucceededAction
  | FetchConversationsFailedAction
  | SetMobileAction
  | SetSearchQueryAction
  | SetShopFilterAction
  | SetStatusFilterAction
  | OpenChatAction
  | CloseChatAction
  | MinimizeChatAction; 