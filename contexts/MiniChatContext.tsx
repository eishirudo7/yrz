'use client'
import React, { createContext, useContext, useReducer, useCallback, useEffect, useState, useMemo, useRef } from 'react';
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
  pendingMessages: {[key: string]: any[]};
  userId?: number;
  totalUnread?: number;
  totalUnreadCount?: number;
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
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_USER_ID'; payload: number }
  | { type: 'SET_TOTAL_UNREAD'; payload: number }
  | { type: 'UPDATE_CONVERSATION_WITH_MESSAGE'; payload: {
      conversation_id: string;
      latest_message_content: { text?: string } | null;
      latest_message_from_id: number;
      latest_message_id: string;
      last_message_timestamp: number;
      latest_message_type?: string;
      unread_count_increment: number;
    } }
  | { type: 'PROCESS_NEW_MESSAGE'; payload: SSEMessageData }
  | { type: 'SET_PENDING_MESSAGES'; payload: {[key: string]: any[]} };

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
  updateConversationWithMessage: (data: {
    conversation_id: string;
    message_id: string;
    from_id: number;
    content: { text?: string } | any;
    message_type: string;
    created_timestamp: number;
    shop_id: number;
  }) => void;
} | undefined>(undefined);

// Buat reducer
const miniChatReducer = (state: MiniChatState, action: MiniChatAction): MiniChatState => {
  console.log('Reducer received action:', action);
  
  switch (action.type) {
    case 'SET_USER_ID':
      return {
        ...state,
        userId: action.payload
      };
      
    case 'SET_TOTAL_UNREAD':
      return {
        ...state,
        totalUnread: action.payload
      };
      
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
      
    case 'PROCESS_NEW_MESSAGE': {
      const messageData = action.payload;
      
      // Jika tidak ada ID pesan, abaikan
      if (!messageData.message_id) {
        console.warn('[MiniChat] Pesan tanpa ID diabaikan:', messageData);
        return state;
      }
      
      console.log(`[MiniChat] Memproses pesan baru:`, {
        message_id: messageData.message_id,
        conversation_id: messageData.conversation_id
      });

      // Cari percakapan yang ada
      const existingConversationIndex = state.conversations.findIndex(
        conv => conv.conversation_id === messageData.conversation_id
      );

      // Jika percakapan ditemukan, perbarui dengan pesan baru
      if (existingConversationIndex !== -1) {
        const existingConversation = state.conversations[existingConversationIndex];
        
        // Periksa apakah pesan ini sudah diproses (menghindari duplikat)
        if (existingConversation.latest_message_id === messageData.message_id) {
          console.log(`[MiniChat] Pesan ${messageData.message_id} sudah diproses sebelumnya, abaikan`);
          return state; // Tidak ada perubahan state
        }
        
        // Format konten pesan
        let formattedContent: { text?: string } = {};
        if (messageData.type === 'image') {
          formattedContent = { text: '[Gambar]' };
        } else if (messageData.type === 'file') {
          formattedContent = { text: '[Berkas]' };
        } else if (messageData.content && typeof messageData.content === 'object' && 'text' in messageData.content) {
          formattedContent = { text: messageData.content.text };
        } else if (typeof messageData.content === 'string') {
          formattedContent = { text: messageData.content };
        }
        
        // Tentukan apakah harus menambah unread count
        // Tambah unread hanya jika pengirim bukan pengguna saat ini (sender berbeda dengan id pengguna)
        const shouldIncrementUnread = messageData.sender !== state.userId;
        
        // Buat percakapan yang diperbarui
        const updatedConversation = {
          ...existingConversation,
          latest_message_content: formattedContent,
          latest_message_from_id: messageData.sender,
          latest_message_id: messageData.message_id,
          latest_message_type: messageData.message_type || 'text',
          last_message_timestamp: typeof messageData.timestamp === 'string' 
            ? new Date(messageData.timestamp).getTime() 
            : messageData.timestamp || Date.now(),
          unread_count: shouldIncrementUnread 
            ? (existingConversation.unread_count || 0) + 1 
            : existingConversation.unread_count || 0
        };
        
        // Buat salinan array percakapan dan perbarui item yang ada
        const updatedConversations = [...state.conversations];
        updatedConversations[existingConversationIndex] = updatedConversation;
        
        // Urutkan percakapan berdasarkan timestamp pesan terakhir
        const sortedConversations = updatedConversations.sort((a, b) => {
          // Jika salah satu percakapan dipinned, tempatkan di atas
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          
          // Urutkan berdasarkan timestamp pesan terakhir
          return new Date(b.last_message_timestamp).getTime() - 
                 new Date(a.last_message_timestamp).getTime();
        });
        
        // Hitung total unread
        let totalUnreadCount = 0;
        sortedConversations.forEach(conv => {
          totalUnreadCount += conv.unread_count || 0;
        });
        
        console.log(`[MiniChat] Percakapan diperbarui:`, {
          conversation_id: updatedConversation.conversation_id,
          latest_message_id: updatedConversation.latest_message_id,
          unread_count: updatedConversation.unread_count,
          total_unread: totalUnreadCount
        });
        
        return {
          ...state,
          conversations: sortedConversations,
          totalUnreadCount
        };
      }
      
      // Jika percakapan tidak ditemukan dalam state, return state tanpa perubahan
      // API lookup handler akan menangani percakapan baru
      console.log(`[MiniChat] Percakapan ${messageData.conversation_id} tidak ditemukan dalam state`);
      return state;
    }
    
    case 'UPDATE_CONVERSATION_WITH_MESSAGE': {
      const { 
        conversation_id, 
        latest_message_content, 
        latest_message_from_id, 
        latest_message_id, 
        last_message_timestamp,
        latest_message_type,
        unread_count_increment
      } = action.payload;
      
      // Log informasi pembaruan
      console.log(`[MiniChat] Memperbarui percakapan ${conversation_id}:`, {
        pesan: latest_message_content?.text || '[non-text content]',
        dari_id: latest_message_from_id,
        timestamp: new Date(last_message_timestamp / 1000000).toLocaleString(),
        tipe: latest_message_type,
        unread_increment: unread_count_increment
      });
      
      // Update conversation berdasarkan message baru
      const updatedConversations = state.conversations.map(conv => {
        if (conv.conversation_id === conversation_id) {
          return {
            ...conv,
            latest_message_content,
            latest_message_from_id,
            latest_message_id,
            last_message_timestamp,
            latest_message_type: latest_message_type || conv.latest_message_type,
            unread_count: conv.unread_count + unread_count_increment
          };
        }
        return conv;
      });
      
      // Pertama temukan conversation yang telah diperbarui
      const updatedConversation = updatedConversations.find(conv => conv.conversation_id === conversation_id);
      if (!updatedConversation) {
        // Jika tidak ditemukan, kembalikan daftar yang diurutkan seperti biasa
        const sortedConversations = [...updatedConversations].sort(
          (a, b) => b.last_message_timestamp - a.last_message_timestamp
        );
        
        return {
          ...state,
          conversations: sortedConversations
        };
      }
      
      // Hapus percakapan yang diperbarui dari daftar
      const filteredConversations = updatedConversations.filter(
        conv => conv.conversation_id !== conversation_id
      );
      
      // Tempatkan percakapan yang diperbarui di urutan pertama
      const newSortedConversations = [updatedConversation, ...filteredConversations];
      
      // Urutkan sisanya berdasarkan timestamp
      const finalConversations = [
        updatedConversation,
        ...filteredConversations.sort((a, b) => b.last_message_timestamp - a.last_message_timestamp)
      ];
      
      console.log(`[MiniChat] Percakapan ${conversation_id} dipindahkan ke urutan pertama`);
      
      return {
        ...state,
        conversations: finalConversations
      };
    }
      
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
      
    case 'ADD_CONVERSATION': {
      const newConversation = action.payload;
      
      // Periksa apakah percakapan sudah ada
      const exists = state.conversations.some(
        conv => conv.conversation_id === newConversation.conversation_id
      );
      
      if (exists) {
        console.log(`[MiniChat] Percakapan ${newConversation.conversation_id} sudah ada, tidak perlu menambahkan`);
        return state;
      }
      
      console.log(`[MiniChat] Menambahkan percakapan baru: ${newConversation.conversation_id}`);
      
      // Tambahkan percakapan baru ke daftar
      const updatedConversations = [...state.conversations, newConversation];
      
      // Urutkan percakapan berdasarkan waktu pesan terakhir (terbaru ke terlama)
      const sortedConversations = [...updatedConversations].sort((a, b) => {
        const timeA = a.last_message_timestamp ? new Date(a.last_message_timestamp).getTime() : 0;
        const timeB = b.last_message_timestamp ? new Date(b.last_message_timestamp).getTime() : 0;
        return timeB - timeA;
      });
      
      // Hitung ulang total pesan yang belum dibaca
      const totalUnreadCount = sortedConversations.reduce(
        (sum, conv) => sum + (conv.unread_count || 0),
        0
      );
      
      return {
        ...state,
        conversations: sortedConversations,
        totalUnreadCount
      };
    }

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
      
    case 'SET_PENDING_MESSAGES': {
      return {
        ...state,
        pendingMessages: action.payload
      };
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
    isConnected: false,
    pendingMessages: {},
    totalUnread: 0,
    totalUnreadCount: 0
  });
  
  // Dapatkan status user login dari UserDataContext
  const { userId, isLoading: isUserLoading, shops } = useUserData();
  
  // Set userId ke state
  useEffect(() => {
    if (userId) {
      // Tambahkan userId ke state dengan konversi yang tepat
      dispatch({
        type: 'SET_USER_ID', 
        payload: typeof userId === 'string' ? Number(userId) : userId
      });
    }
  }, [userId]);
  
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
    console.log(`[MiniChat] Menghitung ulang total unread: ${total} percakapan belum dibaca`);
    dispatch({
      type: 'SET_TOTAL_UNREAD',
      payload: total
    });
  };
  
  // Menghitung total unread setiap kali conversations berubah
  useEffect(() => {
    recalculateTotalUnread();
  }, [state.conversations]);
  
  // Fungsi untuk mengambil daftar percakapan
  const fetchConversations = useCallback(async () => {
    try {
      console.log('[MiniChat] Mengambil daftar percakapan dari server...');
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/msg/get_conversation_list?_=${timestamp}`);
      
      if (!response.ok) {
        console.error('[MiniChat] Gagal mengambil daftar percakapan:', response.status, response.statusText);
        throw new Error('Gagal mengambil daftar percakapan');
      }
      
      const data = await response.json();
      console.log(`[MiniChat] Berhasil mengambil ${data.length} percakapan`);
      dispatch({ type: 'SET_CONVERSATIONS', payload: data });
      
    } catch (error) {
      console.error('[MiniChat] Error saat mengambil daftar percakapan:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);
  
  // Tambahkan effect untuk mengambil percakapan yang belum ada
  useEffect(() => {
    const loadingConversations = useRef<Record<string, boolean>>({});
    
    // Fungsi untuk menangani percakapan baru
    const handleNewConversation = async (conversationId: string) => {
      // Periksa apakah percakapan sudah ada dalam state
      const conversationExists = state.conversations.some(
        conv => conv.conversation_id === conversationId
      );
      
      // Jika percakapan ada, tidak perlu mengambil dari API
      if (conversationExists) {
        console.log(`[MiniChat] Percakapan ${conversationId} sudah ada, tidak perlu mengambil`);
        return true;
      }
      
      // Periksa apakah percakapan sedang dimuat, untuk menghindari permintaan berulang
      if (loadingConversations.current[conversationId]) {
        console.log(`[MiniChat] Percakapan ${conversationId} sedang dimuat, menunggu...`);
        return false;
      }
      
      // Tandai percakapan sedang dimuat
      loadingConversations.current[conversationId] = true;
      
      try {
        console.log(`[MiniChat] Mengambil data percakapan dari API: ${conversationId}`);
        const response = await fetch(`/api/conversations/${conversationId}`);
        
        if (!response.ok) {
          throw new Error(`Gagal mengambil percakapan: ${response.status}`);
        }
        
        const conversation = await response.json();
        
        if (conversation) {
          // Dispatch aksi untuk menambahkan percakapan baru
          dispatch({ type: 'ADD_CONVERSATION', payload: conversation });
          console.log(`[MiniChat] Berhasil menambahkan percakapan: ${conversationId}`);
          return true;
        } else {
          console.error(`[MiniChat] API mengembalikan percakapan kosong untuk ID: ${conversationId}`);
          return false;
        }
      } catch (error) {
        console.error(`[MiniChat] Gagal mengambil percakapan ${conversationId}:`, error);
        
        // Jika gagal mengambil percakapan individu, coba muat ulang semua percakapan
        try {
          console.log("[MiniChat] Mencoba memuat ulang semua percakapan...");
          const response = await fetch('/api/conversations');
          if (response.ok) {
            const data = await response.json();
            dispatch({ type: 'SET_CONVERSATIONS', payload: data.conversations || [] });
            console.log("[MiniChat] Berhasil memuat ulang semua percakapan");
          }
        } catch (refreshError) {
          console.error("[MiniChat] Gagal memuat ulang percakapan:", refreshError);
        }
        
        return false;
      } finally {
        // Hapus tanda loading
        loadingConversations.current[conversationId] = false;
      }
    };
    
    // Fungsi untuk memproses pesan tertunda
    const processPendingMessages = async () => {
      const pendingConversationIds = Object.keys(state.pendingMessages);
      
      if (pendingConversationIds.length === 0) return;
      
      console.log(`[MiniChat] Memproses pesan tertunda untuk ${pendingConversationIds.length} percakapan`);
      
      for (const conversationId of pendingConversationIds) {
        // Periksa apakah percakapan sudah ada atau perlu diambil
        const conversationLoaded = await handleNewConversation(conversationId);
        
        if (conversationLoaded) {
          // Ambil pesan tertunda untuk percakapan ini
          const messages = state.pendingMessages[conversationId] || [];
          
          // Proses setiap pesan
          for (const message of messages) {
            dispatch({ type: 'PROCESS_NEW_MESSAGE', payload: message });
          }
          
          // Hapus pesan tertunda yang sudah diproses
          const updatedPendingMessages = { ...state.pendingMessages };
          delete updatedPendingMessages[conversationId];
          
          dispatch({
            type: 'SET_PENDING_MESSAGES',
            payload: updatedPendingMessages
          });
          
          console.log(`[MiniChat] Berhasil memproses ${messages.length} pesan tertunda untuk percakapan ${conversationId}`);
        } else {
          console.log(`[MiniChat] Percakapan ${conversationId} belum tersedia, pesan tetap tertunda`);
        }
      }
    };
    
    // Panggil proses pesan tertunda saat ada perubahan pada percakapan atau pesan tertunda
    useEffect(() => {
      processPendingMessages();
    }, [state.conversations, state.pendingMessages]);
    
    // Tangani pesan baru dari SSE
    const handleNewMessage = async (data: any) => {
      if (!data || !data.conversation_id || !data.message_id) {
        console.warn('[MiniChat] Menerima pesan tidak valid:', data);
        return;
      }
      
      console.log(`[MiniChat] Menerima pesan baru:`, {
        message_id: data.message_id, 
        conversation_id: data.conversation_id
      });
      
      // Cek apakah percakapan sudah ada dalam state
      const conversationExists = state.conversations.some(
        conv => conv.conversation_id === data.conversation_id
      );
      
      if (conversationExists) {
        // Jika percakapan sudah ada, proses pesan langsung
        dispatch({ type: 'PROCESS_NEW_MESSAGE', payload: data });
      } else {
        // Jika percakapan belum ada, coba ambil dari API
        const conversationLoaded = await handleNewConversation(data.conversation_id);
        
        if (!conversationLoaded) {
          // Jika belum berhasil memuat percakapan, tambahkan pesan ke antrian tertunda
          console.log(`[MiniChat] Menambahkan pesan ke antrian tertunda untuk percakapan: ${data.conversation_id}`);
          
          const pendingForConversation = state.pendingMessages[data.conversation_id] || [];
          
          dispatch({
            type: 'SET_PENDING_MESSAGES',
            payload: {
              ...state.pendingMessages,
              [data.conversation_id]: [...pendingForConversation, data]
            }
          });
        } else {
          // Jika berhasil memuat percakapan, proses pesan
          dispatch({ type: 'PROCESS_NEW_MESSAGE', payload: data });
        }
      }
    };
    
    // Effect untuk menangani pesan SSE baru
    useEffect(() => {
      if (lastMessage) {
        handleNewMessage(lastMessage);
      }
    }, [lastMessage]);
    
    return () => {
      // Cleanup
      loadingConversations.current = {};
    };
  }, [state.conversations, dispatch, lastMessage]);
  
  // Fungsi untuk update conversation list
  const updateConversationList = useCallback((update: ConversationUpdate) => {
    console.log('[MiniChat] updateConversationList dipanggil dengan:', update);
    
    switch (update.type) {
      case 'mark_as_read':
        console.log(`[MiniChat] Menandai percakapan ${update.conversation_id} sebagai dibaca`);
        dispatch({ 
          type: 'UPDATE_CONVERSATION', 
          payload: { type: 'mark_as_read', data: update.conversation_id } 
        });
        break;
        
      case 'refresh':
        console.log('[MiniChat] Melakukan refresh seluruh daftar percakapan');
        fetchConversations();
        break;
    }
  }, [fetchConversations, dispatch]);
  
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
        
        // Update conversation dengan pesan yang dikirim
        dispatch({
          type: 'UPDATE_CONVERSATION_WITH_MESSAGE',
          payload: {
            conversation_id: conversationId,
            latest_message_content: { text: message },
            latest_message_from_id: conversation.shop_id, // pesan dari toko
            latest_message_id: responseData.message_id,
            last_message_timestamp: responseData.created_timestamp || Date.now(),
            latest_message_type: 'text',
            unread_count_increment: 0 // Tidak menambah unread count untuk pesan sendiri
          }
        });
      }
      
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
      console.error('[MiniChat] Error mengirim pesan:', error);
      throw error;
    }
  }, [state.conversations, updateConversationList, dispatch]);
  
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
  
  // Tambahkan function updateConversationWithMessage
  const updateConversationWithMessage = useCallback((data: {
    conversation_id: string;
    message_id: string;
    from_id: number;
    content: { text?: string } | any;
    message_type: string;
    created_timestamp: number;
    shop_id: number;
  }) => {
    dispatch({
      type: 'UPDATE_CONVERSATION_WITH_MESSAGE',
      payload: {
        conversation_id: data.conversation_id,
        latest_message_content: typeof data.content === 'object' ? data.content : { text: data.content },
        latest_message_from_id: data.from_id,
        latest_message_id: data.message_id,
        last_message_timestamp: data.created_timestamp,
        latest_message_type: data.message_type,
        unread_count_increment: 0 // Default tidak menambah unread count
      }
    });
  }, [dispatch]);
  
  return (
    <MiniChatContext.Provider value={{ 
      state, 
      openChat, 
      closeChat, 
      minimizeChat, 
      sendMessage,
      refreshConversations,
      totalUnread: state.totalUnread || 0, // Pastikan selalu number dengan default 0
      setTotalUnread: (value: React.SetStateAction<number>) => {
        // Handle both direct value and function updater
        const newValue = typeof value === 'function' 
          ? value(state.totalUnread || 0) 
          : value;
        dispatch({ type: 'SET_TOTAL_UNREAD', payload: newValue });
      },
      markMessageAsRead,
      setSearchQuery,
      setShopFilter,
      setStatusFilter,
      updateConversationList,
      filteredConversations,
      uniqueShops,
      initializeConversation,
      updateConversationWithMessage
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