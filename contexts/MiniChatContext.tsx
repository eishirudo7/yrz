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
  | { type: 'UPDATE_CONVERSATION_WITH_MESSAGE'; payload: {
      conversation_id: string;
      latest_message_content: { text?: string } | null;
      latest_message_from_id: number;
      latest_message_id: string;
      last_message_timestamp: number;
      latest_message_type?: string;
      unread_count_increment: number;
    }};

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
      
      // Log informasi percakapan baru
      console.log(`[MiniChat] Menambahkan percakapan baru ${newConversation.conversation_id}:`, {
        dengan: newConversation.to_name,
        toko: newConversation.shop_name,
        pesan_terakhir: newConversation.latest_message_content?.text || '[non-text content]',
        timestamp: new Date(newConversation.last_message_timestamp / 1000000).toLocaleString()
      });
      
      // Cek apakah percakapan sudah ada (untuk mencegah duplikat)
      const existingConversation = state.conversations.find(
        conv => conv.conversation_id === newConversation.conversation_id
      );
      
      if (existingConversation) {
        console.log(`[MiniChat] Percakapan ${newConversation.conversation_id} sudah ada, melakukan update`);
        
        // Update conversation yang sudah ada
        const filteredConversations = state.conversations.filter(
          conv => conv.conversation_id !== newConversation.conversation_id
        );
        
        // Prioritaskan percakapan yang baru diperbarui di urutan pertama
        // Kemudian urutkan sisanya berdasarkan timestamp
        const finalConversations = [
          newConversation,
          ...filteredConversations.sort((a, b) => b.last_message_timestamp - a.last_message_timestamp)
        ];
        
        console.log(`[MiniChat] Percakapan ${newConversation.conversation_id} dipindahkan ke urutan pertama`);
        
        return {
          ...state,
          conversations: finalConversations
        };
      }
      
      // Tambahkan percakapan baru di urutan pertama
      // Tidak perlu sorting karena kita tahu ini adalah yang terbaru
      const finalConversations = [
        newConversation,
        ...state.conversations.sort((a, b) => b.last_message_timestamp - a.last_message_timestamp)
      ];
      
      console.log(`[MiniChat] Percakapan baru ${newConversation.conversation_id} ditambahkan di urutan pertama`);
      
      return {
        ...state,
        conversations: finalConversations
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
  const { userId, isLoading: isUserLoading, shops } = useUserData();
  
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
    console.log(`[MiniChat] Menghitung ulang total unread: ${total} percakapan belum dibaca`);
    setTotalUnread(total);
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
  
  // Fungsi untuk memperbarui percakapan berdasarkan pesan baru dari webhook
  const updateConversationWithMessage = useCallback(async (data: {
    conversation_id: string;
    message_id: string;
    from_id: number;
    content: { text?: string } | any;
    message_type: string;
    created_timestamp: number;
    shop_id: number;
  }) => {
    console.log(`[MiniChat] Menerima pesan baru untuk conversation_id: ${data.conversation_id}`);
    
    // Tambahkan debouce dengan menggunakan message_id sebagai identifier
    // untuk mencegah pemrosesan pesan yang sama berulang kali
    const messageKey = `processed_${data.conversation_id}_${data.message_id}`;
    if (sessionStorage.getItem(messageKey)) {
      console.log(`[MiniChat] Pesan dengan ID ${data.message_id} sudah diproses sebelumnya, mengabaikan`);
      return;
    }
    
    // Tandai pesan ini sudah diproses
    sessionStorage.setItem(messageKey, Date.now().toString());
    
    // Buat format pesan sesuai dengan struktur conversation
    const messageContent = data.content.text 
      ? { text: data.content.text } 
      : data.content;
      
    // Cek jika conversation sudah ada
    const existingConversation = state.conversations.find(
      conv => conv.conversation_id === data.conversation_id
    );
    
    if (existingConversation) {
      console.log(`[MiniChat] Percakapan dengan ID ${data.conversation_id} ditemukan, melakukan update`);
      
      // Tentukan apakah perlu menambah unread count
      // Tambah unread jika pengirim bukan dari toko kita
      const unreadIncrement = data.from_id !== data.shop_id ? 1 : 0;
      
      dispatch({
        type: 'UPDATE_CONVERSATION_WITH_MESSAGE',
        payload: {
          conversation_id: data.conversation_id,
          latest_message_content: { text: typeof messageContent === 'string' ? messageContent : messageContent.text },
          latest_message_from_id: data.from_id,
          latest_message_id: data.message_id,
          last_message_timestamp: data.created_timestamp,
          latest_message_type: data.message_type,
          unread_count_increment: unreadIncrement
        }
      });
      
      // Jika ada pesan masuk baru dan ada unread, update total unread
      if (unreadIncrement > 0) {
        recalculateTotalUnread();
      }
    } else {
      // Percakapan belum ada, ambil detail dari API
      console.log(`[MiniChat] Percakapan dengan ID ${data.conversation_id} tidak ditemukan, mengambil dari API...`);
      
      try {
        const response = await fetch(
          `/api/msg/get_one_conversation?conversationId=${data.conversation_id}&shopId=${data.shop_id}`
        );
        
        if (response.ok) {
          const conversationData = await response.json();
          console.log(`[MiniChat] Berhasil mendapatkan data percakapan dari API:`, {
            conversationId: data.conversation_id,
            shopId: data.shop_id
          });
          
          // Dapatkan shop_name dari UserDataContext
          const shopInfo = shops.find(shop => shop.shop_id === data.shop_id);
          const shopName = shopInfo ? shopInfo.shop_name : '';
          
          if (!shopInfo) {
            console.warn(`[MiniChat] Shop dengan ID ${data.shop_id} tidak ditemukan di UserDataContext`);
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
              shop_id: data.shop_id,
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
            
            // Tambahkan percakapan baru ke state
            dispatch({
              type: 'ADD_CONVERSATION',
              payload: newConversation
            });
            
            // Recalculate total unread
            recalculateTotalUnread();
          } else {
            console.error('[MiniChat] Format respons get_one_conversation tidak valid:', conversationData);
            console.log('[MiniChat] Fallback ke refresh percakapan');
            fetchConversations();
          }
        } else {
          // Fallback ke metode yang ada jika API gagal
          console.error('[MiniChat] Gagal mengambil detail percakapan, status:', response.status);
          console.log('[MiniChat] Fallback ke refresh percakapan');
          fetchConversations();
        }
      } catch (error) {
        console.error('[MiniChat] Error saat mengambil detail percakapan:', error);
        // Fallback ke refresh list
        console.log('[MiniChat] Fallback ke refresh percakapan setelah error');
        fetchConversations();
      }
    }
  }, [state.conversations, dispatch, recalculateTotalUnread, fetchConversations, shops]);
  
  // Deklarasikan variabel untuk menyimpan ID pesan terakhir yang diproses
  const lastProcessedMessageRef = useRef<string | null>(null);
  
  // Mendengarkan event SSE untuk pesan baru dengan throttling
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'new_message' && lastMessage.for_chat_context) {
      const messageData = lastMessage.for_chat_context;
      const messageId = messageData.message_id;
      
      // Periksa apakah ini adalah pesan yang sama dengan yang terakhir diproses
      if (lastProcessedMessageRef.current === messageId) {
        console.log('[MiniChat] Mengabaikan pesan duplikat:', messageId);
        return;
      }
      
      // Simpan ID pesan yang sedang diproses
      lastProcessedMessageRef.current = messageId;
      
      console.log('[MiniChat] Menerima event SSE baru:', {
        type: lastMessage.type,
        conversationId: messageData.conversation_id,
        senderId: messageData.from_id,
        content: messageData.content.text || '[non-text content]',
        messageId: messageId
      });
      
      // Update conversation dengan pesan baru (sekarang async)
      updateConversationWithMessage(messageData)
        .catch(error => console.error('[MiniChat] Error saat menangani pesan baru:', error));
    }
  }, [lastMessage, updateConversationWithMessage]);
  
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
    console.log('[MiniChat] updateConversationList dipanggil dengan:', update);
    
    switch (update.type) {
      case 'mark_as_read':
        console.log(`[MiniChat] Menandai percakapan ${update.conversation_id} sebagai dibaca`);
        if (update.conversation_id) {
          dispatch({ 
            type: 'UPDATE_CONVERSATION', 
            payload: { type: 'mark_as_read', data: update.conversation_id } 
          });
        }
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