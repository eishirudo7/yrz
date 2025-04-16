'use client'
import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import { useMiniChat } from '@/contexts/MiniChatContext';

interface ChatButtonProps {
  shopId: number;
  toId: number;
  toName: string;
  toAvatar?: string; // Opsional, akan diambil dari daftar percakapan jika tersedia
  shopName: string;
  conversationId?: string;
  buttonClassName?: string;
  iconSize?: number;
  iconOnly?: boolean;
  orderId?: string;
  productId?: string;
  orderStatus?: string; // Tambahkan orderStatus
}

// Gunakan React.memo untuk mencegah re-render yang tidak perlu
const ChatButton = React.memo(({
  shopId,
  toId,
  toName,
  toAvatar = '',
  shopName,
  conversationId: initialConversationId,
  buttonClassName = "",
  iconSize = 16,
  iconOnly = false,
  orderId,
  productId,
  orderStatus
}: ChatButtonProps) => {
  const { openChat, state } = useMiniChat();
  const [localLoading, setLocalLoading] = useState(false);
  
  // Cari conversation ID dari state terlebih dahulu
  const findExistingConversationId = useCallback(() => {
    // Cek jika sudah disediakan conversationId
    if (initialConversationId) {
      console.log('[ChatButton] Menggunakan conversationId yang disediakan:', initialConversationId);
      return initialConversationId;
    }
    
    // Cek di daftar percakapan yang sudah ada
    const existingConversation = state.conversations.find(
      conv => conv.to_id === toId && conv.shop_id === shopId
    );
    
    if (existingConversation) {
      console.log('[ChatButton] Menemukan conversationId yang sudah ada:', existingConversation.conversation_id);
      return existingConversation.conversation_id;
    }
    
    console.log('[ChatButton] Tidak menemukan conversationId untuk:', { toId, shopId });
    return undefined;
  }, [initialConversationId, state.conversations, toId, shopId]);
  
  // Gunakan useCallback untuk event handler
  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalLoading(true);
    
    try {
      // Cari conversation ID
      const foundConversationId = findExistingConversationId();
      
      // Pastikan semua data yang diperlukan dikirim ke openChat
      openChat({
        toId,
        toName,
        toAvatar, // Akan diganti dalam context jika ditemukan dari percakapan
        shopId,
        shopName,
        conversationId: foundConversationId,
        metadata: {
          orderId,
          productId,
          orderStatus, // Tambahkan orderStatus
          source: 'chat_button',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('[ChatButton] Error saat membuka chat:', error);
    } finally {
      setLocalLoading(false);
    }
  }, [toId, toName, toAvatar, shopId, shopName, orderId, productId, orderStatus, openChat, findExistingConversationId]);

  // Gunakan style bawaan yang lebih baik
  const defaultButtonClass = "inline-flex items-center justify-center text-gray-600 hover:text-primary transition-colors focus:outline-none";
  const iconButtonClass = `${defaultButtonClass} ${iconOnly ? 'p-0 rounded-full' : 'gap-1.5 px-2 py-1 rounded'}`;
  const finalClassName = buttonClassName || iconButtonClass;

  return (
    <button
      onClick={handleClick}
      className={finalClassName}
      title={`Chat dengan ${toName}`}
      aria-label={`Chat dengan ${toName}`}
      type="button"
      disabled={state.isLoading || localLoading} // Nonaktifkan tombol saat loading
    >
      {(state.isLoading || localLoading) ? (
        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
      ) : (
        <MessageSquare 
          size={iconSize} 
          className="flex-shrink-0" // Mencegah ikon dari mengubah ukuran
          strokeWidth={1.5} // Garis ikon yang lebih tipis
        />
      )}
      {!iconOnly && <span className={`text-sm ${iconSize <= 14 ? 'text-xs' : ''}`}>Chat</span>}
    </button>
  );
});

// Tambahkan displayName untuk debugging
ChatButton.displayName = 'ChatButton';

export default ChatButton; 