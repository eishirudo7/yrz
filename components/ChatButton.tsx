'use client'
import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import useStoreChat from '@/stores/useStoreChat';
import { toast } from 'sonner';

interface ChatButtonProps {
  shopId: number;
  toId: number;
  toName: string;
  toAvatar?: string;
  shopName: string;
  conversationId?: string;
  buttonClassName?: string;
  iconSize?: number;
  iconOnly?: boolean;
  orderId?: string;
  productId?: string;
  orderStatus?: string;
}

interface ChatState {
  conversations: Array<{
    conversation_id: string;
    to_id: number;
    shop_id: number;
  }>;
  isInitialized: boolean;
  isLoading: boolean;
}

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
  const [localLoading, setLocalLoading] = useState(false);
  
  // Gunakan store chat dengan tipe yang benar
  const storeChat = useStoreChat() as unknown as ChatState & {
    refreshConversations: () => Promise<void>;
    fetchMessages: (conversationId: string) => Promise<void>;
    openChat: (chatData: any) => void;
  };
  
  const { conversations, isLoading: storeLoading } = storeChat;
  
  // Gabungkan loading state
  const isLoading = localLoading || storeLoading;
  
  // Cari conversation ID dari state terlebih dahulu
  const findExistingConversationId = useCallback(() => {
    // Cek jika sudah disediakan conversationId
    if (initialConversationId) {
      console.log('[ChatButton] Menggunakan conversationId yang disediakan:', initialConversationId);
      return initialConversationId;
    }
    
    // Cek di daftar percakapan yang sudah ada
    const existingConversation = conversations?.find(
      conv => conv.to_id === toId && conv.shop_id === shopId
    );
    
    if (existingConversation) {
      console.log('[ChatButton] Menemukan conversationId yang sudah ada:', existingConversation.conversation_id);
      return existingConversation.conversation_id;
    }
    
    console.log('[ChatButton] Tidak menemukan conversationId untuk:', { toId, shopId });
    return undefined;
  }, [initialConversationId, conversations, toId, shopId]);
  
  // Gunakan useCallback untuk event handler
  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalLoading(true);
    
    try {
      console.log('[ChatButton] Mulai proses membuka chat:', { toId, shopId });
      
      // Cari conversation ID
      const foundConversationId = findExistingConversationId();
      
      // Data chat yang akan dibuka
      const chatData = {
        conversationId: foundConversationId,
        shopId,
        toId,
        toName,
        toAvatar,
        shopName,
        metadata: {
          orderId,
          productId,
          orderStatus
        }
      };

      console.log('[ChatButton] Data chat yang akan dibuka:', chatData);

      // Emit event untuk membuka chat
      console.log('[ChatButton] Mengirim event openChat dengan data:', chatData);
      const event = new CustomEvent('openChat', { 
        detail: chatData 
      });
      window.dispatchEvent(event);

    } catch (error) {
      console.error('[ChatButton] Error saat membuka chat:', error);
      toast.error('Gagal membuka chat');
    } finally {
      setLocalLoading(false);
    }
  }, [toId, shopId, orderId, findExistingConversationId, toName, toAvatar, shopName, productId, orderStatus]);

  // Validasi props yang required
  if (!shopId || !toId || !toName || !shopName) {
    console.error('[ChatButton] Missing required props:', { shopId, toId, toName, shopName });
    return null;
  }

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
      disabled={isLoading}
    >
      {isLoading ? (
        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
      ) : (
        <MessageSquare 
          size={iconSize} 
          className="flex-shrink-0"
          strokeWidth={1.5}
        />
      )}
      {!iconOnly && <span className={`text-sm ${iconSize <= 14 ? 'text-xs' : ''}`}>Chat</span>}
    </button>
  );
});

ChatButton.displayName = 'ChatButton';

export default ChatButton; 