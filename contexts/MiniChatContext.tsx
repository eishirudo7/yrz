'use client'
import React, { createContext, useContext, useReducer, useCallback, useEffect, useState, useMemo } from 'react';
import { useSSE } from '@/app/services/SSEService';
import { useUserData } from '@/contexts/UserDataContext';

// Definisikan tipe untuk data percakapan dari API
interface Conversation {
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

// Definisikan tipe metadata
interface ChatMetadata {
  orderId?: string;
  productId?: string;
  source?: string;
  timestamp?: string;
  orderStatus?: string;
}

// Definisikan tipe untuk pesan SSE
interface SSEMessageData {
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

// Definisikan tipe state
interface MiniChatState {
  isOpen: boolean;
  isMinimized: boolean;
  activeChats: {
    conversationId: string;
    shopId: number;
    toId: number;
    toName: string;
    toAvatar: string;
    shopName: string;
    metadata?: ChatMetadata;
  }[];
  conversations: Conversation[];
  isLoading: boolean;
  isMobile: boolean;
  searchQuery: string;
  selectedShops: number[];
  statusFilter: 'SEMUA' | 'BELUM DIBACA' | 'BELUM DIBALAS';
  isConnected: boolean; // Status koneksi SSE
}

// Definisikan tipe untuk chat
interface ChatInfo {
  toId: number;
  toName: string;
  toAvatar: string;
  shopId: number;
  shopName: string;
  conversationId?: string; // Opsional, akan dicari dari daftar percakapan jika tidak ada
  metadata?: ChatMetadata;
}

// Tipe untuk update conversation
type ConversationUpdate = 
  | { type: 'mark_as_read'; conversation_id: string }
  | { type: 'refresh' };

// Definisikan tipe action
type MiniChatAction =
  | { type: 'OPEN_CHAT'; payload: ChatInfo }
  | { type: 'CLOSE_CHAT'; payload: { conversationId: string } }
  | { type: 'MINIMIZE_CHAT'; payload: { minimize: boolean } }
  | { type: 'SEND_MESSAGE'; payload: { conversationId: string; message: string } }
  | { type: 'SET_CONVERSATIONS'; payload: Conversation[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'ADD_CONVERSATION'; payload: Conversation }
  | { type: 'SET_MOBILE'; payload: boolean }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SHOP_FILTER'; payload: number[] }
  | { type: 'SET_STATUS_FILTER'; payload: 'SEMUA' | 'BELUM DIBACA' | 'BELUM DIBALAS' }
  | { type: 'UPDATE_CONVERSATION'; payload: { type: string; data: any } }
  | { type: 'SET_CONNECTED'; payload: boolean };

// Buat context
const MiniChatContext = createContext<{
  state: MiniChatState;
  openChat: (chat: ChatInfo) => void;
  closeChat: (conversationId: string) => void;
  minimizeChat: (minimize: boolean) => void;
  sendMessage: (conversationId: string, message: string, onSuccess?: (messageId: string) => void) => Promise<any>;
  refreshConversations: () => Promise<void>;
  totalUnread: number;
  setTotalUnread: React.Dispatch<React.SetStateAction<number>>;
  markMessageAsRead: (conversationId: string, messageId: string) => Promise<any>;
  setSearchQuery: (query: string) => void;
  setShopFilter: (shops: number[]) => void;
  setStatusFilter: (status: 'SEMUA' | 'BELUM DIBACA' | 'BELUM DIBALAS') => void;
  updateConversationList: (update: ConversationUpdate) => void;
  filteredConversations: Conversation[];
  uniqueShops: number[];
  initializeConversation: (userId: number, orderSn: string, shopId: number) => Promise<Conversation | null>;
} | undefined>(undefined);

// Buat reducer
const miniChatReducer = (state: MiniChatState, action: MiniChatAction): MiniChatState => {
  console.log('Reducer received action:', action);
  
  switch (action.type) {
    case 'SET_CONNECTED':
      return {
        ...state,
        isConnected: action.payload
      };
      
    case 'SET_SEARCH_QUERY':
      return {
        ...state,
        searchQuery: action.payload
      };
      
    case 'SET_SHOP_FILTER':
      return {
        ...state,
        selectedShops: action.payload
      };
      
    case 'SET_STATUS_FILTER':
      return {
        ...state,
        statusFilter: action.payload
      };
      
    case 'SET_MOBILE':
      // Jika berubah dari desktop ke mobile, terapkan batasan 1 chat
      if (action.payload && !state.isMobile && state.activeChats.length > 1) {
        return {
          ...state,
          isMobile: action.payload,
          activeChats: state.activeChats.slice(-1) // Hanya ambil chat terbaru
        };
      }
      return {
        ...state,
        isMobile: action.payload
      };
      
    case 'OPEN_CHAT': {
      const { toId, shopId, toName, toAvatar, shopName, metadata } = action.payload;
      
      // Cari conversationId dari daftar percakapan jika tidak disediakan
      let conversationId = action.payload.conversationId;
      let finalAvatar = toAvatar;
      
      if (!conversationId) {
        // Cari percakapan yang cocok berdasarkan toId dan shopId
        const matchingConversation = state.conversations.find(
          conv => conv.to_id === toId && conv.shop_id === shopId
        );
        
        if (matchingConversation) {
          conversationId = matchingConversation.conversation_id;
          
          // Gunakan avatar dari daftar percakapan jika ada
          if (matchingConversation.to_avatar) {
            finalAvatar = matchingConversation.to_avatar;
          }
        } else {
          // Buat ID sementara
          conversationId = `temp_${toId}_${shopId}_${Date.now()}`;
          console.log('Membuat temporary conversationId:', conversationId);
          
          // Tambahkan juga ke daftar percakapan
          const tempConversation: Conversation = {
            conversation_id: conversationId,
            to_id: toId,
            to_name: toName,
            to_avatar: finalAvatar,
            shop_id: shopId,
            shop_name: shopName,
            latest_message_content: null,
            latest_message_from_id: 0,
            last_message_timestamp: Date.now(),
            unread_count: 0
          };
          
          // Tambahkan percakapan sementara ke state
          return {
            ...state,
            isOpen: true,
            isMinimized: false,
            conversations: [tempConversation, ...state.conversations],
            activeChats: handleMaxChatsLimit([...state.activeChats, {
              conversationId,
              toId,
              toName,
              toAvatar: finalAvatar,
              shopId,
              shopName,
              metadata
            }], state.isMobile)
          };
        }
      }
      
      // Cek apakah chat sudah ada
      const existingChatIndex = state.activeChats.findIndex(
        chat => chat.conversationId === conversationId
      );
      
      if (existingChatIndex >= 0) {
        // Update chat yang sudah ada dengan data terbaru dan pindahkan ke posisi terakhir (paling depan)
        const updatedChats = [...state.activeChats];
        const chatToUpdate = updatedChats.splice(existingChatIndex, 1)[0];
        
        const updatedChat = {
          ...chatToUpdate,
          toId,
          toName,
          toAvatar: finalAvatar,
          shopId,
          shopName,
          // Gabungkan metadata jika ada
          metadata: {
            ...chatToUpdate.metadata,
            ...metadata
          }
        };
        
        return {
          ...state,
          isOpen: true,
          isMinimized: false,
          activeChats: handleMaxChatsLimit([...updatedChats, updatedChat], state.isMobile)
        };
      }
      
      // Tambahkan chat baru dengan memeriksa batas maksimum
      return {
        ...state,
        isOpen: true,
        isMinimized: false,
        activeChats: handleMaxChatsLimit([...state.activeChats, {
          conversationId,
          toId,
          toName,
          toAvatar: finalAvatar,
          shopId,
          shopName,
          metadata
        }], state.isMobile)
      };
    }
      
    case 'CLOSE_CHAT':
      return {
        ...state,
        activeChats: state.activeChats.filter(
          chat => chat.conversationId !== action.payload.conversationId
        ),
        isOpen: state.activeChats.length > 1 // Tetap buka jika masih ada chat lain
      };
      
    case 'MINIMIZE_CHAT':
      return {
        ...state,
        isMinimized: action.payload.minimize
      };
      
    case 'SEND_MESSAGE':
      // Implementasi pengiriman pesan
      return state;
      
    case 'SET_CONVERSATIONS':
      return {
        ...state,
        conversations: action.payload
      };
      
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      };
      
    case 'ADD_CONVERSATION':
      return {
        ...state,
        conversations: [...state.conversations, action.payload]
      };

    case 'UPDATE_CONVERSATION': {
      const update = action.payload;
      
      if (update.type === 'mark_as_read') {
        const conversationId = update.data;
        const updatedConversations = state.conversations.map(conv => {
          if (conv.conversation_id === conversationId) {
            return {
              ...conv,
              unread_count: 0
            };
          }
          return conv;
        });
        
        return {
          ...state,
          conversations: updatedConversations
        };
      }
      
      return state;
    }
      
    default:
      return state;
  }
};

// Fungsi untuk menangani batas maksimum chat aktif (6)
function handleMaxChatsLimit(chats: MiniChatState['activeChats'], isMobile: boolean) {
  if (isMobile) {
    // Untuk mobile, hanya izinkan 1 chat
    return chats.slice(-1); // Ambil hanya chat terbaru
  } else {
    // Untuk desktop, batasi hingga 6 chat
    if (chats.length > 6) {
      return chats.slice(1); // Hapus chat tertua
    }
    return chats;
  }
}

// Buat provider
export const MiniChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(miniChatReducer, {
    isOpen: false,
    isMinimized: false,
    activeChats: [],
    conversations: [],
    isLoading: false,
    isMobile: false, // Default set ke false
    searchQuery: '',
    selectedShops: [],
    statusFilter: 'SEMUA',
    isConnected: false
  });
  
