import { create } from 'zustand';
import { useSSE } from '@/app/services/SSEService';
import { useUserData } from '@/contexts/UserDataContext';
import { ChatInfo, ChatMetadata, SSEMessageData, Conversation } from '@/contexts/MiniChatContext';

// Tipe untuk state
interface ChatState {
  conversations: Conversation[];
  isLoading: boolean;
  error: string | null;
  totalUnread: number;
  isChatOpen: boolean;
  currentChat: ChatInfo | null;
  messages: any[];
  isSending: boolean;
  isRefreshing: boolean;
  searchQuery: string;
  selectedShops: number[];
  statusFilter: 'SEMUA' | 'BELUM DIBACA' | 'BELUM DIBALAS';
  isMinimized: boolean;
  isMobile: boolean;
  processedMessages: Set<string>;
  lastMessage: SSEMessageData | null;
  isConnected: boolean;
  filteredConversations: Conversation[];
  uniqueShops: number[];
  chatInitialization: {
    loading: boolean;
    error: string | null;
    pendingInit: ChatInfo | null;
  };
}

// Tipe untuk actions
interface ChatActions {
  // State management
  setState: (state: Partial<ChatState>) => void;
  resetState: () => void;
  
  // Chat operations
  openChat: (chatInfo: ChatInfo) => void;
  closeChat: () => void;
  minimizeChat: (minimize: boolean) => void;
  sendMessage: (message: string, onSuccess?: (messageId: string) => void) => Promise<void>;
  refreshConversations: () => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
  markMessageAsRead: (conversationId: string, messageId: string) => Promise<void>;
  handleSSEMessage: (data: SSEMessageData) => void;
  setSearchQuery: (query: string) => void;
  setShopFilter: (shops: number[]) => void;
  setStatusFilter: (status: 'SEMUA' | 'BELUM DIBACA' | 'BELUM DIBALAS') => void;
  updateConversationList: (update: { type: 'mark_as_read' | 'refresh', conversation_id?: string }) => void;
  initializeConversation: (userId: number, orderSn: string, shopId: number) => Promise<Conversation | null>;
  setMobile: (isMobile: boolean) => void;
  fetchOneConversation: (conversationId: string, shopId: number) => Promise<Conversation | null>;
  getFilteredConversations: () => Conversation[];
  getUniqueShops: () => number[];
  setConversations: (conversations: Conversation[]) => void;
}

// Initial state
const initialState: ChatState = {
  conversations: [],
  isLoading: false,
  error: null,
  totalUnread: 0,
  isChatOpen: false,
  currentChat: null,
  messages: [],
  isSending: false,
  isRefreshing: false,
  searchQuery: '',
  selectedShops: [],
  statusFilter: 'SEMUA',
  isMinimized: false,
  isMobile: false,
  processedMessages: new Set(),
  lastMessage: null,
  isConnected: false,
  filteredConversations: [],
  uniqueShops: [],
  chatInitialization: {
    loading: false,
    error: null,
    pendingInit: null
  }
};

