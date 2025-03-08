'use client'
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useConversationList } from '@/app/hooks/useWebchat';
import { useConversationMessages } from '@/app/hooks/useGetMessage';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, User, CheckCircle2, ChevronLeft, Filter, ShoppingBag, MessageSquare } from "lucide-react"
import { useSendMessage } from '@/app/hooks/useSendMessage';

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMarkAsRead } from '@/app/hooks/useMarkAsRead';

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
  last_message_timestamp: number;
  unread_count: number;
}

// Perbarui interface Message untuk mendukung image_with_text
interface Message {
  id: string;
  sender: 'buyer' | 'seller';
  content: string;
  time: string;
  type: 'text' | 'image' | 'image_with_text' | 'order';
  imageUrl?: string;
  imageThumb?: {
    url: string;
    height: number;
    width: number;
  };
  orderData?: {
    shopId: number;
    orderSn: string;
  };
}

// Tambahkan interface untuk props MessageInput
interface MessageInputProps {
  onSendMessage: (message: string) => void;
  isSendingMessage: boolean;
}

// Update komponen dengan type yang sesuai
const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, isSendingMessage }) => {
  const [newMessage, setNewMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSendMessage(newMessage);
    setNewMessage('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        type="text"
        placeholder="Ketik pesan..."
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
        className="flex-grow"
        disabled={isSendingMessage}
      />
      <Button type="submit" disabled={!newMessage.trim() || isSendingMessage}>
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
};

// Tambahkan interface untuk Order
interface OrderItem {
  item_id: number;
  item_name: string;
  model_name: string;
  model_quantity_purchased: number;
  model_discounted_price: number;
  image_url: string;
}

interface Order {
  order_sn: string;
  order_status: string;
  total_amount: number;
  shipping_carrier: string;
  payment_method: string;
  order_items: OrderItem[];
  tracking_number: string;
}


const WebChatPage: React.FC = () => {
  const [selectedShop, setSelectedShop] = useState<number | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showConversationList, setShowConversationList] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShops, setSelectedShops] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState<'SEMUA' | 'BELUM DIBACA' | 'BELUM DIBALAS'>('SEMUA');
  const [isFullScreenChat, setIsFullScreenChat] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  const { conversations, updateConversationList } = useConversationList();
  const { 
    messages, 
    setMessages, 
    isLoading, 
    error, 
    loadMoreMessages, 
    hasMoreMessages,
 
  } = useConversationMessages(selectedConversation, selectedShop || 0);

  const selectedConversationData = useMemo(() => 
    conversations.find(conv => conv.conversation_id === selectedConversation),
    [conversations, selectedConversation]
  );

  const { sendMessage, isLoading: isSendingMessage, error: sendMessageError } = useSendMessage();

  const { markAsRead, isLoading: isMarkingAsRead, error: markAsReadError } = useMarkAsRead();

  // Tambahkan flag untuk mencegah double fetch
  const [shouldFetchOrders, setShouldFetchOrders] = useState(false);

  // Tambahkan fungsi untuk mengambil data pesanan
  const fetchOrders = async (userId: string) => {
    setIsLoadingOrders(true);
    try {
      const response = await fetch(`/api/order_details?user_id=${userId}`);
      const data = await response.json();
      setOrders(data.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  // Pisahkan effect untuk initial fetch dan mark as read
  useEffect(() => {
    if (selectedConversationData?.to_id && shouldFetchOrders) {
      fetchOrders(selectedConversationData.to_id.toString());
      setShouldFetchOrders(false); // Reset flag setelah fetch
    }
  }, [selectedConversationData?.to_id, shouldFetchOrders]);

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      setIsMobileView(isMobile);
      setIsFullScreenChat(isMobile && !showConversationList);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [showConversationList]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = async (message: string) => {
    if (!selectedConversationData || !message.trim()) return;

    try {
      const sentMessage = await sendMessage({
        toId: selectedConversationData.to_id,
        content: message,
        shopId: selectedConversationData.shop_id,
      });
      
      const newSentMessage: Message = {
        id: sentMessage.data.message_id,
        sender: 'seller',
        content: message,
        time: new Date(sentMessage.data.created_timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'text',
      };
      
      setMessages(prevMessages => [...prevMessages, newSentMessage]);
      
      // Update conversation list untuk menandai sudah dibalas
      updateConversationList({
        type: 'mark_as_read',
        conversation_id: selectedConversationData.conversation_id,
      });
    } catch (error) {
      console.error('Gagal mengirim pesan:', error);
    }
  };

  const handleConversationSelect = (conversation: Conversation) => {
    setSelectedShop(conversation.shop_id);
    setSelectedConversation(conversation.conversation_id);
    setShouldFetchOrders(true); // Set flag untuk fetch orders
    if (isMobileView) {
      setShowConversationList(false);
      setIsFullScreenChat(true);
    }
  };

  const filteredConversations = useMemo(() => {
    if (!conversations || conversations.length === 0) {
      return [];
    }

    return conversations.filter(conversation => {
      if (!conversation || !conversation.to_name || !conversation.shop_name) {
        return false;
      }

      const matchesSearch = conversation.to_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           conversation.shop_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesShopFilter = selectedShops.length === 0 || selectedShops.includes(conversation.shop_id);
      const matchesStatusFilter = 
        statusFilter === 'SEMUA' ? true :
        statusFilter === 'BELUM DIBACA' ? conversation.unread_count > 0 :
        statusFilter === 'BELUM DIBALAS' ? (conversation.latest_message_content?.text && conversation.to_id == conversation.latest_message_from_id) : true;

      return matchesSearch && matchesShopFilter && matchesStatusFilter;
    });
  }, [conversations, searchQuery, selectedShops, statusFilter]);

  const uniqueShops = useMemo(() => {
    if (!conversations || conversations.length === 0) {
      return [];
    }
    const shops = new Set(conversations.map(conv => conv.shop_id));
    return Array.from(shops);
  }, [conversations]);

  // Fungsi untuk menandai pesan sebagai dibaca
  const handleMarkAsRead = async (conversationId: string) => {
    const conversation = conversations.find(conv => conv.conversation_id === conversationId);
    if (!conversation || conversation.unread_count === 0) return;

    try {
      const lastBuyerMessage = [...messages].reverse().find(msg => msg.sender === 'buyer');
      if (!lastBuyerMessage) return;

      await markAsRead({
        shopId: conversation.shop_id,
        conversationId: conversation.conversation_id,
        lastReadMessageId: lastBuyerMessage.id,
      });

      // Update conversation list tanpa memicu fetch orders
      updateConversationList({
        type: 'mark_as_read',
        conversation_id: conversationId,
      });
    } catch (error) {
      console.error('Gagal menandai pesan sebagai dibaca:', error);
    }
  };

  useEffect(() => {
    if (selectedConversation && messages.length > 0 && !isLoading) {
        const selectedConv = conversations.find(conv => conv.conversation_id === selectedConversation);
        if (selectedConv && 
            typeof selectedConv.unread_count === 'number' && 
            selectedConv.unread_count > 0 &&
            selectedConv.latest_message_from_id === selectedConv.to_id) {
            const timeoutId = setTimeout(() => {
                handleMarkAsRead(selectedConversation);
            }, 500);
            
            return () => clearTimeout(timeoutId);
        }
    }
  }, [selectedConversation, messages, isLoading]);

  // Tambahkan state untuk tab aktif
  const [activeTab, setActiveTab] = useState<'chat' | 'orders'>('chat');

  // Tambahkan ref untuk scroll area
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Tambahkan state untuk menyimpan posisi scroll
  const [isLoadingOldMessages, setIsLoadingOldMessages] = useState(false);
  const previousScrollHeightRef = useRef<number>(0);
  const previousScrollTopRef = useRef<number>(0);

  // Tambahkan state untuk menandai initial load
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Modifikasi handleScroll
  const handleScroll = useCallback(() => {
    const viewport = document.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport || !hasMoreMessages || isLoading || isLoadingOldMessages || isInitialLoad) {
      console.log('Scroll handler skipped:', { 
        hasViewport: !!viewport, 
        hasMoreMessages, 
        isLoading,
        isLoadingOldMessages,
        isInitialLoad
      });
      return;
    }

    const viewportElement = viewport as HTMLDivElement;
    const { scrollTop, scrollHeight, clientHeight } = viewportElement;
    
    const scrollPercentage = (scrollTop / (scrollHeight - clientHeight)) * 100;
    
    console.log('Scroll percentage:', scrollPercentage);

    if (scrollPercentage < 20) {
      console.log('Loading more messages...');
      setIsLoadingOldMessages(true);
      previousScrollHeightRef.current = scrollHeight;
      previousScrollTopRef.current = scrollTop;
      loadMoreMessages();
    }
  }, [hasMoreMessages, isLoading, isLoadingOldMessages, loadMoreMessages, isInitialLoad]);

  // Modifikasi useEffect untuk scroll ke bawah
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      // Set isInitialLoad ke false setelah scroll pertama selesai
      setTimeout(() => {
        setIsInitialLoad(false);
      }, 100);
    }
  }, [messages]);

  // Modifikasi useEffect untuk mengembalikan posisi scroll setelah memuat pesan lama
  useEffect(() => {
    if (!isLoading && isLoadingOldMessages) {
      const viewport = document.querySelector('[data-radix-scroll-area-viewport]');
      if (!viewport) return;

      const viewportElement = viewport as HTMLDivElement;
      const newScrollHeight = viewportElement.scrollHeight;
      const scrollDifference = newScrollHeight - previousScrollHeightRef.current;
      
      // Kembalikan ke posisi scroll sebelumnya + perbedaan tinggi
      viewportElement.scrollTop = previousScrollTopRef.current + scrollDifference;
      setIsLoadingOldMessages(false);
    }
  }, [isLoading, messages, isLoadingOldMessages]);

  // Modifikasi useEffect untuk scroll event
  useEffect(() => {
    const viewport = document.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return;

    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Tambahkan state untuk menandai URL sudah diproses
  const [urlProcessed, setUrlProcessed] = useState(false);

  // Modifikasi useEffect untuk handle URL params
  useEffect(() => {
    const handleUrlParams = async () => {
      // Jika URL sudah diproses, skip
      if (urlProcessed) return;

      const urlParams = new URLSearchParams(window.location.search);
      const userId = urlParams.get('user_id');
      const orderSn = urlParams.get('order_sn');
      const shopId = urlParams.get('shop_id');
      
      if (!userId) return;

      // Cari conversation yang sesuai
      const targetConversation = conversations.find(
        conv => conv.to_id.toString() === userId && 
        (!shopId || conv.shop_id.toString() === shopId)
      );
      
      if (targetConversation) {
        handleConversationSelect(targetConversation);
        setUrlProcessed(true); // Tandai URL sudah diproses
      } else if (orderSn) {
        try {
          const response = await fetch('/api/msg/initialize', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: parseInt(userId),
              orderSn: orderSn,
              shopId: shopId ? parseInt(shopId) : null,
            }),
          });

          if (!response.ok) {
            throw new Error('Gagal memulai percakapan');
          }

          const data = await response.json();
          
          if (data.success) {
            updateConversationList({
              type: 'refresh'
            });
            
            setTimeout(() => {
              const newTargetConversation = conversations.find(
                conv => conv.to_id.toString() === userId && 
                (!shopId || conv.shop_id.toString() === shopId)
              );
              
              if (newTargetConversation) {
                handleConversationSelect(newTargetConversation);
                setUrlProcessed(true); // Tandai URL sudah diproses
              }
            }, 500);
          }
        } catch (error) {
          console.error('Error memulai percakapan:', error);
          setUrlProcessed(true); // Tandai URL sudah diproses meskipun error
        }
      }
    };

    if (conversations.length > 0 && !urlProcessed) {
      handleUrlParams();
    }
  }, [conversations, urlProcessed]); // Tambahkan urlProcessed ke dependencies

  useEffect(() => {
    if (!selectedConversation) return;

    const handleSSEMessage = (event: CustomEvent) => {
      const data = event.detail;
      
      if (data.type === 'new_message' && data.conversationId === selectedConversation) {
        const newMessage: Message = {
          id: data.messageId,
          sender: data.fromShopId === selectedShop ? 'seller' : 'buyer',
          type: data.messageType,
          content: ['text', 'image_with_text'].includes(data.messageType) 
            ? data.content.text 
            : data.messageType === 'order' 
              ? 'Menampilkan detail pesanan'
              : '',
          imageUrl: data.messageType === 'image' 
            ? data.content.url 
            : data.messageType === 'image_with_text' 
              ? data.content.image_url 
              : undefined,
          imageThumb: ['image', 'image_with_text'].includes(data.messageType) ? {
            url: data.messageType === 'image' 
              ? (data.content.thumb_url || data.content.url)
              : (data.content.thumb_url || data.content.image_url),
            height: data.content.thumb_height,
            width: data.content.thumb_width
          } : undefined,
          orderData: data.messageType === 'order' ? {
            shopId: data.content.shop_id,
            orderSn: data.content.order_sn
          } : undefined,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prevMessages => [...prevMessages, newMessage]);
      }
    };

    window.addEventListener('sse-message', handleSSEMessage as EventListener);
    return () => window.removeEventListener('sse-message', handleSSEMessage as EventListener);
  }, [selectedConversation, selectedShop]);

  // Modifikasi fungsi untuk memproses pesan dari API
  const processApiMessage = (apiMessage: any): Message => {
    const isFromSeller = apiMessage.from_shop_id === selectedShop;
    const baseMessage = {
      id: apiMessage.message_id,
      sender: isFromSeller ? 'seller' as const : 'buyer' as const,
      time: new Date(apiMessage.created_timestamp * 1000).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };

    switch (apiMessage.message_type) {
      case 'text':
        return {
          ...baseMessage,
          type: 'text' as const,
          content: apiMessage.content.text
        };
      
      case 'image':
        return {
          ...baseMessage,
          type: 'image' as const,
          content: '',
          imageUrl: apiMessage.content.url,
          imageThumb: {
            url: apiMessage.content.thumb_url || apiMessage.content.url,
            height: apiMessage.content.thumb_height,
            width: apiMessage.content.thumb_width
          }
        };
      
      case 'image_with_text':
        return {
          ...baseMessage,
          type: 'image_with_text' as const,
          content: apiMessage.content.text || '',
          imageUrl: apiMessage.content.image_url,
          imageThumb: {
            url: apiMessage.content.thumb_url || apiMessage.content.image_url,
            height: apiMessage.content.thumb_height,
            width: apiMessage.content.thumb_width
          }
        };
      
      case 'order':
        return {
          ...baseMessage,
          type: 'order' as const,
          content: 'Menampilkan detail pesanan',
          orderData: {
            shopId: apiMessage.content.shop_id,
            orderSn: apiMessage.content.order_sn
          }
        };
      
      default:
        return {
          ...baseMessage,
          type: 'text' as const,
          content: 'Tipe pesan tidak didukung'
        };
    }
  };

  return (
    <div className={`flex h-full w-full overflow-hidden ${isFullScreenChat ? 'fixed inset-0 z-50 bg-background' : ''}`}>
      {/* Daftar Percakapan */}
      {(!isMobileView || (isMobileView && showConversationList)) && (
        <div className={`${isMobileView ? 'w-full' : 'w-1/3 md:w-1/4 lg:w-1/5'} border-r bg-muted/20 flex flex-col h-full`}>
          {/* Kolom Pencarian dan Filter */}
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="Cari percakapan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-grow"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div>
                    <h4 className="font-medium mb-2">Filter Toko:</h4>
                    {uniqueShops.map(shopId => (
                      <label key={shopId} className="flex items-center mb-1">
                        <input
                          type="checkbox"
                          checked={selectedShops.includes(shopId)}
                          onChange={() => {
                            setSelectedShops(prev =>
                              prev.includes(shopId)
                                ? prev.filter(id => id !== shopId)
                                : [...prev, shopId]
                            );
                          }}
                          className="mr-2"
                        />
                        {conversations.find(conv => conv.shop_id === shopId)?.shop_name}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'SEMUA' | 'BELUM DIBACA' | 'BELUM DIBALAS')}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="SEMUA" className="text-xs">Semua</TabsTrigger>
                <TabsTrigger value="BELUM DIBACA" className="text-xs">Belum Dibaca</TabsTrigger>
                <TabsTrigger value="BELUM DIBALAS" className="text-xs">Belum Dibalas</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <ScrollArea className="flex-grow overflow-y-auto">
            <div className="p-3">
              {filteredConversations.map((conversation) => (
                <div
                  key={conversation.conversation_id}
                  className={`flex items-center gap-2 p-2 hover:bg-muted/50 cursor-pointer ${
                    selectedConversation === conversation.conversation_id ? 'bg-muted/50' : ''
                  } ${isMobileView ? 'text-sm' : ''}`}
                  onClick={() => handleConversationSelect(conversation)}
                >
                  <Avatar className={isMobileView ? 'h-8 w-8' : ''}>
                    <AvatarImage src={conversation.to_avatar} />
                    <AvatarFallback><User className={isMobileView ? 'h-4 w-4' : ''} /></AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-baseline">
                      <div className="flex items-center">
                        <p className={`font-medium truncate ${isMobileView ? 'text-xs' : ''}`}>{conversation.shop_name}</p>
                        {conversation.unread_count > 0 && (
                          <div className="w-2 h-2 bg-red-500 rounded-full ml-2"></div>
                        )}
                      </div>
                      <p className={`text-muted-foreground ${isMobileView ? 'text-[10px]' : 'text-xs'}`}>
                        {new Date(conversation.last_message_timestamp / 1000000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className={`font-bold ${isMobileView ? 'text-xs' : 'text-sm'}`}>{conversation.to_name}</p>
                      {conversation.to_id != conversation.latest_message_from_id && conversation.unread_count === 0 && (
                        <CheckCircle2 className={`text-primary ${isMobileView ? 'h-2 w-2' : 'h-3 w-3'}`} />
                      )}
                    </div>
                    <p className={`text-muted-foreground truncate ${isMobileView ? 'text-xs' : 'text-sm'}`}>{conversation.latest_message_content?.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Area Chat dan Pesanan untuk Mobile */}
      {(!isMobileView || (isMobileView && !showConversationList)) && (
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Header Chat */}
          <div className="border-b sticky top-0 bg-background z-10">
            <div className="p-3 flex items-center gap-2 h-[65px]">
              {isMobileView && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowConversationList(true);
                    setIsFullScreenChat(false);
                  }}
                  className="md:hidden"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              )}
              {selectedConversation && selectedConversationData ? (
                <>
                  <div className="flex items-center gap-2 overflow-hidden flex-grow">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={selectedConversationData.to_avatar} />
                      <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                    </Avatar>
                    <div className="overflow-hidden">
                      <p className="font-medium truncate text-sm">{selectedConversationData.shop_name}</p>
                      <p className="font-bold truncate text-xs">{selectedConversationData.to_name}</p>
                    </div>
                  </div>
                  {isMobileView && (
                    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'chat' | 'orders')}>
                      <TabsList className="flex gap-1">
                        <TabsTrigger value="chat" className="px-2">
                          <MessageSquare className="h-4 w-4" />
                        </TabsTrigger>
                        <TabsTrigger value="orders" className="px-2">
                          <ShoppingBag className="h-4 w-4" />
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground text-sm">Pilih percakapan untuk memulai chat</p>
              )}
            </div>
          </div>

          {/* Konten berdasarkan tab aktif untuk mobile */}
          {isMobileView ? (
            activeTab === 'chat' ? (
              <>
                {/* Area Pesan */}
                <ScrollArea 
                  className="flex-grow p-4" 
                  ref={scrollAreaRef}
                >
                  {isLoading && messages.length === 0 ? (
                    <div className="flex justify-center p-4">
                      <span>Memuat pesan...</span>
                    </div>
                  ) : error ? (
                    <div className="flex justify-center p-4 text-red-500">
                      Error: {error}
                    </div>
                  ) : (
                    <>
                      {/* Indikator loading pesan lama */}
                      {hasMoreMessages && isLoading && (
                        <div className="flex justify-center p-2">
                          <span className="text-sm text-muted-foreground">
                            Memuat pesan lama...
                          </span>
                        </div>
                      )}
                      
                      {messages.map((message) => (
                        <div key={message.id} className={`flex ${message.sender === 'seller' ? 'justify-end' : 'justify-start'} mb-4`}>
                          <div className={`max-w-[70%] rounded-lg p-3 ${
                            message.sender === 'seller' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                          }`}>
                            {message.type === 'text' ? (
                              <p className="break-words">{message.content}</p>
                            ) : (message.type === 'image' || message.type === 'image_with_text') && message.imageUrl ? (
                              <div className="space-y-2">
                                <div className="relative">
                                  <img
                                    src={message.imageUrl}
                                    alt="Pesan gambar"
                                    className="rounded max-w-full cursor-pointer hover:opacity-90 transition-opacity"
                                    style={{
                                      maxHeight: '300px',
                                      width: 'auto',
                                      aspectRatio: message.imageThumb ? `${message.imageThumb.width}/${message.imageThumb.height}` : 'auto'
                                    }}
                                    onClick={() => window.open(message.imageUrl, '_blank')}
                                  />
                                </div>
                                {message.type === 'image_with_text' && message.content && (
                                  <p className="break-words mt-2">{message.content}</p>
                                )}
                              </div>
                            ) : message.type === 'order' && message.orderData ? (
                              <div 
                                className="flex items-center gap-2 cursor-pointer hover:opacity-80"
                                onClick={() => {
                                  // Optional: Tambahkan fungsi untuk menampilkan detail pesanan
                                  const order = orders.find(o => o.order_sn === message.orderData?.orderSn);
                                  if (order) {
                                    // Tampilkan detail pesanan atau arahkan ke tab pesanan
                                    setActiveTab('orders');
                                  }
                                }}
                              >
                                <ShoppingBag className="h-4 w-4" />
                                <span>Pesanan #{message.orderData.orderSn}</span>
                              </div>
                            ) : null}
                            <p className="text-xs mt-1 opacity-70">{message.time}</p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </ScrollArea>
                {/* Area Input */}
                <div className="p-4 border-t">
                  <MessageInput 
                    onSendMessage={(message) => handleSendMessage(message)} 
                    isSendingMessage={isSendingMessage}
                  />
                </div>
              </>
            ) : (
              <ScrollArea className="flex-grow">
                {isLoadingOrders ? (
                  <div className="p-4">Memuat pesanan...</div>
                ) : orders.length > 0 ? (
                  <div className="p-4 space-y-4">
                    {orders.map((order) => (
                      <div key={order.order_sn} className="border rounded-lg p-3 bg-background">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium">No. Pesanan:</p>
                            <p className="text-sm">{order.order_sn}</p>
                          </div>
                          <span className="text-xs px-2 py-1 bg-primary/10 rounded-full">
                            {order.order_status}
                          </span>
                        </div>
                        
                        {order.order_items.map((item, index) => (
                          <div key={`${item.item_id}-${index}`} className="flex gap-2 mt-2 pb-2 border-b">
                            <img 
                              src={item.image_url} 
                              alt={item.item_name}
                              className="w-16 h-16 object-cover rounded"
                            />
                            <div className="flex-1">
                              <p className="text-sm line-clamp-2">{item.item_name}</p>
                              <p className="text-xs text-muted-foreground">{item.model_name}</p>
                              <div className="flex justify-between mt-1">
                                <p className="text-sm">x{item.model_quantity_purchased}</p>
                                <p className="text-sm font-medium">
                                  Rp{item.model_discounted_price.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        <div className="mt-2 pt-2 border-t">
                          <div className="flex justify-between">
                            <span className="text-sm">Total Pembayaran:</span>
                            <span className="font-semibold">
                              Rp{order.total_amount.toLocaleString()}
                            </span>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            <p>Kurir: {order.shipping_carrier}</p>
                            <p>No. Resi: {order.tracking_number}</p>
                            <p>Pembayaran: {order.payment_method}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    Tidak ada pesanan ditemukan
                  </div>
                )}
              </ScrollArea>
            )
          ) : (
            <>
              {/* Tampilan desktop tetap sama */}
              <ScrollArea 
                className="flex-grow p-4" 
                ref={scrollAreaRef}
              >
                {isLoading && messages.length === 0 ? (
                  <div className="flex justify-center p-4">
                    <span>Memuat pesan...</span>
                  </div>
                ) : error ? (
                  <div className="flex justify-center p-4 text-red-500">
                    Error: {error}
                  </div>
                ) : (
                  <>
                    {/* Indikator loading pesan lama */}
                    {hasMoreMessages && isLoading && (
                      <div className="flex justify-center p-2">
                        <span className="text-sm text-muted-foreground">
                          Memuat pesan lama...
                        </span>
                      </div>
                    )}
                    
                    {messages.map((message) => (
                      <div key={message.id} className={`flex ${message.sender === 'seller' ? 'justify-end' : 'justify-start'} mb-4`}>
                        <div className={`max-w-[70%] rounded-lg p-3 ${
                          message.sender === 'seller' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        }`}>
                          {message.type === 'text' ? (
                            <p className="break-words">{message.content}</p>
                          ) : (message.type === 'image' || message.type === 'image_with_text') && message.imageUrl ? (
                            <div className="space-y-2">
                              <div className="relative">
                                <img
                                  src={message.imageUrl}
                                  alt="Pesan gambar"
                                  className="rounded max-w-full cursor-pointer hover:opacity-90 transition-opacity"
                                  style={{
                                    maxHeight: '300px',
                                    width: 'auto',
                                    aspectRatio: message.imageThumb ? `${message.imageThumb.width}/${message.imageThumb.height}` : 'auto'
                                  }}
                                  onClick={() => window.open(message.imageUrl, '_blank')}
                                />
                              </div>
                              {message.type === 'image_with_text' && message.content && (
                                <p className="break-words mt-2">{message.content}</p>
                              )}
                            </div>
                          ) : message.type === 'order' && message.orderData ? (
                            <div 
                              className="flex items-center gap-2 cursor-pointer hover:opacity-80"
                              onClick={() => {
                                // Optional: Tambahkan fungsi untuk menampilkan detail pesanan
                                const order = orders.find(o => o.order_sn === message.orderData?.orderSn);
                                if (order) {
                                  // Tampilkan detail pesanan atau arahkan ke tab pesanan
                                  setActiveTab('orders');
                                }
                              }}
                            >
                              <ShoppingBag className="h-4 w-4" />
                              <span>Pesanan #{message.orderData.orderSn}</span>
                            </div>
                          ) : null}
                          <p className="text-xs mt-1 opacity-70">{message.time}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </ScrollArea>
              <div className="p-4 border-t">
                <MessageInput 
                  onSendMessage={(message) => handleSendMessage(message)} 
                  isSendingMessage={isSendingMessage}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Tambahkan kolom order details */}
      {selectedConversation && !isMobileView && (
        <div className="w-1/4 border-l bg-muted/20 overflow-hidden flex flex-col">
          {/* Header dengan tinggi yang sama */}
          <div className="p-3 border-b flex items-center sticky top-0 bg-background z-10 h-[66px]">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              <h3 className="font-semibold">Daftar Pesanan</h3>
            </div>
          </div>
          <ScrollArea className="flex-grow">
            {isLoadingOrders ? (
              <div className="p-4">Memuat pesanan...</div>
            ) : orders.length > 0 ? (
              <div className="p-4 space-y-4">
                {orders.map((order) => (
                  <div key={order.order_sn} className="border rounded-lg p-3 bg-background">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">No. Pesanan:</p>
                        <p className="text-sm">{order.order_sn}</p>
                      </div>
                      <span className="text-xs px-2 py-1 bg-primary/10 rounded-full">
                        {order.order_status}
                      </span>
                    </div>
                    
                    {order.order_items.map((item, index) => (
                      <div key={`${item.item_id}-${index}`} className="flex gap-2 mt-2 pb-2 border-b">
                        <img 
                          src={item.image_url} 
                          alt={item.item_name}
                          className="w-16 h-16 object-cover rounded"
                        />
                        <div className="flex-1">
                          <p className="text-sm line-clamp-2">{item.item_name}</p>
                          <p className="text-xs text-muted-foreground">{item.model_name}</p>
                          <div className="flex justify-between mt-1">
                            <p className="text-sm">x{item.model_quantity_purchased}</p>
                            <p className="text-sm font-medium">
                              Rp{item.model_discounted_price.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="mt-2 pt-2 border-t">
                      <div className="flex justify-between">
                        <span className="text-sm">Total Pembayaran:</span>
                        <span className="font-semibold">
                          Rp{order.total_amount.toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        <p>Kurir: {order.shipping_carrier}</p>
                        <p>No. Resi: {order.tracking_number}</p>
                        <p>Pembayaran: {order.payment_method}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                Tidak ada pesanan ditemukan
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

export default WebChatPage;
