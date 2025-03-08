import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useSSE } from '@/app/services/SSEService';

interface SSEMessageData {
  shop_name: string;
  type: string;
  message_type: string;
  conversation_id: string;
  message_id: string;
  sender: number;
  sender_name: string;
  receiver: number;
  receiver_name: string;
  shop_id: number;
  timestamp: number;
  content: {
    text?: string;
  };
}

interface Conversation {
  conversation_id: string;
  to_id: number;
  to_name: string;
  to_avatar: string;
  shop_id: number;
  shop_name: string;
  latest_message_content: {
    text?: string;
  } | null;
  latest_message_from_id: number;
  latest_message_id: string;
  last_message_timestamp: number;
  unread_count: number;
  pinned: boolean;
  last_read_message_id: string;
  latest_message_type: string;
  last_message_option: number;
  max_general_option_hide_time: string;
  mute: boolean;
}

type ConversationUpdate = 
  | { type: 'new_message'; data: SSEMessageData }
  | { type: 'mark_as_read'; conversation_id: string }
  | { type: 'refresh' };

export const useConversationList = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { lastMessage, isConnected } = useSSE();

  const fetchConversations = useCallback(async () => {
    try {
      const timestamp = new Date().getTime();
      const response = await axios.get(`/api/msg/get_conversation_list?_=${timestamp}`);
      setConversations(response.data);
      setIsLoading(false);
    } catch (err) {
      setError(axios.isAxiosError(err) ? err.message : 'Terjadi kesalahan');
      setIsLoading(false);
    }
  }, []);

  const updateConversationList = useCallback((update: ConversationUpdate) => {
    switch (update.type) {
      case 'new_message': {
        const messageData = update.data;
        setConversations(prevConversations => {
          const updatedConversations = [...prevConversations];
          
          const shop_name = messageData.shop_name;  // Nama toko selalu dari receiver_name

          const existingConversationIndex = updatedConversations.findIndex(
            conv => conv.conversation_id === messageData.conversation_id
          );

          if (existingConversationIndex !== -1) {
            const existingConversation = updatedConversations[existingConversationIndex];
            const updatedConversation: Conversation = {
              ...existingConversation,
              shop_name,
              latest_message_content: {
                text: messageData.content.text
              },
              latest_message_id: messageData.message_id,
              last_read_message_id: messageData.message_id,
              latest_message_from_id: messageData.sender,
              last_message_timestamp: messageData.timestamp * 1000000,
              unread_count: existingConversation.unread_count + 1
            };

            updatedConversations.splice(existingConversationIndex, 1);
            updatedConversations.unshift(updatedConversation);
          } else {
            const newConversation: Conversation = {
              conversation_id: messageData.conversation_id,
              to_id: messageData.sender === messageData.shop_id ? messageData.receiver : messageData.sender,
              to_name: messageData.sender === messageData.shop_id ? messageData.receiver_name : messageData.sender_name,
              to_avatar: "",
              shop_id: messageData.shop_id,
              shop_name,
              latest_message_content: {
                text: messageData.content.text
              },
              latest_message_id: messageData.message_id,
              last_read_message_id: messageData.message_id,
              latest_message_from_id: messageData.sender,
              last_message_timestamp: messageData.timestamp * 1000000,
              unread_count: 1,
              pinned: false,
              latest_message_type: "text",
              last_message_option: 0,
              max_general_option_hide_time: "9223372036854775",
              mute: false
            };
            
            updatedConversations.unshift(newConversation);
          }

          return updatedConversations;
        });
        break;
      }

      case 'mark_as_read': {
        setConversations(prevConversations => {
          return prevConversations.map(conv => {
            if (conv.conversation_id === update.conversation_id) {
              return {
                ...conv,
                unread_count: 0
              };
            }
            return conv;
          });
        });
        break;
      }

      case 'refresh': {
        fetchConversations();
        break;
      }
    }
  }, [fetchConversations]);

  // Mendengarkan pesan dari SSE global
  useEffect(() => {
    if (lastMessage?.type === 'new_message') {
      updateConversationList({ 
        type: 'new_message', 
        data: lastMessage 
      });
    }
  }, [lastMessage, updateConversationList]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return { 
    conversations, 
    isLoading, 
    error,
    isConnected, 
    updateConversationList
  };
};
