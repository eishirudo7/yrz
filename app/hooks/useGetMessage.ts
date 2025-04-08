import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { UIMessage, ShopeeMessage, convertToUIMessage } from '@/types/shopeeMessage';

export function useConversationMessages(conversationId: string | null, shopId: number) {
  const [messages, setMessagesState] = useState<UIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextOffset, setNextOffset] = useState<string | null>(null);

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

  useEffect(() => {
    if (!conversationId) return;

    const handleSSEMessage = (event: CustomEvent) => {
      const data = event.detail;
      console.log('SSE Message received:', data);
      
      if (data.type === 'new_message' && data.conversation_id === conversationId) {
        console.log('New message for current conversation:', data);
        
        const newMessage: UIMessage = {
          id: data.message_id,
          sender: 'buyer',
          type: data.message_type,
          content: ['text', 'image_with_text'].includes(data.message_type) ? data.content.text || '' : '',
          imageUrl: ['image', 'image_with_text'].includes(data.message_type) ? data.content.image_url : undefined,
          imageThumb: ['image', 'image_with_text'].includes(data.message_type) ? {
            url: data.content.thumb_url || data.content.image_url || '',
            height: data.content.thumb_height || 0,
            width: data.content.thumb_width || 0
          } : undefined,
          orderData: data.message_type === 'order' ? {
            shopId: data.content.shop_id || 0,
            orderSn: data.content.order_sn || ''
          } : undefined,
          sourceContent: data.source_content || {},
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessagesState(prevMessages => {
          console.log('Updating messages with new message:', newMessage);
          return [...prevMessages, newMessage];
        });
      }
    };

    console.log('Setting up SSE listener for conversation:', conversationId);
    window.addEventListener('sse-message', handleSSEMessage as EventListener);

    return () => {
      console.log('Cleaning up SSE listener for conversation:', conversationId);
      window.removeEventListener('sse-message', handleSSEMessage as EventListener);
    };
  }, [conversationId, shopId]);

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
