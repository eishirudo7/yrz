import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

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
  | { type: 'mark_as_read'; conversation_id: string }
  | { type: 'refresh' };

export const useConversationList = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return { 
    conversations, 
    isLoading, 
    error,
    updateConversationList
  };
};
