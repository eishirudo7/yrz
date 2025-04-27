'use client'
import { create } from 'zustand';
import { useEffect } from 'react';
import { useUserData } from '@/contexts/UserDataContext';
import { useSSE } from '@/app/services/SSEService';

// Logger utility
const logPrefix = '[StoreChat]';
const logger = {
  info: (msg: string, data?: any) => console.log(`${logPrefix} ${msg}`, data || ''),
  error: (msg: string, error?: any) => {
    console.error(`${logPrefix} ${msg}`);
    if (error) console.error(error);
  }
};

// Tipe untuk konten pesan
export interface MessageContent {
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
  item_id?: number;
}

// Tipe untuk source content
export interface SourceContent {
  order_sn?: string;
  [key: string]: any;
}

// Tipe lengkap yang mewakili respons API Shopee
export interface ShopeeMessage {
  message_id: string;
  from_id: number;
  to_id: number;
  from_shop_id: number;
  to_shop_id: number;
  message_type: 'text' | 'image' | 'image_with_text' | 'order' | 'sticker' | 'item';
  content: MessageContent;
  conversation_id: string;
  created_timestamp: number;
  region: string;
  status: string;
  message_option: number;
  source: string;
  source_content: SourceContent;
  quoted_msg: any;
}

// Tipe yang lebih sederhana untuk UI, dapat diturunkan dari ShopeeMessage
export interface UIMessage {
  id: string;
  sender: 'buyer' | 'seller';
  content: string;
  time: string;
  type: 'text' | 'image' | 'image_with_text' | 'order' | 'sticker' | 'item';
  imageUrl?: string;
  imageThumb?: {
    url: string;
    height: number;
    width: number;
  };
  orderData?: {
    shopId: number;
    orderSn: string;
  };
  stickerData?: {
    stickerId: string;
    packageId: string;
  };
  itemData?: {
    shopId: number;
    itemId: number;
  };
  sourceContent?: SourceContent;
}

// Fungsi untuk mengkonversi dari ShopeeMessage ke UIMessage
export function convertToUIMessage(
  message: ShopeeMessage, 
  shopId: number
): UIMessage {
  return {
    id: message.message_id,
    sender: message.from_shop_id === shopId ? 'seller' : 'buyer',
    type: message.message_type,
    content: ['text', 'image_with_text'].includes(message.message_type)
      ? message.content.text || ''
      : message.message_type === 'order'
        ? 'Menampilkan detail pesanan'
        : message.message_type === 'sticker'
          ? 'Stiker'
          : message.message_type === 'item'
            ? 'Menampilkan detail produk'
            : '',
    imageUrl: message.message_type === 'image'
      ? message.content.url
      : message.message_type === 'image_with_text'
        ? message.content.image_url
        : undefined,
    imageThumb: ['image', 'image_with_text'].includes(message.message_type) 
      ? {
          url: message.message_type === 'image'
            ? (message.content.thumb_url || message.content.url || '')
            : (message.content.thumb_url || message.content.image_url || ''),
          height: message.content.thumb_height || 0,
          width: message.content.thumb_width || 0
        }
      : undefined,
    orderData: message.message_type === 'order'
      ? {
          shopId: message.content.shop_id || 0,
          orderSn: message.content.order_sn || ''
        }
      : undefined,
    stickerData: message.message_type === 'sticker'
      ? {
          stickerId: message.content.sticker_id || '',
          packageId: message.content.sticker_package_id || ''
        }
      : undefined,
    itemData: message.message_type === 'item'
      ? {
          shopId: message.content.shop_id || 0,
          itemId: message.content.item_id || 0
        }
      : undefined,
    sourceContent: message.source_content,
    time: new Date(message.created_timestamp * 1000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })
};
}

// Definisikan tipe untuk data percakapan dari API
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
  latest_message_id?: string;
  last_message_timestamp: number;
  unread_count: number;
  pinned?: boolean;
  last_read_message_id?: string;
  latest_message_type?: string;
  last_message_option?: number;
  max_general_option_hide_time?: string;
  mute?: boolean;
  opposite_last_deliver_msg_id?: string;
  opposite_last_read_msg_id?: string;
}

