'use client'
import React, { useEffect, useRef, useState, useCallback } from 'react';
import MiniChat from './MiniChat';
import { AnimatePresence, motion } from 'framer-motion';
import useStoreChat from '@/stores/useStoreChat';

interface ChatWindow {
  conversationId?: string;
  shopId: number;
  toId: number;
  toName: string;
  toAvatar: string;
  shopName: string;
  metadata?: {
    orderId?: string;
    productId?: string;
    orderStatus?: string;
    source?: string;
    timestamp?: string;
  };
}

// Error Boundary Component
class ChatErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[MiniChatContainer] Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed bottom-4 right-4 bg-red-50 dark:bg-red-900/50 p-4 rounded-lg shadow-lg">
          <p className="text-sm text-red-600 dark:text-red-400">
            Terjadi kesalahan saat memuat chat. Silakan refresh halaman.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

const MiniChatContainer = React.memo(() => {
  // Local UI State
  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeChats, setActiveChats] = useState<ChatWindow[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const { conversations, initializeConversation } = useStoreChat();
  
  // Method untuk membuka chat window baru
  const openChat = useCallback(async (chat: ChatWindow) => {
    console.log('[MiniChatContainer] Menerima request openChat:', chat);
    
    try {
      let updatedChat = { ...chat };  // Buat copy baru dari chat

      // Jika tidak ada conversationId, inisialisasi dulu
      if (!updatedChat.conversationId && updatedChat.metadata?.orderId) {
        setIsInitializing(true);
        console.log('[MiniChatContainer] Menginisialisasi chat baru:', {
          userId: updatedChat.toId,
          shopId: updatedChat.shopId,
          orderSn: updatedChat.metadata.orderId
        });

        const newConversationId = await initializeConversation({
          userId: updatedChat.toId.toString(),
          shopId: updatedChat.shopId.toString(),
          orderSn: updatedChat.metadata.orderId
        });

        if (newConversationId) {
          console.log('[MiniChatContainer] Berhasil mendapatkan conversationId:', newConversationId);
          updatedChat = {
            ...updatedChat,
            conversationId: newConversationId
          };
        }
      }

      setActiveChats(prev => {
        // Cek apakah chat dengan kombinasi toId dan shopId yang sama sudah ada
        const existingChatIndex = prev.findIndex(
          existing => existing.toId === updatedChat.toId && existing.shopId === updatedChat.shopId
        );

        if (existingChatIndex !== -1) {
          console.log('[MiniChatContainer] Update chat yang sudah ada di index:', existingChatIndex);
          // Jika sudah ada, update data chat tersebut
          const updatedChats = [...prev];
          updatedChats[existingChatIndex] = {
            ...updatedChats[existingChatIndex],
            ...updatedChat
          };
          return updatedChats;
        }

        console.log('[MiniChatContainer] Menambahkan chat baru ke daftar');
        // Jika belum ada, tambahkan chat baru
        // Batasi jumlah chat aktif (misal maksimal 3)
        const maxChats = 3;
        if (prev.length >= maxChats) {
          console.log('[MiniChatContainer] Mencapai batas maksimal chat, menghapus yang paling lama');
          return [...prev.slice(1), updatedChat];
        }
        return [...prev, updatedChat];
      });

      // Buka chat window jika sedang tertutup
      console.log('[MiniChatContainer] Membuka window chat');
      setIsOpen(true);
      setIsMinimized(false);
    } catch (error) {
      console.error('[MiniChatContainer] Error saat membuka chat:', error);
    } finally {
      setIsInitializing(false);
    }
  }, [initializeConversation]);

  // Listen untuk event openChat
  useEffect(() => {
    const handleOpenChat = (e: CustomEvent<ChatWindow>) => {
      console.log('[MiniChatContainer] Menerima event openChat:', e.detail);
      openChat(e.detail);
    };

    window.addEventListener('openChat', handleOpenChat as EventListener);
    return () => window.removeEventListener('openChat', handleOpenChat as EventListener);
  }, [openChat]);

  // Method untuk menutup chat window
  const closeChat = (conversationId: string) => {
    setActiveChats(prev => prev.filter(chat => chat.conversationId !== conversationId));
  };

  // Method untuk minimize/maximize semua chat window
  const minimizeChat = (minimize: boolean) => {
    setIsMinimized(minimize);
  };
  
  // Improved resize handler with debounce
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const isMobileView = window.innerWidth < 768;
        if (isMobileView !== isMobile) {
          setIsMobile(isMobileView);
          
          // Jika beralih ke mobile, minimize semua chat
          if (isMobileView) {
            setIsMinimized(true);
          }
        }
      }, 100); // 100ms debounce
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, [isMobile]);
  
  useEffect(() => {
    if (activeChats.length > 0 && containerRef.current) {
      if (!isElementInViewport(containerRef.current)) {
        containerRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'end' 
        });
      }
    }
  }, [activeChats.length]);
  
  const isElementInViewport = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  };

  // Callback ketika conversation berhasil diinisialisasi
  const handleConversationInitialized = (chatInfo: ChatWindow, newConversationId: string) => {
    setActiveChats(prev => prev.map(chat => 
      chat.toId === chatInfo.toId && chat.shopId === chatInfo.shopId
        ? { ...chat, conversationId: newConversationId }
        : chat
    ));
  };
  
  if (!isOpen || activeChats.length === 0) {
    return null;
  }
  
  return (
    <ChatErrorBoundary>
      <div 
        ref={containerRef}
        className="fixed bottom-4 left-4 sm:left-auto sm:right-8 flex flex-row-reverse gap-4 z-50"
      >
        <AnimatePresence>
          {activeChats.map(chat => (
            <motion.div
              key={chat.conversationId || `${chat.toId}-${chat.shopId}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              <MiniChat
                {...chat}
                metadata={chat.metadata}
                isMinimized={isMinimized}
                onClose={() => closeChat(chat.conversationId!)}
                onMinimize={() => minimizeChat(!isMinimized)}
                position={isMobile ? 0 : activeChats.indexOf(chat)}
                onConversationInitialized={(newConversationId) => 
                  handleConversationInitialized(chat, newConversationId)
                }
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ChatErrorBoundary>
  );
});

MiniChatContainer.displayName = 'MiniChatContainer';

export default MiniChatContainer; 