  // Dapatkan status user login dari UserDataContext
  const { userId, isLoading: isUserLoading } = useUserData();
  
  // Tambahkan state untuk total unread messages
  const [totalUnread, setTotalUnread] = useState(0);
  
  // Tambahkan SSE hook
  const { lastMessage, isConnected } = useSSE();
  
  // Update koneksi SSE
  useEffect(() => {
    dispatch({ type: 'SET_CONNECTED', payload: isConnected });
  }, [isConnected]);
  
  // Tambahkan hook untuk mendeteksi mobile
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth < 768; // Tentukan breakpoint untuk mobile
      dispatch({ type: 'SET_MOBILE', payload: isMobile });
    };
    
    // Cek saat pertama kali load
    checkMobile();
    
    // Tambahkan event listener untuk resize
    window.addEventListener('resize', checkMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fungsi untuk menandai pesan sebagai dibaca
  const markMessageAsRead = async (conversationId: string, messageId: string) => {
    try {
      const conversation = state.conversations.find(conv => conv.conversation_id === conversationId);
      if (!conversation) return;
      
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
      
      const data = await response.json();
      
      // Update conversations setelah berhasil menandai pesan dibaca
      updateConversationList({
        type: 'mark_as_read',
        conversation_id: conversationId
      });
      
      // Update total unread
      recalculateTotalUnread();
      
      return data;
    } catch (error) {
      console.error('Gagal menandai pesan sebagai dibaca:', error);
      throw error;
    }
  };

  // Fungsi untuk menghitung ulang total pesan yang belum dibaca
  const recalculateTotalUnread = () => {
    const total = state.conversations.filter(conv => conv.unread_count > 0).length;
    setTotalUnread(total);
  };
  
  // Menghitung total unread setiap kali conversations berubah
  useEffect(() => {
    recalculateTotalUnread();
  }, [state.conversations]);
  
  // Fungsi untuk mengambil daftar percakapan
  const fetchConversations = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/msg/get_conversation_list?_=${timestamp}`);
      
      if (!response.ok) {
        throw new Error('Gagal mengambil daftar percakapan');
      }
      
      const data = await response.json();
      dispatch({ type: 'SET_CONVERSATIONS', payload: data });
      
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);
  
  // Ambil daftar percakapan ketika user login berhasil (userId tersedia dan loading selesai)
  useEffect(() => {
    if (userId && !isUserLoading) {
      console.log('[MiniChat]: User terdeteksi sudah login, mengambil daftar percakapan');
      fetchConversations();
    } else if (!userId && !isUserLoading) {
      console.log('[MiniChat]: User tidak login, reset state percakapan');
      dispatch({ type: 'SET_CONVERSATIONS', payload: [] });
    }
  }, [userId, isUserLoading, fetchConversations]);
  
  // Fungsi untuk update conversation list
  const updateConversationList = useCallback((update: ConversationUpdate) => {
    console.log('updateConversationList called with:', update);
    
    switch (update.type) {
      case 'mark_as_read':
        dispatch({ 
          type: 'UPDATE_CONVERSATION', 
          payload: { type: 'mark_as_read', data: update.conversation_id } 
        });
        break;
        
      case 'refresh':
        fetchConversations();
        break;
    }
  }, [fetchConversations]);
  
  // Fungsi untuk send message
  const sendMessage = useCallback(async (conversationId: string, message: string, onSuccess?: (messageId: string) => void) => {
    const conversation = state.conversations.find(conv => conv.conversation_id === conversationId);
    if (!conversation) throw new Error('Conversation not found');
    
    try {
      const response = await fetch('/api/msg/send_message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          toId: conversation.to_id,
          content: message,
          shopId: conversation.shop_id,
        })
      });
      
      if (!response.ok) {
        throw new Error('Gagal mengirim pesan');
      }
      
      const data = await response.json();
      
      // Mark as read after sending message
      updateConversationList({
        type: 'mark_as_read',
        conversation_id: conversationId
      });
      
      // Call success callback if provided
      if (onSuccess && data.data && data.data.message_id) {
        onSuccess(data.data.message_id);
      }
      
      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }, [state.conversations, updateConversationList]);
  
  // Fungsi untuk initialize conversation
  const initializeConversation = useCallback(async (userId: number, orderSn: string, shopId: number) => {
    try {
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
        await fetchConversations();
        
        const newConversation = state.conversations.find(
          conv => conv.conversation_id === data.conversation.conversation_id
        );
        
        return newConversation || null;
      }
      
      return null;
    } catch (error) {
      console.error('Error initializing conversation:', error);
      return null;
    }
  }, [fetchConversations, state.conversations]);
  
  // Fungsi openChat yang lebih efisien
  const openChat = useCallback(async (chat: ChatInfo) => {
    const { toId, shopId, conversationId: existingConversationId, metadata } = chat;
    
    // Jika sudah ada conversationId, langsung gunakan
    if (existingConversationId) {
      dispatch({ type: 'OPEN_CHAT', payload: chat });
      return;
    }
    
    // Cari conversationId dari daftar percakapan jika tidak disediakan
    const matchingConversation = state.conversations.find(
      conv => conv.to_id === toId && conv.shop_id === shopId
    );
    
    if (matchingConversation) {
      // Gunakan data dari percakapan yang sudah ada
      dispatch({ 
        type: 'OPEN_CHAT', 
        payload: {
          ...chat,
          conversationId: matchingConversation.conversation_id,
          toAvatar: matchingConversation.to_avatar || chat.toAvatar
        }
      });
      return;
    }
    
    // Jika tidak ada conversationId dan perlu inisiasi
    if (metadata?.orderId) {
      try {
        const response = await fetch('/api/msg/initialize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: toId,
            orderSn: metadata.orderId,
            shopId: shopId
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.success && data.conversation?.conversation_id) {
            // Langsung gunakan conversation_id dari respons inisiasi
            const newConversationId = String(data.conversation.conversation_id);
            
            // Buat objek percakapan baru berdasarkan data yang kita sudah punya + conversation_id baru
            const newConversation = {
              conversation_id: newConversationId,
              to_id: toId,
              to_name: chat.toName,
              to_avatar: chat.toAvatar || '',
              shop_id: shopId,
              shop_name: chat.shopName,
              last_message_timestamp: Date.now(),
              unread_count: 0,
              latest_message_content: null,
              latest_message_from_id: 0
            };
            
            // Tambahkan ke daftar percakapan secara lokal tanpa meminta ulang dari server
            dispatch({ 
              type: 'ADD_CONVERSATION', 
              payload: newConversation 
            });
            
            // Buka chat dengan conversation_id baru
            dispatch({ 
              type: 'OPEN_CHAT', 
              payload: { 
                ...chat, 
                conversationId: newConversationId 
              } 
            });
            return;
          }
        }
        
        // Jika inisiasi gagal, buka chat tanpa conversationId (akan menampilkan error atau pesan bantuan)
        dispatch({ type: 'OPEN_CHAT', payload: chat });
        
      } catch (error) {
        console.error('Error initializing conversation:', error);
        // Tetap buka chat meskipun inisiasi gagal
        dispatch({ type: 'OPEN_CHAT', payload: chat });
      }
    } else {
      // Jika tidak ada orderId untuk inisiasi, buka chat tanpa conversationId
      dispatch({ type: 'OPEN_CHAT', payload: chat });
    }
  }, [state.conversations, dispatch]);
  
  const closeChat = useCallback((conversationId: string) => {
    dispatch({ type: 'CLOSE_CHAT', payload: { conversationId } });
  }, []);
  
  const minimizeChat = useCallback((minimize: boolean) => {
    dispatch({ type: 'MINIMIZE_CHAT', payload: { minimize } });
  }, []);
  
  const refreshConversations = useCallback(async () => {
    await fetchConversations();
  }, [fetchConversations]);
  
  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: query });
  }, []);
  
  const setShopFilter = useCallback((shops: number[]) => {
    dispatch({ type: 'SET_SHOP_FILTER', payload: shops });
  }, []);
  
  const setStatusFilter = useCallback((status: 'SEMUA' | 'BELUM DIBACA' | 'BELUM DIBALAS') => {
    dispatch({ type: 'SET_STATUS_FILTER', payload: status });
  }, []);
  
  // Compute filtered conversations
  const filteredConversations = useMemo(() => {
    if (!state.conversations || state.conversations.length === 0) {
      return [];
    }

    return state.conversations.filter(conversation => {
      if (!conversation || !conversation.to_name || !conversation.shop_name) {
        return false;
      }

      const matchesSearch = conversation.to_name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
                           conversation.shop_name.toLowerCase().includes(state.searchQuery.toLowerCase());
      const matchesShopFilter = state.selectedShops.length === 0 || state.selectedShops.includes(conversation.shop_id);
      const matchesStatusFilter = 
        state.statusFilter === 'SEMUA' ? true :
        state.statusFilter === 'BELUM DIBACA' ? conversation.unread_count > 0 :
        state.statusFilter === 'BELUM DIBALAS' ? (conversation.latest_message_content?.text && conversation.to_id == conversation.latest_message_from_id) : true;

      return matchesSearch && matchesShopFilter && matchesStatusFilter;
    });
  }, [state.conversations, state.searchQuery, state.selectedShops, state.statusFilter]);
  
  // Compute unique shops
  const uniqueShops = useMemo(() => {
    if (!state.conversations || state.conversations.length === 0) {
      return [];
    }
    const shops = new Set(state.conversations.map(conv => conv.shop_id));
    return Array.from(shops);
  }, [state.conversations]);
  
  return (
    <MiniChatContext.Provider value={{ 
      state, 
      openChat, 
      closeChat, 
      minimizeChat, 
      sendMessage,
      refreshConversations,
      totalUnread,
      setTotalUnread,
      markMessageAsRead,
      setSearchQuery,
      setShopFilter,
      setStatusFilter,
      updateConversationList,
      filteredConversations,
      uniqueShops,
      initializeConversation
    }}>
      {children}
    </MiniChatContext.Provider>
  );
};

// Buat hook untuk menggunakan context
export const useMiniChat = () => {
  const context = useContext(MiniChatContext);
  if (context === undefined) {
    throw new Error('useMiniChat must be used within a MiniChatProvider');
  }
  return context;
}; 