// Definisikan tipe untuk chat
export interface ChatInfo {
  toId: number;
  toName: string;
  toAvatar: string;
  shopId: number;
  shopName: string;
  conversationId?: string;
  metadata?: ChatMetadata;
}

// Definisikan tipe metadata
export interface ChatMetadata {
  orderId?: string;
  productId?: string;
  source?: string;
  timestamp?: string;
  orderStatus?: string;
}

// Definisikan tipe untuk pesan SSE
export interface SSEMessageData {
  shop_name: string;
  type: string;
  message_type: string;
  conversation_id: string;
  message_id: string;
  sender: number;
  sender_name: string;
  receiver: number;
  receiver_name: string;
  shop_id: number;
  timestamp: number;
  content: {
    text?: string;
    url?: string;
    thumb_url?: string;
    thumb_height?: number;
    thumb_width?: number;
    image_url?: string;
    order_sn?: string;
  };
}

interface Message {
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
    order_sn?: string;
    [key: string]: any;
  };
  message_type: string;
  created_timestamp: number;
  status: string;
  sender_name?: string;
  receiver_name?: string;
}

// Constants
const MESSAGE_LIMIT = 50; // Batasi 50 pesan per conversation
const REFRESH_INTERVAL = 60000; // 60 detik
const THROTTLE_TIME = 5000; // 5 detik

// Interface untuk parameter sendMessage
export interface SendMessageParams {
  conversationId: string;
  content: string;
  toId: number;
  shopId: number;
}

// Tipe untuk state global
export interface ChatState {
  // Core Data
  conversations: Conversation[];
  totalUnread: number;
  
  // SSE Related
  processedMessages: Set<string>;
  lastMessage: SSEMessageData | null;
  isConnected: boolean;
  
  // Loading States
  isInitialized: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  initError: Error | null;

  // Error States
  errors: {
    fetch?: string;
    send?: string;
    initialize?: string;
  };

  // User Data
  userId: number | null;
  isUserLoading: boolean;

  // Refresh Status
  lastRefreshTime: number;
  isRefreshing: boolean;
  refreshError: string | null;

  // Active Chats
  activeChats: ChatInfo[];
}

// Tipe untuk options fetchMessages
interface FetchMessagesOptions {
  offset?: string;
  pageSize?: number;
  message_id_list?: number[];
}

// Tipe untuk actions global
export interface ChatActions {
  // Core Actions
  refreshConversations: () => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
  sendMessage: (params: SendMessageParams) => Promise<string>;
  handleSSEMessage: (data: SSEMessageData) => void;
  initializeConversation: (params: { userId: string; shopId: string; orderSn?: string }) => Promise<string>;
  fetchOneConversation: (conversationId: string, shopId: number, shopName?: string) => Promise<Conversation | null>;
  
  // Messages Actions
  fetchMessages: (
    conversationId: string, 
    options?: FetchMessagesOptions
  ) => Promise<Message[]>;
  
  // State Updates
  setConversations: (conversations: Conversation[]) => void;
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => void;
  addConversation: (conversation: Conversation) => void;
  updateTotalUnread: () => void;

  // Initialization
  initialize: () => Promise<void>;
  setInitialized: (initialized: boolean) => void;
  setLoading: (loading: boolean) => void;

  // Refresh Actions
  refreshWithThrottle: () => Promise<void>;
  setRefreshStatus: (isRefreshing: boolean, error?: string | null) => void;

  // Error Handling
  setError: (type: keyof ChatState['errors'], error: string | undefined) => void;
  clearErrors: () => void;

  // User Data Actions
  setUserId: (userId: number | null) => void;
  setUserLoading: (isLoading: boolean) => void;

  // Connection Actions
  setConnected: (isConnected: boolean) => void;

  // Active Chats Actions
  openChat: (chatData: ChatInfo) => void;
}

// Initial state
const initialState: ChatState = {
  conversations: [],
  totalUnread: 0,
  processedMessages: new Set(),
  lastMessage: null,
  isConnected: false,
  isInitialized: false,
  isLoading: false,
  isInitializing: false,
  initError: null,
  errors: {},
  userId: null,
  isUserLoading: true,
  lastRefreshTime: 0,
  isRefreshing: false,
  refreshError: null,
  activeChats: [],
};

