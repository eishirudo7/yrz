// chatActions.ts
// Definisi tipe untuk semua possible actions

import { Conversation } from './MiniChatContext';
import { SSEMessage } from './chatState';
import { Dispatch } from 'react';
import { toast } from 'sonner';

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
  }),
  
  // Update lastMessage di state
  updateLastMessage: (message: SSEMessage) => ({
    type: 'UPDATE_LAST_MESSAGE',
    payload: message
  }),

  // Action creator baru untuk inisialisasi percakapan
  initConversationStarted: (params: {
    toId: number;
    shopId: number;
    toName: string;
    toAvatar: string;
    shopName: string;
    metadata?: any;
  }): { type: 'INIT_CONVERSATION_STARTED'; payload: { toId: number; shopId: number; toName: string; toAvatar: string; shopName: string; metadata?: any; } } => ({
    type: 'INIT_CONVERSATION_STARTED',
    payload: params
  }),
  
  initConversationSucceeded: (params: {
    conversationId: string;
    toId: number;
    shopId: number;
    toName: string;
    toAvatar: string;
    shopName: string;
    metadata?: any;
  }): { type: 'INIT_CONVERSATION_SUCCEEDED'; payload: { conversationId: string; toId: number; shopId: number; toName: string; toAvatar: string; shopName: string; metadata?: any; } } => ({
    type: 'INIT_CONVERSATION_SUCCEEDED',
    payload: params
  }),
  
  initConversationFailed: (error: string): { type: 'INIT_CONVERSATION_FAILED'; payload: string; } => ({
    type: 'INIT_CONVERSATION_FAILED',
    payload: error
  }),
  
  // Thunk action creator untuk menangani inisialisasi percakapan
  openChatWithInit: (params: {
    toId: number;
    shopId: number;
    toName: string;
    toAvatar: string;
    shopName: string;
    conversationId?: string;
    metadata?: any;
  }) => async (dispatch: Dispatch<ChatAction>) => {
    // Jika conversationId sudah ada, langsung buka chat
    if (params.conversationId) {
      dispatch(chatActions.openChat(params));
      return;
    }
    
    // Jika tidak ada conversationId, perlu menginisialisasi percakapan baru
    dispatch(chatActions.initConversationStarted({
      toId: params.toId,
      shopId: params.shopId,
      toName: params.toName,
      toAvatar: params.toAvatar,
      shopName: params.shopName,
      metadata: params.metadata
    }));
    
    try {
      console.log('[MiniChat] Menginisialisasi percakapan dengan:', {
        userId: params.toId,
        shopId: params.shopId,
        ...(params.metadata?.orderId ? { orderSn: params.metadata.orderId } : {})
      });
      
      const response = await fetch('/api/msg/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: params.toId,
          shopId: params.shopId,
          ...(params.metadata?.orderId ? { orderSn: params.metadata.orderId } : {})
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal menginisialisasi percakapan');
      }
      
      const data = await response.json();
      
      if (data.success && data.conversation?.conversation_id) {
        console.log('[MiniChat] Berhasil inisialisasi percakapan:', data.conversation.conversation_id);
        
        // Dispatch action dengan conversationId yang valid
        const conversationParams = {
          ...params,
          conversationId: data.conversation.conversation_id
        };
        
        dispatch(chatActions.initConversationSucceeded(conversationParams));
        dispatch(chatActions.openChat(conversationParams));
      } else {
        throw new Error('Format respons inisialisasi tidak valid');
      }
    } catch (error: any) {
      console.error('[MiniChat] Gagal inisialisasi percakapan:', error);
      dispatch(chatActions.initConversationFailed(error.message || 'Gagal memulai percakapan baru'));
      toast.error('Gagal memulai percakapan');
    }
  }
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
export type UpdateLastMessageAction = ReturnType<typeof chatActions.updateLastMessage>;
export type InitConversationStartedAction = ReturnType<typeof chatActions.initConversationStarted>;
export type InitConversationSucceededAction = ReturnType<typeof chatActions.initConversationSucceeded>;
export type InitConversationFailedAction = ReturnType<typeof chatActions.initConversationFailed>;

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
  | MinimizeChatAction
  | UpdateLastMessageAction
  | InitConversationStartedAction
  | InitConversationSucceededAction
  | InitConversationFailedAction; 