'use client'
import React, { createContext, useContext, useReducer, useCallback, useEffect, useState } from 'react';
import { JSONStringify } from 'json-with-bigint';
// Definisikan tipe untuk data percakapan dari API
interface Conversation {
  conversation_id: string;
  to_id: number;
  to_name: string;
  to_avatar: string;
  shop_id: number;
  shop_name: string;
  last_message_timestamp: number;
  unread_count: number;
}

// Definisikan tipe metadata
interface ChatMetadata {
  orderId?: string;
  productId?: string;
  source?: string;
  timestamp?: string;
  orderStatus?: string;
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

// Definisikan tipe action
type MiniChatAction =
  | { type: 'OPEN_CHAT'; payload: ChatInfo }
  | { type: 'CLOSE_CHAT'; payload: { conversationId: string } }
  | { type: 'MINIMIZE_CHAT'; payload: { minimize: boolean } }
  | { type: 'SEND_MESSAGE'; payload: { conversationId: string; message: string } }
  | { type: 'SET_CONVERSATIONS'; payload: Conversation[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'ADD_CONVERSATION'; payload: Conversation }
  | { type: 'SET_MOBILE'; payload: boolean };

// Buat context
const MiniChatContext = createContext<{
  state: MiniChatState;
  openChat: (chat: ChatInfo) => void;
  closeChat: (conversationId: string) => void;
  minimizeChat: (minimize: boolean) => void;
  sendMessage: (conversationId: string, message: string) => void;
  refreshConversations: () => Promise<void>;
  totalUnread: number;
  setTotalUnread: React.Dispatch<React.SetStateAction<number>>;
  markMessageAsRead: (conversationId: string, messageId: string) => Promise<void>;
} | undefined>(undefined);

// Buat reducer
const miniChatReducer = (state: MiniChatState, action: MiniChatAction): MiniChatState => {
  switch (action.type) {
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
    isMobile: false // Default set ke false
  });
  
  // Tambahkan state untuk total unread messages
  const [totalUnread, setTotalUnread] = useState(0);
  
  // Tambahkan useEffect untuk SSE
  useEffect(() => {
    const handleSSEMessage = (event: CustomEvent) => {
      const data = event.detail;
      
      if (data.type === 'new_message') {
        // Periksa apakah conversationId sudah ada dalam daftar
        const conversationExists = state.conversations.some(
          conv => conv.conversation_id === data.conversation_id
        );
        
        if (!conversationExists) {
          console.log('Percakapan baru ditemukan dari SSE:', data.conversation_id);
          
          // Simpan data minimal yang diperlukan
          const newConversation = {
            conversation_id: data.conversation_id,
            to_id: data.sender,
            to_name: data.sender_name || 'Pengguna',
            to_avatar: data.sender_avatar || '',
            shop_id: data.shop_id,
            shop_name: data.shop_name || 'Toko',
            latest_message_content: { text: data.content.text || '' },
            latest_message_from_id: data.sender,
            last_message_timestamp: data.timestamp * 1000000,
            unread_count: 1
          };
          
          // Tambahkan ke daftar percakapan
          dispatch({ type: 'SET_CONVERSATIONS', payload: [newConversation, ...state.conversations] });
        }
      }
    };

    window.addEventListener('sse-message', handleSSEMessage as EventListener);
    
    return () => {
      window.removeEventListener('sse-message', handleSSEMessage as EventListener);
    };
  }, [state.conversations]);

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
      
      await fetch('/api/msg/mark_as_read', {
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
      
      // Update conversations setelah berhasil menandai pesan dibaca
      dispatch({ type: 'SET_CONVERSATIONS', payload: state.conversations.map(conv => 
        conv.conversation_id === conversationId 
          ? { ...conv, unread_count: 0 } 
          : conv
      ) });
      
      // Update total unread
      setTotalUnread(prev => prev + 1);
    } catch (error) {
      console.error('Gagal menandai pesan sebagai dibaca:', error);
    }
  };

  // Fungsi untuk menghitung ulang total pesan yang belum dibaca
  const recalculateTotalUnread = () => {
    const total = state.conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
    setTotalUnread(total);
  };
  
  // Fungsi untuk mengambil daftar percakapan
  const fetchConversations = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const response = await fetch('/api/msg/get_conversation_list');
      
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
  
  // Ambil daftar percakapan saat komponen dimuat
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);
  
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
              unread_count: 0
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
  
  const sendMessage = useCallback((conversationId: string, message: string) => {
    dispatch({ type: 'SEND_MESSAGE', payload: { conversationId, message } });
  }, []);
  
  const refreshConversations = useCallback(async () => {
    await fetchConversations();
  }, [fetchConversations]);
  
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