// Create store
const useStoreChat = create<ChatState & ChatActions>((set, get) => ({
  ...initialState,

  // State Updates
  setConversations: (conversations) => {
    set({ conversations });
    get().updateTotalUnread();
  },

  updateConversation: (conversationId, updates) => {
    set(state => ({
      conversations: state.conversations.map(conv =>
        conv.conversation_id === conversationId
          ? { ...conv, ...updates }
          : conv
      )
    }));
    get().updateTotalUnread();
  },

  addConversation: (conversation) => {
    set(state => ({
      conversations: [
        conversation,
        ...state.conversations.filter(c => c.conversation_id !== conversation.conversation_id)
      ]
    }));
    get().updateTotalUnread();
  },

  updateTotalUnread: () => {
    // Hitung jumlah conversation yang memiliki unread_count > 0
    const totalUnread = get().conversations.filter(conv => conv.unread_count > 0).length;
    
    console.log('[StoreChat] Updating total unread:', {
      totalConversations: get().conversations.length,
      conversationsWithUnread: totalUnread
    });
    
    set({ totalUnread });
  },

  // User Data Actions
  setUserId: (userId) => set({ userId }),
  setUserLoading: (isLoading) => set({ isUserLoading: isLoading }),

  // Connection Actions
  setConnected: (isConnected) => {
    const prevConnected = get().isConnected;
    set({ isConnected });
    
    // Jika baru saja online, refresh data
    if (!prevConnected && isConnected) {
      get().refreshWithThrottle();
    }
  },

  // Error Handling
  setError: (type, error) => 
    set(state => ({
      errors: { ...state.errors, [type]: error }
    })),

  clearErrors: () => set({ errors: {} }),

  // Loading State
  setInitialized: (initialized) => set({ isInitialized: initialized }),
  setLoading: (loading) => set({ isLoading: loading }),

  // Refresh Status
  setRefreshStatus: (isRefreshing, error = null) => {
    set({
      isRefreshing,
      refreshError: error,
      ...(isRefreshing ? {} : { lastRefreshTime: Date.now() })
    });
  },

  // Core Actions
  refreshConversations: async () => {
    try {
      logger.info('Memulai refresh conversations');
      get().setError('fetch', undefined);
      const timestamp = new Date().getTime();
      
      logger.info('Fetching conversation list...');
      const response = await fetch(`/api/msg/get_conversation_list?_=${timestamp}`);
      
      logger.info('Response status:', response.status);
      
      if (!response.ok) {
        logger.error('Response not OK:', { status: response.status, statusText: response.statusText });
        throw new Error('Gagal mengambil daftar percakapan');
      }
      
      const data = await response.json();
      logger.info('Berhasil mengambil data conversations:', data);
      
      if (Array.isArray(data)) {
      get().setConversations(data);
      logger.info(`Berhasil mengambil ${data.length} percakapan`);
      } else {
        logger.error('Data bukan array:', { data });
        throw new Error('Format data tidak valid');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error refreshing conversations:', error);
      get().setError('fetch', errorMsg);
      throw error;
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
        get().setConversations(updatedConversations);
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  },

  sendMessage: async (params: SendMessageParams) => {
    try {
      get().setError('send', undefined);
      const conversation = get().conversations.find(conv => conv.conversation_id === params.conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      logger.info(`Mengirim pesan ke ${conversation.to_name} (ID: ${conversation.to_id}) dari toko ${conversation.shop_name}`);

      const response = await fetch('/api/msg/send_message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toId: params.toId,
          content: params.content,
          shopId: params.shopId,
        })
      });

      if (!response.ok) {
        throw new Error('Gagal mengirim pesan');
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        // Update conversation dengan pesan terakhir
        get().updateConversation(params.conversationId, {
          latest_message_content: { text: params.content },
          latest_message_from_id: params.shopId,
          latest_message_id: data.data.message_id,
          last_message_timestamp: data.data.created_timestamp || Date.now(),
          latest_message_type: 'text',
          unread_count: 0
        });

        logger.info(`Pesan berhasil dikirim ke conversation ${params.conversationId} dengan ID ${data.data.message_id}`);
        return data.data.message_id;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error sending message:', error);
      get().setError('send', errorMsg);
      throw error;
    }
  },

  handleSSEMessage: (data) => {
    logger.info('Menerima pesan SSE:', { 
      messageId: data?.message_id, 
      conversationId: data?.conversation_id,
      type: data?.message_type,
      sender: data?.sender,
      content: data?.content,
      timestamp: data?.timestamp ? new Date(data.timestamp * 1000).toLocaleString() : undefined
    });
    
    if (!data?.message_id || !data.conversation_id || !data.shop_id) {
      logger.error('Invalid SSE message data:', data);
      return;
    }
    
    if (get().processedMessages.has(data.message_id)) {
      logger.info(`Pesan dengan ID ${data.message_id} sudah diproses sebelumnya, mengabaikan...`);
      return;
    }

    // Batasi ukuran Set processedMessages
    if (get().processedMessages.size > 1000) {
      logger.info(`Cache pesan mencapai batas (${get().processedMessages.size}), menghapus 500 ID pesan tertua...`);
      const newSet = new Set(Array.from(get().processedMessages).slice(-500));
      set({ processedMessages: newSet });
      logger.info(`Cache pesan dikurangi menjadi ${newSet.size} item`);
    }

    logger.info(`Menambahkan pesan ID ${data.message_id} ke daftar pesan yang sudah diproses`);
    get().processedMessages.add(data.message_id);
    
    logger.info(`Mencari percakapan dengan ID ${data.conversation_id} dalam daftar ${get().conversations.length} percakapan...`);
    const conversation = get().conversations.find(
      conv => conv.conversation_id === data.conversation_id
    );

    if (!conversation) {
      logger.info(`Conversation ${data.conversation_id} tidak ditemukan, mengambil dari API...`);
      logger.info(`Parameter fetch: shopId=${data.shop_id}, conversationId=${data.conversation_id}`);
      get().fetchOneConversation(data.conversation_id, data.shop_id, data.shop_name)
        .then(result => {
          if (result) {
            logger.info(`Berhasil menambahkan conversation baru: ${result.conversation_id} dengan ${result.to_name}`);
          } else {
            logger.error(`Gagal mengambil conversation ${data.conversation_id} dari API`);
          }
        })
        .catch(err => {
          logger.error(`Error saat mengambil conversation: ${err.message}`);
        });
    } else {
      const prevUnreadCount = conversation.unread_count;
      logger.info(`Memperbarui conversation ${data.conversation_id} dengan pesan baru`);
      logger.info(`Detail update: from=${data.sender} (${data.sender === conversation.to_id ? 'buyer' : 'seller'}), type=${data.message_type}`);
      get().updateConversation(data.conversation_id, {
        latest_message_content: data.content,
        latest_message_from_id: data.sender,
        latest_message_id: data.message_id,
        last_message_timestamp: data.timestamp,
        latest_message_type: data.message_type,
        unread_count: conversation.unread_count + 1
      });
      logger.info(`Conversation ${data.conversation_id} diperbarui. Unread: ${prevUnreadCount} → ${conversation.unread_count + 1}`);
    }

    logger.info(`Menyimpan pesan terakhir ke state untuk notifikasi dan UI updates`);
    set({ lastMessage: data });
    logger.info(`Proses handleSSEMessage selesai untuk pesan ID ${data.message_id}`);
  },

  initializeConversation: async (params: { userId: string; shopId: string; orderSn?: string }): Promise<string> => {
    try {
      logger.info('Menginisialisasi percakapan:', params);
      
      // Konversi dan validasi parameter
      const userId = Number(params.userId);
      const shopId = Number(params.shopId);
      
      if (isNaN(userId) || userId <= 0) {
        throw new Error('Invalid userId: Harus berupa bilangan bulat positif');
      }
      
      if (isNaN(shopId) || shopId <= 0) {
        throw new Error('Invalid shopId: Harus berupa bilangan bulat positif');
      }

      if (!params.orderSn) {
        throw new Error('orderSn harus diisi');
      }
      
      const response = await fetch('/api/msg/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          shopId,
          orderSn: params.orderSn
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.error('Error response:', errorData);
        throw new Error(errorData.error || 'Gagal menginisialisasi percakapan');
      }

      const data = await response.json();
      logger.info('Response inisialisasi:', data);

      if (data.success && data.conversation) {
        const conversationId = data.conversation.conversation_id;
        
        // Tambahkan conversation baru ke state
        const newConversation: Conversation = {
          conversation_id: conversationId,
          to_id: userId,
          to_name: data.conversation.to_name || '',
          to_avatar: data.conversation.to_avatar || '',
          shop_id: shopId,
          shop_name: data.conversation.shop_name || '',
          latest_message_content: { text: `Order: ${params.orderSn}` },
          latest_message_from_id: userId,
          latest_message_id: data.conversation.message_id,
          last_message_timestamp: Math.floor(Date.now() / 1000),
          unread_count: 0
        };
        
        // Tambahkan ke state tanpa refresh
        get().addConversation(newConversation);
        return conversationId;
      }

      throw new Error('Gagal mendapatkan conversation_id');
    } catch (error) {
      logger.error('Error initializing conversation:', error);
      throw error;
    }
  },

  fetchOneConversation: async (conversationId: string, shopId: number, shopName?: string) => {
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
            shop_name: shopName || conv.shop_name || 'Toko',
            latest_message_content: conv.latest_message_content,
            latest_message_from_id: conv.latest_message_from_id,
            latest_message_id: conv.latest_message_id,
            last_message_timestamp: conv.last_message_timestamp,
            unread_count: conv.unread_count || 1,
            pinned: conv.pinned,
            last_read_message_id: conv.last_read_message_id,
            latest_message_type: conv.latest_message_type
          };

          // Tambahkan conversation baru ke list secara manual
          get().addConversation(newConversation);

          return newConversation;
        }
      }
      
      console.error('[MiniChat] Gagal mengambil conversation, fallback ke refresh');
      await get().refreshConversations();
      return null;
    } catch (error) {
      console.error('Error fetching conversation:', error);
      await get().refreshConversations();
      return null;
    }
  },

  // Messages Actions
  // Disederhanakan: Hanya fetch messages dari API tanpa menyimpan di store
  fetchMessages: async (conversationId: string, options = {}) => {
    const conversation = get().conversations.find(conv => conv.conversation_id === conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    try {
      const queryParams = new URLSearchParams({
        conversationId: conversationId,
        shopId: conversation.shop_id.toString(),
        pageSize: (options.pageSize || 25).toString()
      });

      // Tambahkan optional params
      if (options.offset !== undefined) {
        queryParams.append('offset', options.offset);
      }

      if (options.message_id_list?.length) {
        queryParams.append('message_id_list', options.message_id_list.join(','));
      }

      logger.info(`Mengambil pesan untuk conversation ${conversationId}`, {
        shopId: conversation.shop_id,
        options
      });

      const response = await fetch(`/api/msg/get_message?${queryParams.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        logger.error('Gagal mengambil pesan:', errorData);
        throw new Error(errorData.error || 'Gagal mengambil pesan');
      }

      const data = await response.json();
      
      if (data.error) {
        logger.error('Error dari API:', data);
        throw new Error(data.error);
      }

      // Dapatkan messages dari response
      const messages = data.response?.messages || [];
      logger.info(`Berhasil mengambil ${messages.length} pesan`);

      // Kembalikan dalam urutan dari terlama ke terbaru
      return [...messages].reverse();
    } catch (error) {
      logger.error('Error fetching messages:', error);
      throw error;
    }
  },

  refreshWithThrottle: async () => {
    const now = Date.now();
    const timeSinceLastRefresh = now - get().lastRefreshTime;
    
    if (!navigator.onLine) {
      logger.info('Offline, skipping refresh');
      return;
    }

    if (get().isRefreshing) {
      logger.info('Refresh already in progress, skipping');
      return;
    }

    if (timeSinceLastRefresh < THROTTLE_TIME) {
      logger.info(`Throttling refresh, last refresh was ${timeSinceLastRefresh}ms ago`);
      return;
    }

    try {
      get().setRefreshStatus(true);
      await get().refreshConversations();
    } catch (error) {
      logger.error('Error during refresh:', error);
      get().setRefreshStatus(false, error instanceof Error ? error.message : 'Unknown error');
    } finally {
      get().setRefreshStatus(false);
    }
  },

  // Initialization
  initialize: async () => {
    const state = get();
    logger.info('Initializing chat store:', { 
      isInitialized: state.isInitialized, 
      isLoading: state.isLoading, 
      userId: state.userId 
    });
    
    if (state.isInitialized || state.isLoading || !state.userId) {
      logger.info('Skipping initialization:', {
        reason: state.isInitialized ? 'already initialized' :
                state.isLoading ? 'loading in progress' :
                'no userId'
      });
      return;
    }

    try {
      get().setLoading(true);
      logger.info('Starting conversation refresh');
      await get().refreshConversations();
      get().setInitialized(true);
      logger.info('Chat store initialized successfully');
    } catch (error) {
      logger.error('Error initializing chat:', error);
      get().setError('initialize', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      get().setLoading(false);
    }
  },

  openChat: (chatData) => {
    const { activeChats = [] } = get();
    
    // Cek apakah chat dengan kombinasi toId dan shopId yang sama sudah ada
    const existingChatIndex = activeChats.findIndex(
      existing => existing.toId === chatData.toId && existing.shopId === chatData.shopId
    );

    if (existingChatIndex !== -1) {
      // Jika sudah ada, update data chat tersebut
      const updatedChats = [...activeChats];
      updatedChats[existingChatIndex] = {
        ...updatedChats[existingChatIndex],
        ...chatData
      };
      set({ activeChats: updatedChats });
    } else {
      // Jika belum ada, tambahkan chat baru
      // Batasi jumlah chat aktif (misal maksimal 3)
      const maxChats = 3;
      const newChats = activeChats.length >= maxChats 
        ? [...activeChats.slice(1), chatData]
        : [...activeChats, chatData];
      
      set({ activeChats: newChats });
    }
  },
}));

// Hook untuk auto-refresh
export const useStoreChatInitializer = () => {
  const { initialize, isInitialized } = useStoreChat();

  // Initial load
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [initialize, isInitialized]);
};

// Hook untuk integrasi dengan UserData dan SSE
export const useStoreChatIntegration = () => {
  const { userId, isLoading: isUserLoading } = useUserData();
  const { lastMessage, isConnected } = useSSE();
  const { 
    setUserId, 
    setUserLoading, 
    setConnected,
    handleSSEMessage,
    initialize,
    isInitialized
  } = useStoreChat();

  // Integrasi UserData
  useEffect(() => {
    logger.info('UserData changed:', { userId, isUserLoading });
    
    // Convert UUID to numeric ID jika perlu
    if (typeof userId === 'string' && userId) {
      // Gunakan hash sederhana untuk mengkonversi UUID ke number
      const numericId = parseInt(userId.replace(/-/g, '').slice(0, 8), 16);
      logger.info('Converting UUID to numeric ID:', { uuid: userId, numericId });
      setUserId(numericId);
    } else if (typeof userId === 'number') {
      setUserId(userId);
    }
    setUserLoading(isUserLoading);
  }, [userId, isUserLoading]);

  // Integrasi SSE
  useEffect(() => {
    setConnected(isConnected);
  }, [isConnected]);

  useEffect(() => {
    if (lastMessage?.type === 'new_message' && lastMessage.for_chat_context) {
      handleSSEMessage(lastMessage.for_chat_context);
    }
  }, [lastMessage]);

  // Auto Initialize dengan logging
  useEffect(() => {
    logger.info('Checking initialization conditions:', {
      userId: typeof userId === 'string' ? 'UUID present' : userId,
      isUserLoading,
      isInitialized
    });

    if (userId && !isUserLoading && !isInitialized) {
      logger.info('Starting chat initialization');
      initialize();
    }
  }, [userId, isUserLoading, isInitialized]);
};

export default useStoreChat; 