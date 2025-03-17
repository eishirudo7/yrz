'use client'
import React from 'react';
import { useMiniChat } from '@/contexts/MiniChatContext';
import MiniChat from './MiniChat';

const MiniChatContainer = React.memo(() => {
  const { state, closeChat, minimizeChat } = useMiniChat();
  
  if (!state.isOpen || state.activeChats.length === 0) {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 left-4 sm:left-auto sm:right-8 flex flex-row-reverse gap-4 z-50">
      {state.activeChats.map(chat => (
        <MiniChat
          key={chat.conversationId}
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
        />
      ))}
    </div>
  );
});

MiniChatContainer.displayName = 'MiniChatContainer';

export default MiniChatContainer; 