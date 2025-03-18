'use client'
import React, { useEffect, useRef } from 'react';
import { useMiniChat } from '@/contexts/MiniChatContext';
import MiniChat from './MiniChat';
import { AnimatePresence, motion } from 'framer-motion';

const MiniChatContainer = React.memo(() => {
  const { state, closeChat, minimizeChat } = useMiniChat();
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (state.activeChats.length > 0 && containerRef.current) {
      if (!isElementInViewport(containerRef.current)) {
        containerRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'end' 
        });
      }
    }
  }, [state.activeChats.length]);
  
  const isElementInViewport = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  };
  
  if (!state.isOpen || state.activeChats.length === 0) {
    return null;
  }
  
  return (
    <div 
      ref={containerRef}
      className="fixed bottom-4 left-4 sm:left-auto sm:right-8 flex flex-row-reverse gap-4 z-50"
    >
      <AnimatePresence>
        {state.activeChats.map(chat => (
          <motion.div
            key={chat.conversationId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <MiniChat
              conversationId={chat.conversationId}
              shopId={chat.shopId}
              toId={chat.toId}
              toName={chat.toName}
              toAvatar={chat.toAvatar}
              shopName={chat.shopName}
              isMinimized={state.isMinimized}
              metadata={chat.metadata}
              onClose={() => closeChat(chat.conversationId)}
              onMinimize={() => minimizeChat(!state.isMinimized)}
              position={state.isMobile ? 0 : state.activeChats.indexOf(chat)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});

MiniChatContainer.displayName = 'MiniChatContainer';

export default MiniChatContainer; 