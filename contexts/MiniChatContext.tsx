'use client'
import React, { createContext, useContext, useReducer, useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useSSE } from '@/app/services/SSEService';
import { useUserData } from '@/contexts/UserDataContext';
import { chatReducer } from './chatReducer';
import { initialChatState } from './chatState';
import { chatActions } from './chatActions';

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

// Buat context
const MiniChatContext = createContext<{
  state: typeof initialChatState;
  openChat: (chat: ChatInfo) => void;
  closeChat: (conversationId: string) => void;
  minimizeChat: (minimize: boolean) => void;
  sendMessage: (conversationId: string, message: string, onSuccess?: (messageId: string) => void) => Promise<any>;
  refreshConversations: () => Promise<void>;
  totalUnread: number;
  markMessageAsRead: (conversationId: string, messageId: string) => Promise<any>;
  setSearchQuery: (query: string) => void;
  setShopFilter: (shops: number[]) => void;
  setStatusFilter: (status: 'SEMUA' | 'BELUM DIBACA' | 'BELUM DIBALAS') => void;
  updateConversationList: (update: ConversationUpdate) => void;
  filteredConversations: Conversation[];
  uniqueShops: number[];
  initializeConversation: (userId: number, orderSn: string, shopId: number) => Promise<Conversation | null>;
} | undefined>(undefined);

