// chatReducer.ts
// Reducer untuk ChatState

import { ChatState, initialChatState } from './chatState';
import { 
  ChatAction, 
  MessageReceivedAction,
  ConversationAddedAction,
  ConversationUpdatedAction,
  MarkAsReadAction,
  ConnectionStatusChangedAction,
  FetchConversationsSucceededAction,
  FetchConversationsFailedAction,
  SetMobileAction,
  SetSearchQueryAction,
  SetShopFilterAction,
  SetStatusFilterAction,
  OpenChatAction,
  CloseChatAction,
  MinimizeChatAction
} from './chatActions';
import { Conversation } from './MiniChatContext';

// Fungsi untuk menangani batas maksimum chat aktif (6)
function handleMaxChatsLimit(chats: ChatState['activeChats'], isMobile: boolean) {
  if (isMobile) {
    // Untuk mobile, hanya izinkan 1 chat
    return chats.slice(-1); // Ambil hanya chat terbaru
  } else {
    // Untuk desktop, batasi hingga 6 chat
    if (chats.length > 6) {
      return chats.slice(1); // Hapus chat tertua
    }
    return chats;
  }
}

export const chatReducer = (state: ChatState = initialChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case 'MESSAGE_RECEIVED': {
      const { payload } = action as MessageReceivedAction;
      const message = payload;
      
      // Cek apakah pesan sudah diproses sebelumnya
      if (state.processedMessageIds.has(message.message_id)) {
        console.log(`[MiniChat] Pesan ${message.message_id} sudah diproses sebelumnya, diabaikan`);
        return state;
      }
      
      // Cek jika pesan terlalu dekat dengan pesan sebelumnya (optional debouncing)
      const now = Date.now();
      if (now - state.lastMessageTimestamp < 300) { // 300ms debounce
        console.log(`[MiniChat] Pesan diterima terlalu cepat setelah pesan sebelumnya, debouncing`);
        return state;
      }
      
      // Set baru dengan ID pesan yang sudah diproses
      const newProcessedIds = new Set(state.processedMessageIds);
      newProcessedIds.add(message.message_id);
      
      // Cari percakapan yang terkait dengan pesan
      const conversationId = message.conversation_id;
      const existingConversationIndex = state.conversations.findIndex(
        conv => conv.conversation_id === conversationId
      );
      
      // Jika percakapan tidak ditemukan, kita akan menanganinya dalam side effect
      // dan akan dispatch CONVERSATION_ADDED action setelah mengambil data
      if (existingConversationIndex === -1) {
        return {
          ...state,
          processedMessageIds: newProcessedIds,
          lastMessageTimestamp: now
        };
      }
      
      // Buat salinan array conversations untuk dimodifikasi
      let newConversations = [...state.conversations];
      
      // Update percakapan yang ada
      const existingConversation = state.conversations[existingConversationIndex];
      const updatedConversation = {
        ...existingConversation,
        latest_message_content: { 
          text: typeof message.content === 'object' && message.content.text 
            ? message.content.text 
            : typeof message.content === 'string' 
              ? message.content 
              : '[non-text content]'
        },
        latest_message_from_id: message.from_id,
        latest_message_id: message.message_id,
        last_message_timestamp: message.created_timestamp,
        latest_message_type: message.message_type,
        unread_count: message.from_id !== message.shop_id 
          ? existingConversation.unread_count + 1 
          : existingConversation.unread_count
      };
      
      // Hapus percakapan dari posisi saat ini
      newConversations.splice(existingConversationIndex, 1);
      // Tambahkan di awal array (posisi pertama)
      newConversations.unshift(updatedConversation);
      
      // Hitung total unread yang baru
      const newTotalUnread = newConversations.filter((conv: Conversation) => conv.unread_count > 0).length;
      
      console.log(`[MiniChat] Memperbarui percakapan ${conversationId} dengan pesan baru`);
      
      return {
        ...state,
        conversations: newConversations,
        processedMessageIds: newProcessedIds,
        lastMessageTimestamp: now,
        totalUnread: newTotalUnread
      };
    }
    
    case 'CONVERSATION_ADDED': {
      const { payload } = action as ConversationAddedAction;
      const newConversation = payload;
      
      // Cek jika percakapan sudah ada
      const existingIndex = state.conversations.findIndex(
        conv => conv.conversation_id === newConversation.conversation_id
      );
      
      // Log informasi percakapan baru
      console.log(`[MiniChat] Menambahkan percakapan baru ${newConversation.conversation_id}:`, {
        dengan: newConversation.to_name,
        toko: newConversation.shop_name,
        pesan_terakhir: newConversation.latest_message_content?.text || '[non-text content]',
        timestamp: new Date(newConversation.last_message_timestamp / 1000000).toLocaleString()
      });
      
      if (existingIndex !== -1) {
        console.log(`[MiniChat] Percakapan ${newConversation.conversation_id} sudah ada, melakukan update`);
        
        // Update conversation yang sudah ada
        const filteredConversations = state.conversations.filter(
          conv => conv.conversation_id !== newConversation.conversation_id
        );
        
        // Prioritaskan percakapan yang baru diperbarui di urutan pertama
        // Kemudian urutkan sisanya berdasarkan timestamp
        const finalConversations = [
          newConversation,
          ...filteredConversations.sort((a, b) => b.last_message_timestamp - a.last_message_timestamp)
        ];
        
        // Hitung ulang total unread
        const newTotalUnread = finalConversations.filter((conv: Conversation) => conv.unread_count > 0).length;
        
        console.log(`[MiniChat] Percakapan ${newConversation.conversation_id} dipindahkan ke urutan pertama`);
        
        return {
          ...state,
          conversations: finalConversations,
          totalUnread: newTotalUnread
        };
      }
      
      // Tambahkan percakapan baru di urutan pertama
      const finalConversations = [
        newConversation,
        ...state.conversations.sort((a, b) => b.last_message_timestamp - a.last_message_timestamp)
      ];
      
      // Hitung ulang total unread
      const newTotalUnread = finalConversations.filter((conv: Conversation) => conv.unread_count > 0).length;
      
      console.log(`[MiniChat] Percakapan baru ${newConversation.conversation_id} ditambahkan di urutan pertama`);
      
      return {
        ...state,
        conversations: finalConversations,
        totalUnread: newTotalUnread
      };
    }
    
    case 'CONVERSATION_UPDATED': {
      const { payload } = action as ConversationUpdatedAction;
      const { id, updates } = payload;
      
      // Temukan percakapan untuk diupdate
      const conversationIndex = state.conversations.findIndex(
        conv => conv.conversation_id === id
      );
      
      if (conversationIndex === -1) {
        console.warn(`[MiniChat] Mencoba memperbarui percakapan yang tidak ada: ${id}`);
        return state;
      }
      
      // Buat salinan array
      const newConversations = [...state.conversations];
      // Update percakapan dengan merge objek
      newConversations[conversationIndex] = {
        ...newConversations[conversationIndex],
        ...updates
      };
      
      // Hitung ulang total unread
      const newTotalUnread = newConversations.filter((conv: Conversation) => conv.unread_count > 0).length;
      
      return {
        ...state,
        conversations: newConversations,
        totalUnread: newTotalUnread
      };
    }
    
    case 'MARK_AS_READ': {
      const { payload } = action as MarkAsReadAction;
      const { conversationId } = payload;
      console.log(`[MiniChat] Menandai percakapan ${conversationId} sebagai dibaca`);
      
      // Temukan percakapan
      const conversationIndex = state.conversations.findIndex(
        conv => conv.conversation_id === conversationId
      );
      
      if (conversationIndex === -1) {
        return state;
      }
      
      // Buat salinan array
      const newConversations = [...state.conversations];
      // Update unread_count menjadi 0
      newConversations[conversationIndex] = {
        ...newConversations[conversationIndex],
        unread_count: 0
      };
      
      // Hitung ulang total unread
      const newTotalUnread = newConversations.filter((conv: Conversation) => conv.unread_count > 0).length;
      
      return {
        ...state,
        conversations: newConversations,
        totalUnread: newTotalUnread
      };
    }
    
    case 'CONNECTION_STATUS_CHANGED': {
      const { payload } = action as ConnectionStatusChangedAction;
      return {
        ...state,
        isConnected: payload
      };
    }
    
    case 'SET_MOBILE': {
      const { payload } = action as SetMobileAction;
      // Jika berubah dari desktop ke mobile, terapkan batasan 1 chat
      if (payload && !state.isMobile && state.activeChats.length > 1) {
        return {
          ...state,
          isMobile: payload,
          activeChats: state.activeChats.slice(-1) // Hanya ambil chat terbaru
        };
      }
      
      return {
        ...state,
        isMobile: payload
      };
    }
    
    case 'SET_SEARCH_QUERY': {
      const { payload } = action as SetSearchQueryAction;
      return {
        ...state,
        searchQuery: payload
      };
    }
    
    case 'SET_SHOP_FILTER': {
      const { payload } = action as SetShopFilterAction;
      return {
        ...state,
        selectedShops: payload
      };
    }
    
    case 'SET_STATUS_FILTER': {
      const { payload } = action as SetStatusFilterAction;
      return {
        ...state,
        statusFilter: payload
      };
    }
    
    case 'FETCH_CONVERSATIONS_STARTED': {
      // Tidak ada payload untuk tindakan ini
      return {
        ...state,
        isLoading: true,
        error: null
      };
    }
    
    case 'FETCH_CONVERSATIONS_SUCCEEDED': {
      const { payload } = action as FetchConversationsSucceededAction;
      const newConversations = payload;
      // Hitung total unread dari daftar percakapan baru
      const newTotalUnread = newConversations.filter((conv: Conversation) => conv.unread_count > 0).length;
      
      return {
        ...state,
        conversations: newConversations,
        isLoading: false,
        totalUnread: newTotalUnread
      };
    }
    
    case 'FETCH_CONVERSATIONS_FAILED': {
      const { payload } = action as FetchConversationsFailedAction;
      return {
        ...state,
        isLoading: false,
        error: payload
      };
    }
    
    case 'OPEN_CHAT': {
      const { payload } = action as OpenChatAction;
      const { toId, shopId, toName, toAvatar, shopName, metadata } = payload;
      
      // Cari conversationId dari daftar percakapan jika tidak disediakan
      let conversationId = payload.conversationId;
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
          // Buat ID sementara
          conversationId = `temp_${toId}_${shopId}_${Date.now()}`;
          console.log('Membuat temporary conversationId:', conversationId);
          
          // Tambahkan juga ke daftar percakapan
          const tempConversation: Conversation = {
            conversation_id: conversationId,
            to_id: toId,
            to_name: toName,
            to_avatar: finalAvatar,
            shop_id: shopId,
            shop_name: shopName,
            latest_message_content: null,
            latest_message_from_id: 0,
            last_message_timestamp: Date.now(),
            unread_count: 0
          };
          
          // Tambahkan percakapan sementara ke state
          return {
            ...state,
            isOpen: true,
            isMinimized: false,
            conversations: [tempConversation, ...state.conversations],
            activeChats: handleMaxChatsLimit([...state.activeChats, {
              conversationId,
              toId,
              toName,
              toAvatar: finalAvatar,
              shopId,
              shopName,
              metadata
            }], state.isMobile)
          };
        }
      }
      
      // Cek apakah chat sudah ada
      const existingChatIndex = state.activeChats.findIndex(
        chat => chat.conversationId === conversationId
      );
      
      if (existingChatIndex >= 0) {
        // Update chat yang sudah ada dengan data terbaru dan pindahkan ke posisi terakhir (paling depan)
        const updatedChats = [...state.activeChats];
        const chatToUpdate = updatedChats.splice(existingChatIndex, 1)[0];
        
        const updatedChat = {
          ...chatToUpdate,
          toId,
          toName,
          toAvatar: finalAvatar,
          shopId,
          shopName,
          // Gabungkan metadata jika ada
          metadata: {
            ...chatToUpdate.metadata,
            ...metadata
          }
        };
        
        return {
          ...state,
          isOpen: true,
          isMinimized: false,
          activeChats: handleMaxChatsLimit([...updatedChats, updatedChat], state.isMobile)
        };
      }
      
      // Tambahkan chat baru dengan memeriksa batas maksimum
      return {
        ...state,
        isOpen: true,
        isMinimized: false,
        activeChats: handleMaxChatsLimit([...state.activeChats, {
          conversationId,
          toId,
          toName,
          toAvatar: finalAvatar,
          shopId,
          shopName,
          metadata
        }], state.isMobile)
      };
    }
    
    case 'CLOSE_CHAT': {
      const { payload } = action as CloseChatAction;
      return {
        ...state,
        activeChats: state.activeChats.filter(
          chat => chat.conversationId !== payload.conversationId
        ),
        isOpen: state.activeChats.length > 1 // Tetap buka jika masih ada chat lain
      };
    }
    
    case 'MINIMIZE_CHAT': {
      const { payload } = action as MinimizeChatAction;
      return {
        ...state,
        isMinimized: payload.minimize
      };
    }
    
    default:
      return state;
  }
}; 