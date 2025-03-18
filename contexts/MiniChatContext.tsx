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
      
      // Log semua event SSE untuk debugging
      console.log('[SSE] Event diterima:', data);
      
      if (data.type === 'new_message') {
        console.log('[SSE Chat] Pesan baru diterima:', {
          conversationId: data.conversation_id,
          messageId: data.message_id,
          sender: data.sender,
          messageType: data.message_type,
          content: data.content
        });
        
        // Cek apakah pesan untuk percakapan yang sudah ada
        const existingConversation = state.conversations.find(
          conv => conv.conversation_id === data.conversation_id
        );
        
        if (existingConversation) {
          console.log('[SSE Chat] Percakapan sudah ada, update data:', {
            conversationId: data.conversation_id,
            previousUnreadCount: existingConversation.unread_count,
            updatedUnreadCount: data.shop_id !== existingConversation.shop_id 
              ? (existingConversation.unread_count || 0) + 1 
              : existingConversation.unread_count
          });
          
          // Update percakapan yang sudah ada
          dispatch({ type: 'SET_CONVERSATIONS', payload: state.conversations.map(conv => 
            conv.conversation_id === data.conversation_id
              ? {
                  ...conv,
                  latest_message_content: { text: data.content.text || '' },
                  latest_message_from_id: data.sender,
                  last_message_timestamp: data.timestamp * 1000000,
                  unread_count: data.shop_id !== conv.shop_id 
                    ? (conv.unread_count || 0) + 1 
                    : conv.unread_count
                }
              : conv
          ) });
        } else {
          console.log('[SSE Chat] ⚠️ Percakapan belum ada dalam daftar:', {
            conversationId: data.conversation_id,
            hasRequiredData: !!(data.sender && data.sender_name),
            sender: data.sender,
            senderName: data.sender_name,
            shopId: data.shop_id
          });
          
          // Ini adalah percakapan baru, buat objek percakapan baru
          // dan tambahkan ke daftar jika data lengkap tersedia
          if (data.sender && data.sender_name) {
            const newConversation = {
              conversation_id: data.conversation_id,
              to_id: data.sender,
              to_name: data.sender_name,
              to_avatar: data.sender_avatar || '',
              shop_id: data.shop_id,
              shop_name: data.shop_name || '',
              latest_message_content: { text: data.content.text || '' },
              latest_message_from_id: data.sender,
              last_message_timestamp: data.timestamp * 1000000,
              unread_count: 1
            } as Conversation; // Gunakan type assertion untuk menghindari error TypeScript
            
            console.log('[SSE Chat] ✅ Menambahkan percakapan baru ke daftar:', newConversation);
            
            // Tambahkan ke daftar percakapan
            dispatch({ type: 'SET_CONVERSATIONS', payload: [newConversation, ...state.conversations] });
          } else {
            console.log('[SSE Chat] ❌ Data tidak lengkap untuk percakapan baru, memanggil API refresh');
            // Data tidak lengkap, refresh daftar dari API
            dispatch({ type: 'SET_LOADING', payload: true });
            fetchConversations();
          }
        }
      }
    };

    console.log('[SSE] Menambahkan event listener');
    window.addEventListener('sse-message', handleSSEMessage as EventListener);
    
    return () => {
      console.log('[SSE] Menghapus event listener');
      window.removeEventListener('sse-message', handleSSEMessage as EventListener);
    };
  }, [state.conversations, dispatch]);

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
    console.log('[API] Memulai fetchConversations');
    
    try {
      const response = await fetch('/api/msg/get_conversation_list');
      
      if (!response.ok) {
        console.error('[API] Error fetchConversations:', response.status, response.statusText);
        throw new Error('Failed to fetch conversations');
      }
      
      const data = await response.json();
      
      if (data.response && Array.isArray(data.response.conversations)) {
        console.log('[API] fetchConversations berhasil:', {
          totalConversations: data.response.conversations.length,
          firstConversation: data.response.conversations[0]
        });
        
        dispatch({ type: 'SET_CONVERSATIONS', payload: data.response.conversations });
      } else {
        console.error('[API] Format respons tidak sesuai:', data);
      }
    } catch (error) {
      console.error('[API] Error fetchConversations:', error);
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