// Create store
const useMiniChatStore = create<ChatState & ChatActions>((set, get) => ({
  ...initialState,
  filteredConversations: [],
  uniqueShops: [],

  // Update computed properties setiap kali state berubah
  setConversations: (conversations) => {
    set((state) => ({
      ...state,
      conversations,
      filteredConversations: get().getFilteredConversations(),
      uniqueShops: get().getUniqueShops()
    }));
  },

  setSearchQuery: (query) => {
    set((state) => ({
      ...state,
      searchQuery: query,
      filteredConversations: get().getFilteredConversations()
    }));
  },

  setShopFilter: (shops) => {
    set((state) => ({
      ...state,
      selectedShops: shops,
      filteredConversations: get().getFilteredConversations()
    }));
  },

  setStatusFilter: (status) => {
    set((state) => ({
      ...state,
      statusFilter: status,
      filteredConversations: get().getFilteredConversations()
    }));
  },

  // State management
  setState: (newState) => {
    set((state) => {
      const updatedState = { ...state, ...newState };
      return {
        ...updatedState,
        filteredConversations: get().getFilteredConversations(),
        uniqueShops: get().getUniqueShops()
      };
    });
  },
  resetState: () => set(initialState),

  // Chat operations
  openChat: (chatInfo) => {
    const { conversations } = get();
    let newConversations = [...conversations];
    
    const existingIndex = newConversations.findIndex(
      (c) => c.conversation_id === chatInfo.conversationId
    );
    
    if (existingIndex !== -1) {
      newConversations.splice(existingIndex, 1);
    }
    
    const newConversation: Conversation = {
      conversation_id: chatInfo.conversationId || '',
      to_id: chatInfo.toId,
      to_name: chatInfo.toName,
      to_avatar: chatInfo.toAvatar,
      shop_id: chatInfo.shopId,
      shop_name: chatInfo.shopName,
      latest_message_content: null,
      latest_message_from_id: chatInfo.shopId,
      last_message_timestamp: Date.now(),
      unread_count: 0
    };
    
    newConversations.push(newConversation);
    
    if (newConversations.length > 6) {
      newConversations = newConversations.slice(1);
    }
    
    set({ conversations: newConversations, isChatOpen: true, currentChat: chatInfo });
  },

  closeChat: () => {
    set({ isChatOpen: false, currentChat: null });
  },

  minimizeChat: (minimize) => {
    set({ isMinimized: minimize });
  },

  sendMessage: async (message, onSuccess) => {
    const { currentChat } = get();
    if (!currentChat) {
      console.error('[MiniChat] Cannot send message: No current chat selected');
      throw new Error('No current chat selected');
    }

    set({ isSending: true });
    try {
      const response = await fetch('/api/msg/send_message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          toId: currentChat.toId,
          content: message,
          shopId: currentChat.shopId,
        })
      });

      if (!response.ok) {
        throw new Error('Gagal mengirim pesan');
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        const responseData = data.data;
        get().updateConversationList({ type: 'refresh' });
        
        if (onSuccess && responseData.message_id) {
          onSuccess(responseData.message_id);
        }
      }
    } catch (error) {
      console.error('[MiniChat] Error sending message:', error);
      throw error;
    } finally {
      set({ isSending: false });
    }
  },

  refreshConversations: async () => {
    set({ isRefreshing: true });
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/msg/get_conversation_list?_=${timestamp}`);
      
      if (!response.ok) {
        throw new Error('Gagal mengambil daftar percakapan');
      }
      
      const data = await response.json();
      set({ conversations: data });
    } finally {
      set({ isRefreshing: false });
    }
  },

  markAsRead: async (conversationId) => {
    const { conversations } = get();
    const conversation = conversations.find(conv => conv.conversation_id === conversationId);
    if (!conversation) return;

    try {
      const response = await fetch('/api/msg/mark_as_read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          shopId: conversation.shop_id,
          conversationId: conversationId,
          lastReadMessageId: conversation.latest_message_id
        })
      });

      if (response.ok) {
        const updatedConversations = conversations.map(conv =>
          conv.conversation_id === conversationId
            ? { ...conv, unread_count: 0 }
            : conv
        );
        set({ conversations: updatedConversations });
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  },

  markMessageAsRead: async (conversationId, messageId) => {
    const { conversations } = get();
    const conversation = conversations.find(conv => conv.conversation_id === conversationId);
    if (!conversation) return;

    try {
      const response = await fetch('/api/msg/mark_as_read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          shopId: conversation.shop_id,
          conversationId: conversationId,
          lastReadMessageId: messageId
        })
      });

      if (response.ok) {
        get().markAsRead(conversationId);
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  },

  handleSSEMessage: (data) => {
    const { processedMessages, conversations } = get();
    
    // Validasi data
    if (!data || !data.message_id || !data.conversation_id || !data.shop_id) {
      console.error('[MiniChat] Invalid SSE message data:', data);
      return;
    }
    
    if (processedMessages.has(data.message_id)) {
      console.log(`[MiniChat] Message ${data.message_id} already processed, skipping`);
      return;
    }

    processedMessages.add(data.message_id);
    
    const conversationExists = conversations.some(
      conv => conv.conversation_id === data.conversation_id
    );

    if (!conversationExists) {
      console.log(`[MiniChat] Conversation ${data.conversation_id} not found, fetching...`);
      get().fetchOneConversation(data.conversation_id, data.shop_id);
    } else {
      console.log(`[MiniChat] Refreshing conversations after new message`);
      get().refreshConversations();
    }

    set({ lastMessage: data });
  },

  updateConversationList: (update) => {
    if (update.type === 'mark_as_read' && update.conversation_id) {
      get().markAsRead(update.conversation_id);
    } else if (update.type === 'refresh') {
      get().refreshConversations();
    }
  },

  initializeConversation: async (userId, orderSn, shopId) => {
    try {
      set({ chatInitialization: { ...get().chatInitialization, loading: true, error: null } });
      
      const response = await fetch('/api/msg/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          orderSn,
          shopId
        })
      });

      if (!response.ok) {
        throw new Error('Gagal menginisialisasi percakapan');
      }

      const data = await response.json();

      if (data.success && data.conversation?.conversation_id) {
        await get().refreshConversations();
        const { conversations } = get();
        const newConversation = conversations.find(
          conv => conv.conversation_id === data.conversation.conversation_id
        ) || null;
        
        set({ 
          chatInitialization: { 
            loading: false, 
            error: null, 
            pendingInit: null 
          } 
        });
        
        return newConversation;
      }

      set({ 
        chatInitialization: { 
          loading: false, 
          error: 'Gagal menginisialisasi percakapan', 
          pendingInit: null 
        } 
      });
      
      return null;
    } catch (error) {
      console.error('Error initializing conversation:', error);
      set({ 
        chatInitialization: { 
          loading: false, 
          error: error instanceof Error ? error.message : 'Error initializing conversation', 
          pendingInit: null 
        } 
      });
      return null;
    }
  },

  setMobile: (isMobile) => set({ isMobile }),

  fetchOneConversation: async (conversationId, shopId) => {
    try {
      const response = await fetch(
        `/api/msg/get_one_conversation?conversationId=${conversationId}&shopId=${shopId}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.response) {
          const conv = data.response;
          const newConversation: Conversation = {
            conversation_id: conv.conversation_id,
            to_id: conv.to_id,
            to_name: conv.to_name,
            to_avatar: conv.to_avatar,
            shop_id: shopId,
            shop_name: conv.shop_name,
            latest_message_content: conv.latest_message_content,
            latest_message_from_id: conv.latest_message_from_id,
            latest_message_id: conv.latest_message_id,
            last_message_timestamp: conv.last_message_timestamp,
            unread_count: conv.unread_count || 1,
            pinned: conv.pinned,
            last_read_message_id: conv.last_read_message_id,
            latest_message_type: conv.latest_message_type
          };

          const { conversations } = get();
          set({
            conversations: [
              ...conversations.filter(c => c.conversation_id !== conversationId),
              newConversation
            ]
          });

          return newConversation;
        }
      }
      
      get().refreshConversations();
      return null;
    } catch (error) {
      console.error('Error fetching conversation:', error);
      get().refreshConversations();
      return null;
    }
  },

  // Tambahkan computed properties
  getFilteredConversations: () => {
    const { conversations, searchQuery, selectedShops, statusFilter } = get();
    
    if (!conversations || conversations.length === 0) {
      return [];
    }

    return conversations.filter(conversation => {
      if (!conversation || !conversation.to_name || !conversation.shop_name) {
        return false;
      }

      const matchesSearch = conversation.to_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           conversation.shop_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesShopFilter = selectedShops.length === 0 || selectedShops.includes(conversation.shop_id);
      const matchesStatusFilter = 
        statusFilter === 'SEMUA' ? true :
        statusFilter === 'BELUM DIBACA' ? conversation.unread_count > 0 :
        statusFilter === 'BELUM DIBALAS' ? (conversation.latest_message_content?.text && conversation.to_id == conversation.latest_message_from_id) : true;

      return matchesSearch && matchesShopFilter && matchesStatusFilter;
    });
  },

  getUniqueShops: () => {
    const { conversations } = get();
    if (!conversations || conversations.length === 0) {
      return [];
    }
    const shops = new Set(conversations.map(conv => conv.shop_id));
    return Array.from(shops);
  }
}));

export default useMiniChatStore; 