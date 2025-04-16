import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { UIMessage, ShopeeMessage, convertToUIMessage } from '@/types/shopeeMessage';
import { useMiniChat } from '@/contexts/MiniChatContext';

export function useConversationMessages(conversationId: string | null, shopId: number) {
  const [messages, setMessagesState] = useState<UIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextOffset, setNextOffset] = useState<string | null>(null);
  
  // Ambil state dari MiniChatContext
  const { state } = useMiniChat();
  
  // Gunakan ref untuk menyimpan ID pesan yang sudah diproses
  const processedMessagesRef = useRef(new Set<string>());

  const setMessages = useCallback((updater: (prevMessages: UIMessage[]) => UIMessage[]) => {
    setMessagesState(updater);
  }, []);

  const processApiMessages = (apiMessages: any[], shopId: number): UIMessage[] => {
    return apiMessages.map(msg => {
      const shopeeMsg: ShopeeMessage = {
        message_id: msg.message_id,
        from_id: msg.from_id,
        to_id: msg.to_id,
        from_shop_id: msg.from_shop_id,
        to_shop_id: msg.to_shop_id,
        message_type: msg.message_type,
        content: msg.content,
        conversation_id: msg.conversation_id,
        created_timestamp: msg.created_timestamp,
        region: msg.region,
        status: msg.status,
        message_option: msg.message_option,
        source: msg.source,
        source_content: msg.source_content,
        quoted_msg: msg.quoted_msg
      };
      
      return convertToUIMessage(shopeeMsg, shopId);
    });
  };

  const fetchMessages = useCallback(async (offset?: string) => {
    if (!conversationId) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get(`/api/msg/get_message?_=${Date.now()}`, {
        params: {
          conversationId,
          shopId,
          pageSize: 25,
          offset
        }
      });

      if (!response.data.response.messages || response.data.response.messages.length === 0) {
        setNextOffset(null);
        return;
      }

      const processedMessages = processApiMessages(response.data.response.messages, shopId);
      
      if (offset) {
        setMessagesState(prevMessages => [...processedMessages.reverse(), ...prevMessages]);
      } else {
        setMessagesState(processedMessages.reverse());
      }
      
      setNextOffset(response.data.response.page_result.next_offset === "0" ? null : response.data.response.page_result.next_offset);
    } catch (err) {
      setError(offset ? 'Gagal memuat pesan tambahan' : 'Gagal mengambil pesan');
      console.error('Error fetching messages:', err);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, shopId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Pantau perubahan lastMessage dari SSEService melalui MiniChatContext
  useEffect(() => {
    if (!conversationId) return;
    
    // Ambil lastMessage dari state MiniChatContext
    const lastMessage = state.lastMessage;
    
    if (lastMessage && 
        lastMessage.type === 'new_message' && 
        lastMessage.conversation_id === conversationId) {
      
      const messageId = lastMessage.message_id;
      
      // Periksa apakah pesan sudah diproses sebelumnya
      if (processedMessagesRef.current.has(messageId)) {
        console.log('Pesan sudah diproses dalam useGetMessage, diabaikan:', messageId);
        return;
      }
      
      console.log('Menambahkan pesan baru dari MiniChatContext:', lastMessage);
      
      // Tambahkan ke daftar pesan yang sudah diproses
      processedMessagesRef.current.add(messageId);
      
      const newMessage: UIMessage = {
        id: messageId,
        sender: lastMessage.from_id === shopId ? 'seller' : 'buyer',
        type: lastMessage.message_type as 'text' | 'image' | 'image_with_text' | 'order' | 'sticker',
        content: ['text', 'image_with_text'].includes(lastMessage.message_type) ? lastMessage.content.text || '' : '',
        imageUrl: ['image', 'image_with_text'].includes(lastMessage.message_type) ? lastMessage.content.image_url : undefined,
        imageThumb: ['image', 'image_with_text'].includes(lastMessage.message_type) ? {
          url: lastMessage.content.thumb_url || lastMessage.content.image_url || '',
          height: lastMessage.content.thumb_height || 0,
          width: lastMessage.content.thumb_width || 0
        } : undefined,
        orderData: lastMessage.message_type === 'order' ? {
          shopId: lastMessage.content.shop_id || 0,
          orderSn: lastMessage.content.order_sn || ''
        } : undefined,
        sourceContent: lastMessage.source_content || {},
        time: new Date(lastMessage.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessagesState(prevMessages => {
        return [...prevMessages, newMessage];
      });
    }
  }, [conversationId, shopId, state.lastMessage]);

  const loadMoreMessages = useCallback(() => {
    if (nextOffset) {
      fetchMessages(nextOffset);
    }
  }, [fetchMessages, nextOffset]);

  const addNewMessage = (newMessage: UIMessage) => {
    setMessages(prevMessages => [...prevMessages, newMessage]);
  };

  return {
    messages,
    setMessages,
    isLoading,
    error,
    loadMoreMessages,
    hasMoreMessages: !!nextOffset,
    addNewMessage
  };
}
