'use client'
import React, { createContext, useContext, useReducer, useCallback, useEffect, useState } from 'react';

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
  | { type: 'SET_LOADING'; payload: boolean };

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
          console.warn('Tidak dapat menemukan conversationId yang cocok');
          return state; // Jangan buka chat jika tidak ada conversationId
        }
      } else {
        // Jika conversationId disediakan, cari dalam daftar percakapan untuk mendapatkan avatar
        const matchingConversation = state.conversations.find(
          conv => conv.conversation_id === conversationId
        );
        
        if (matchingConversation && matchingConversation.to_avatar) {
          finalAvatar = matchingConversation.to_avatar;
        }
      }
      
      // Cek apakah chat sudah ada
      const existingChatIndex = state.activeChats.findIndex(
        chat => chat.conversationId === conversationId
      );
      
      if (existingChatIndex >= 0) {
        // Update chat yang sudah ada dengan data terbaru
        const updatedChats = [...state.activeChats];
        updatedChats[existingChatIndex] = {
          ...updatedChats[existingChatIndex],
          toId,
          toName,
          toAvatar: finalAvatar,
          shopId,
          shopName,
          // Gabungkan metadata jika ada
          metadata: {
            ...updatedChats[existingChatIndex].metadata,
            ...metadata
          }
        };
        
        return {
          ...state,
          isOpen: true,
          isMinimized: false,
          activeChats: updatedChats
        };
      }
      
      // Tambahkan chat baru
      return {
        ...state,
        isOpen: true,
        isMinimized: false,
        activeChats: [...state.activeChats, {
          conversationId,
          toId,
          toName,
          toAvatar: finalAvatar,
          shopId,
          shopName,
          metadata
        }]
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
      
    default:
      return state;
  }
};

// Buat provider
export const MiniChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(miniChatReducer, {
    isOpen: false,
    isMinimized: false,
    activeChats: [],
    conversations: [],
    isLoading: false
  });
  
  // Tambahkan state untuk total unread messages
  const [totalUnread, setTotalUnread] = useState(0);
  
  // Tambahkan useEffect untuk SSE
  useEffect(() => {
    const handleSSEMessage = (event: CustomEvent) => {
      const data = event.detail;
      
      if (data.type === 'new_message') {
        console.log('MiniChatContext: Menerima pesan baru dari SSE', data);
        
        // Update conversations
        dispatch({ type: 'SET_CONVERSATIONS', payload: state.conversations.map(conv => 
          conv.conversation_id === data.conversation_id 
            ? { ...conv, unread_count: 0 } 
            : conv
        ) });
        
        // Update pesan-pesan jika ini untuk percakapan yang aktif
        if (state.activeChats.find(chat => chat.conversationId === data.conversation_id)) {
          const newMessage = {
            id: data.message_id,
            sender: data.shop_id === state.activeChats.find(chat => chat.conversationId === data.conversation_id)?.shopId ? 'seller' as const : 'buyer' as const,
            type: data.message_type,
            content: ['text', 'image_with_text'].includes(data.message_type) 
              ? data.content.text 
              : data.message_type === 'order' 
                ? 'Menampilkan detail pesanan'
                : '',
            imageUrl: data.message_type === 'image' 
              ? data.content.url 
              : data.message_type === 'image_with_text' 
                ? data.content.image_url 
                : undefined,
            imageThumb: ['image', 'image_with_text'].includes(data.message_type) ? {
              url: data.message_type === 'image' 
                ? (data.content.thumb_url || data.content.url)
                : (data.content.thumb_url || data.content.image_url),
              height: data.content.thumb_height,
              width: data.content.thumb_width
            } : undefined,
            orderData: data.message_type === 'order' ? {
              shopId: data.content.shop_id,
              orderSn: data.content.order_sn
            } : undefined,
            time: new Date(data.timestamp * 1000).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })
          };
          
          dispatch({ type: 'SEND_MESSAGE', payload: { conversationId: data.conversation_id, message: JSON.stringify(newMessage) } });
          
          // Jika pesan dari pembeli, tandai sebagai dibaca secara otomatis
          if (data.shop_id !== state.activeChats.find(chat => chat.conversationId === data.conversation_id)?.shopId && !state.isMinimized) {
            markMessageAsRead(data.conversation_id, data.message_id);
          }
        }
      }
    };

    window.addEventListener('sse-message', handleSSEMessage as EventListener);
    
    return () => {
      window.removeEventListener('sse-message', handleSSEMessage as EventListener);
    };
  }, [state.conversations, state.activeChats, state.isMinimized, dispatch]);

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
  
  // Gunakan useCallback untuk fungsi-fungsi
  const openChat = useCallback((chat: ChatInfo) => {
    dispatch({ type: 'OPEN_CHAT', payload: chat });
  }, []);
  
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