// Buat provider
export const MiniChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  
  // Dapatkan status user login dari UserDataContext
  const { userId, isLoading: isUserLoading, shops } = useUserData();
  
  // Ref for tracking processed messages (to avoid duplicates)
  const processedMessagesRef = useRef<Set<string>>(new Set());
  
  // Tambahkan SSE hook
  const { lastMessage, isConnected } = useSSE();
  
  // Update koneksi SSE
  useEffect(() => {
    dispatch(chatActions.connectionStatusChanged(isConnected));
  }, [isConnected]);
  
  // Tambahkan hook untuk mendeteksi mobile
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth < 768; // Tentukan breakpoint untuk mobile
      dispatch(chatActions.setMobile(isMobile));
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
      
      // Update state with the mark_as_read action
      dispatch(chatActions.markAsRead(conversationId));
      
      return data;
    } catch (error) {
      console.error('Gagal menandai pesan sebagai dibaca:', error);
      throw error;
    }
  };

  // Fungsi untuk mengambil daftar percakapan
  const fetchConversations = useCallback(async () => {
    try {
      console.log('[MiniChat] Mengambil daftar percakapan dari server...');
      dispatch(chatActions.fetchConversationsStarted());
      
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/msg/get_conversation_list?_=${timestamp}`);
      
      if (!response.ok) {
        console.error('[MiniChat] Gagal mengambil daftar percakapan:', response.status, response.statusText);
        dispatch(chatActions.fetchConversationsFailed('Gagal mengambil daftar percakapan'));
        throw new Error('Gagal mengambil daftar percakapan');
      }
      
      const data = await response.json();
      console.log(`[MiniChat] Berhasil mengambil ${data.length} percakapan`);
      dispatch(chatActions.fetchConversationsSucceeded(data));
      
    } catch (error) {
      console.error('[MiniChat] Error saat mengambil daftar percakapan:', error);
      dispatch(chatActions.fetchConversationsFailed('Error saat mengambil daftar percakapan'));
    }
  }, []);
  
  // Fungsi untuk mengambil satu percakapan
  const fetchOneConversation = useCallback(async (conversationId: string, shopId: number) => {
    try {
      console.log(`[MiniChat] Percakapan dengan ID ${conversationId} tidak ditemukan, mengambil dari API...`);
      
      const response = await fetch(
        `/api/msg/get_one_conversation?conversationId=${conversationId}&shopId=${shopId}`
      );
      
      if (response.ok) {
        const conversationData = await response.json();
        console.log(`[MiniChat] Berhasil mendapatkan data percakapan dari API:`, {
          conversationId: conversationId,
          shopId: shopId
        });
        
        // Dapatkan shop_name dari UserDataContext
        const shopInfo = shops.find(shop => shop.shop_id === shopId);
        const shopName = shopInfo ? shopInfo.shop_name : '';
        
        if (!shopInfo) {
          console.warn(`[MiniChat] Shop dengan ID ${shopId} tidak ditemukan di UserDataContext`);
        }
        
        // Cek apakah respons valid
        if (conversationData.response) {
          // Sesuaikan dengan format get_one_conversation yang sesungguhnya
          const conv = conversationData.response;
          
          // Konversi data ke format Conversation
          const newConversation: Conversation = {
            conversation_id: conv.conversation_id,
            to_id: conv.to_id,
            to_name: conv.to_name,
            to_avatar: conv.to_avatar,
            shop_id: shopId,
            shop_name: shopName, // Gunakan shop_name dari UserDataContext
            latest_message_content: conv.latest_message_content,
            latest_message_from_id: conv.latest_message_from_id,
            latest_message_id: conv.latest_message_id,
            last_message_timestamp: conv.last_message_timestamp,
            unread_count: conv.unread_count || 1,
            pinned: conv.pinned,
            last_read_message_id: conv.last_read_message_id,
            latest_message_type: conv.latest_message_type
          };
          
          // Dispatch action to add the conversation
          dispatch(chatActions.conversationAdded(newConversation));
          
          return newConversation;
        } else {
          console.error('[MiniChat] Format respons get_one_conversation tidak valid:', conversationData);
          console.log('[MiniChat] Fallback ke refresh percakapan');
          fetchConversations();
          return null;
        }
      } else {
        // Fallback ke metode yang ada jika API gagal
        console.error('[MiniChat] Gagal mengambil detail percakapan, status:', response.status);
        console.log('[MiniChat] Fallback ke refresh percakapan');
        fetchConversations();
        return null;
      }
    } catch (error) {
      console.error('[MiniChat] Error saat mengambil detail percakapan:', error);
      // Fallback ke refresh list
      console.log('[MiniChat] Fallback ke refresh percakapan setelah error');
      fetchConversations();
      return null;
    }
  }, [fetchConversations, shops]);
  
  // Mendengarkan event SSE untuk pesan baru
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'new_message' && lastMessage.for_chat_context) {
      const messageData = lastMessage.for_chat_context;
      const messageId = messageData.message_id;
      
      // Gunakan processedMessagesRef untuk melacak pesan yang sudah diproses
      if (processedMessagesRef.current.has(messageId)) {
        console.log(`[MiniChat] Pesan ${messageId} sudah diproses sebelumnya, diabaikan`);
        return;
      }
      
      // Tandai pesan sebagai sudah diproses
      processedMessagesRef.current.add(messageId);
      
      console.log('[MiniChat] Menerima event SSE baru:', {
        type: lastMessage.type,
        conversationId: messageData.conversation_id,
        senderId: messageData.from_id,
        content: messageData.content.text || '[non-text content]'
      });
      
      // Dispatch the message received action
      dispatch(chatActions.messageReceived(messageData));
      
      // Cek jika conversation sudah ada, jika tidak, ambil dari API
      const conversationExists = state.conversations.some(
        conv => conv.conversation_id === messageData.conversation_id
      );
      
      if (!conversationExists) {
        fetchOneConversation(messageData.conversation_id, messageData.shop_id)
          .catch(error => console.error('[MiniChat] Error saat menangani pesan baru:', error));
      }
    }
  }, [lastMessage, state.conversations, fetchOneConversation]);
  
  // Ambil daftar percakapan ketika user login berhasil (userId tersedia dan loading selesai)
  useEffect(() => {
    if (userId && !isUserLoading) {
      console.log('[MiniChat]: User terdeteksi sudah login, mengambil daftar percakapan');
      fetchConversations();
    } else if (!userId && !isUserLoading) {
      console.log('[MiniChat]: User tidak login, reset state percakapan');
      dispatch(chatActions.fetchConversationsSucceeded([]));
    }
  }, [userId, isUserLoading, fetchConversations]);
  
  // Fungsi untuk update conversation list
  const updateConversationList = useCallback((update: ConversationUpdate) => {
    console.log('[MiniChat] updateConversationList dipanggil dengan:', update);
    
    switch (update.type) {
      case 'mark_as_read':
        console.log(`[MiniChat] Menandai percakapan ${update.conversation_id} sebagai dibaca`);
        dispatch(chatActions.markAsRead(update.conversation_id));
        break;
        
      case 'refresh':
        console.log('[MiniChat] Melakukan refresh seluruh daftar percakapan');
        fetchConversations();
        break;
    }
  }, [fetchConversations]);
  
  // Fungsi untuk send message
  const sendMessage = useCallback(async (conversationId: string, message: string, onSuccess?: (messageId: string) => void) => {
    const conversation = state.conversations.find(conv => conv.conversation_id === conversationId);
    if (!conversation) {
      console.error(`[MiniChat] Gagal mengirim pesan: Conversation dengan ID ${conversationId} tidak ditemukan`);
      throw new Error('Conversation not found');
    }
    
    console.log(`[MiniChat] Mengirim pesan ke ${conversation.to_name} (ID: ${conversation.to_id}) dari toko ${conversation.shop_name}:`);
    console.log(`[MiniChat] Konten pesan: ${message.length > 50 ? message.substring(0, 50) + '...' : message}`);
    
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
        console.error(`[MiniChat] Error saat mengirim pesan:`, response.status, response.statusText);
        throw new Error('Gagal mengirim pesan');
      }
      
      const data = await response.json();
      console.log(`[MiniChat] Pesan berhasil dikirim:`, {
        messageId: data.data?.message_id,
        conversationId: conversationId,
        status: 'success'
      });
      
      // Jika pengiriman berhasil, update conversation dengan pesan baru
      if (data.success && data.data) {
        const responseData = data.data;
        
        console.log(`[MiniChat] Memperbarui conversation_list dengan pesan terkirim`);
        
        // Update conversation dengan pesan yang dikirim menggunakan action
        dispatch(chatActions.conversationUpdated(conversationId, {
          latest_message_content: { text: message },
          latest_message_from_id: conversation.shop_id, // pesan dari toko
          latest_message_id: responseData.message_id,
          last_message_timestamp: responseData.created_timestamp || Date.now(),
          latest_message_type: 'text'
        }));
      }
      
      // Mark as read after sending message
      dispatch(chatActions.markAsRead(conversationId));
      
      // Call success callback if provided
      if (onSuccess && data.data && data.data.message_id) {
        onSuccess(data.data.message_id);
      }
      
      return data;
    } catch (error) {
      console.error('[MiniChat] Error mengirim pesan:', error);
      throw error;
    }
  }, [state.conversations]);
  
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
  
  // Fungsi untuk membuka chat
  const openChat = useCallback((chat: ChatInfo) => {
    dispatch(chatActions.openChat(chat));
  }, []);
  
  // Fungsi untuk menutup chat
  const closeChat = useCallback((conversationId: string) => {
    dispatch(chatActions.closeChat(conversationId));
  }, []);
  
  // Fungsi untuk meminimalkan chat
  const minimizeChat = useCallback((minimize: boolean) => {
    dispatch(chatActions.minimizeChat(minimize));
  }, []);
  
  // Fungsi untuk refresh conversations
  const refreshConversations = useCallback(async () => {
    await fetchConversations();
  }, [fetchConversations]);
  
  // Fungsi untuk set search query
  const setSearchQuery = useCallback((query: string) => {
    dispatch(chatActions.setSearchQuery(query));
  }, []);
  
  // Fungsi untuk set shop filter
  const setShopFilter = useCallback((shops: number[]) => {
    dispatch(chatActions.setShopFilter(shops));
  }, []);
  
  // Fungsi untuk set status filter
  const setStatusFilter = useCallback((status: 'SEMUA' | 'BELUM DIBACA' | 'BELUM DIBALAS') => {
    dispatch(chatActions.setStatusFilter(status));
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
  
  // Provide context value
  const contextValue = {
    state,
    openChat,
    closeChat,
    minimizeChat,
    sendMessage,
    refreshConversations,
    totalUnread: state.totalUnread,
    markMessageAsRead,
    setSearchQuery,
    setShopFilter,
    setStatusFilter,
    updateConversationList,
    filteredConversations,
    uniqueShops,
    initializeConversation
  };
  
  return (
    <MiniChatContext.Provider value={contextValue}>
      {children}
    </MiniChatContext.Provider>
  );
};

// Hook untuk menggunakan context
export const useMiniChat = () => {
  const context = useContext(MiniChatContext);
  if (context === undefined) {
    throw new Error('useMiniChat must be used within a MiniChatProvider');
  }
  return context;
}; 