'use client'
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useConversationMessages } from '@/app/hooks/useGetMessage';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, User, CheckCircle2, ChevronLeft, Filter, ShoppingBag, MessageSquare, ArrowRight } from "lucide-react"
import { useVirtualizer } from '@tanstack/react-virtual';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMiniChat } from '@/contexts/MiniChatContext';
import { toast } from 'sonner';
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

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

// Tambahkan interface untuk ConversationItem props
interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  isMobileView: boolean;
  onSelect: (conversation: Conversation) => void;
}

// Komponen ConversationItem yang dimemoize
const ConversationItem = React.memo(({ conversation, isSelected, isMobileView, onSelect }: ConversationItemProps) => {
  return (
    <>
      <div
        className={`grid grid-cols-[auto_1fr] gap-x-2 gap-y-0 p-2 ${
          isSelected 
            ? 'bg-primary/10 border-l-4 border-primary shadow-sm dark:bg-primary/20 relative' 
            : 'hover:bg-muted/50 cursor-pointer border-l-4 border-transparent'
        } ${isMobileView ? 'text-sm' : ''} transition-all duration-200 ease-in-out mb-1 rounded-sm`}
        onClick={() => {
          // Pada mobile, percakapan yang aktif juga bisa diklik
          // supaya bisa kembali ke chat view
          onSelect(conversation);
        }}
      >
        {isSelected && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-primary">
            <ArrowRight className="h-4 w-4" />
          </div>
        )}
        
        <Avatar className={`${isMobileView ? 'h-8 w-8' : 'h-9 w-9'} row-span-3 self-center ${isSelected ? 'ring-2 ring-primary ring-offset-1' : ''}`}>
          <AvatarImage src={conversation.to_avatar} />
          <AvatarFallback><User className={isMobileView ? 'h-4 w-4' : ''} /></AvatarFallback>
        </Avatar>
        
        <div className="flex justify-between items-center w-full pr-6">
          <div className="flex items-center max-w-[65%]">
            <p className={`font-medium truncate text-xs leading-tight ${isSelected ? 'text-primary font-semibold' : ''}`}>{conversation.shop_name}</p>
            {conversation.unread_count > 0 && (
              <div className="w-2 h-2 bg-red-500 rounded-full ml-1 flex-shrink-0"></div>
            )}
          </div>
          <p className={`text-muted-foreground text-[10px] flex-shrink-0`}>
            {new Date(conversation.last_message_timestamp / 1000000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        
        <div className="flex justify-between items-center w-full pr-6">
          <p className={`font-bold truncate max-w-[75%] text-xs leading-tight ${isSelected ? 'text-primary' : ''}`}>{conversation.to_name}</p>
          {conversation.to_id != conversation.latest_message_from_id && conversation.unread_count === 0 && (
            <CheckCircle2 className={`text-primary flex-shrink-0 h-2 w-2`} />
          )}
        </div>
        
        <p className={`text-muted-foreground truncate pr-6 text-xs leading-tight ${isSelected ? 'opacity-80' : 'opacity-60'}`}>
          {conversation.latest_message_content?.text}
        </p>
      </div>
    </>
  );
}, (prevProps, nextProps) => {
  // Optimasi untuk mencegah render ulang yang tidak perlu
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.conversation.unread_count === nextProps.conversation.unread_count &&
    prevProps.conversation.last_message_timestamp === nextProps.conversation.last_message_timestamp &&
    prevProps.conversation.latest_message_content?.text === nextProps.conversation.latest_message_content?.text
  );
});
// Tambahkan displayName
ConversationItem.displayName = 'ConversationItem';

// Update komponen dengan type yang sesuai
const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, isSendingMessage }) => {
  const [newMessage, setNewMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSendingMessage) return;
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
      <Button 
        type="submit" 
        disabled={!newMessage.trim() || isSendingMessage}
        className={!newMessage.trim() || isSendingMessage ? "opacity-70" : ""}
      >
        {isSendingMessage ? (
          <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
        <Send className="h-4 w-4" />
        )}
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

// Tambahkan interface untuk MessageBubble props
interface MessageBubbleProps {
  message: Message;
  orders: Order[];
  onShowOrderDetails?: (orderSn: string) => void;
}

// Komponen MessageBubble yang dimemoize
const MessageBubble = React.memo(({ message, orders, onShowOrderDetails }: MessageBubbleProps) => {
  return (
    <div className={`flex ${message.sender === 'seller' ? 'justify-end' : 'justify-start'} mb-4 w-full`}>
      <div className={`max-w-[75%] rounded-lg p-3 ${
        message.sender === 'seller' ? 'bg-primary text-primary-foreground' : 'bg-muted'
      }`}>
        {message.type === 'text' ? (
          <p className="break-words whitespace-pre-wrap">{message.content}</p>
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
                  maxWidth: '100%',
                  aspectRatio: message.imageThumb ? `${message.imageThumb.width}/${message.imageThumb.height}` : 'auto'
                }}
                onClick={() => window.open(message.imageUrl, '_blank')}
              />
            </div>
            {message.type === 'image_with_text' && message.content && (
              <p className="break-words whitespace-pre-wrap mt-2">{message.content}</p>
            )}
          </div>
        ) : message.type === 'order' && message.orderData ? (
          <div 
            className="flex items-center gap-2 cursor-pointer hover:opacity-80"
            onClick={() => {
              if (onShowOrderDetails && message.orderData) {
                const order = orders.find(o => o.order_sn === message.orderData?.orderSn);
                if (order) {
                  onShowOrderDetails(message.orderData.orderSn);
                }
              }
            }}
          >
            <ShoppingBag className="h-4 w-4 flex-shrink-0" />
            <span className="break-words">Pesanan #{message.orderData.orderSn}</span>
          </div>
        ) : null}
        <p className="text-xs mt-1 opacity-70">{message.time}</p>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Mensimulasikan membandingkan pesan berdasarkan id dan type
  // Ini akan mencegah render ulang jika pesan tidak berubah
  return prevProps.message.id === nextProps.message.id && 
         prevProps.message.type === nextProps.message.type;
});
// Tambahkan displayName
MessageBubble.displayName = 'MessageBubble';

// Komponen untuk konten chat (virtualized dengan react-virtual)
interface ChatContentProps {
  messages: Message[];
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  hasMoreMessages: boolean;
  isLoadingConversation: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  setActiveTab: (tab: 'chat' | 'orders') => void;
  onShowOrderDetails: (orderSn: string) => void;
  selectedConversation: string | null;
}

const ChatContent = React.memo(({ 
    messages, 
  orders, 
    isLoading, 
    error, 
    hasMoreMessages,
  isLoadingConversation,
  messagesEndRef,
  setActiveTab,
  onShowOrderDetails,
  selectedConversation
}: ChatContentProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  // Menghitung estimasi tinggi pesan berdasarkan kontennya
  const estimateSize = useCallback((index: number) => {
    const message = messages[index];
    if (!message) return 80; // Default height

    // Perkiraan tinggi berdasarkan tipe pesan
    if (message.type === 'text') {
      // Perkiraan tinggi berdasarkan panjang teks
      const textLength = message.content.length;
      // Untuk mobile, kita perlu estimasi lebih tinggi karena lebar container lebih kecil
      const width = parentRef.current ? parentRef.current.clientWidth - 32 : window.innerWidth - 32; // 32px untuk padding
      const charsPerLine = Math.max(20, Math.floor(width / 8)); // Estimate 8px per character
      const lineCount = Math.ceil(textLength / charsPerLine);
      return Math.max(80, lineCount * 20 + 40); // Base height + height per line
    } else if (message.type === 'image' || message.type === 'image_with_text') {
      return message.type === 'image_with_text' ? 350 : 300; // Image dengan/tanpa teks
    }
    
    return 80; // Default untuk tipe lain
  }, [messages]);

  // Menghitung jumlah item yang akan ditampilkan (termasuk loading indicator jika diperlukan)
  const itemCount = hasMoreMessages && isLoading ? messages.length + 1 : messages.length;

  // Inisialisasi virtualizer dengan measureElement untuk mengukur tinggi secara akurat
  const virtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 5, // Jumlah item yang dirender di luar viewport
    measureElement: (element) => {
      // Mengukur tinggi elemen sebenarnya dengan type casting
      if (!element) return 0;
      const htmlElement = element as HTMLElement;
      return element.getBoundingClientRect().height || 
        estimateSize(Number(htmlElement.dataset?.index) || 0);
    },
  });

  // Scroll ke bawah ketika pesan baru ditambahkan atau percakapan dibuka
  useEffect(() => {
    // Periksa kondisi yang tepat untuk scroll
    const shouldScroll = 
      messages.length > 0 && 
      parentRef.current && 
      (!isLoading || !isLoadingConversation);
    
    if (shouldScroll) {
      // Gunakan timeout untuk memastikan virtualizer dan DOM sudah siap
      const timeoutId = setTimeout(() => {
        // Scroll with smooth behavior
        virtualizer.scrollToIndex(messages.length - 1, {
          align: 'end',
          behavior: 'smooth'
        });
      }, 150);
      
      return () => clearTimeout(timeoutId);
    }
  }, [messages.length, isLoading, isLoadingConversation, virtualizer]);

  // Tambahkan backup scroll untuk percakapan yang baru dibuka
  useEffect(() => {
    // Khusus untuk transisi dari loading ke loaded
    if (selectedConversation && !isLoadingConversation && messages.length > 0) {
      // Reset sizeMap jika perlu untuk memastikan ukuran terukur dengan benar
      virtualizer.measure();
    }
  }, [isLoadingConversation, selectedConversation, messages.length, virtualizer]);

  // Efek untuk resize virtualizer ketika ukuran window berubah
  useEffect(() => {
    const handleResize = () => {
      virtualizer.measure();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [virtualizer]);

  if (isLoadingConversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium">Memuat percakapan...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="flex flex-col items-center space-y-4 text-destructive">
          <div className="h-12 w-12 rounded-full border-2 border-destructive flex items-center justify-center">
            <span className="text-2xl font-bold">!</span>
          </div>
          <p className="font-medium text-center">Terjadi kesalahan saat memuat pesan</p>
          <Button variant="outline" className="mt-2" onClick={() => window.location.reload()}>
            Coba lagi
          </Button>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="flex flex-col items-center space-y-4 text-muted-foreground">
          <MessageSquare className="h-12 w-12 opacity-20" />
          <p className="font-medium text-center">Belum ada pesan</p>
          <p className="text-sm text-center">Mulai percakapan dengan mengirimkan pesan pertama</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden">
      <div
        ref={parentRef}
        className="h-full w-full overflow-auto scrollbar-thin"
        style={{
          position: 'relative',
          height: '100%',
          width: '100%',
          overflow: 'auto',
          padding: '0.5rem 1rem 0.5rem 1rem', /* 8px atas bawah, 16px kiri kanan */
        }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const index = virtualItem.index;
            
            // Loading indicator untuk pesan lama
            if (index === 0 && hasMoreMessages && isLoading) {
              return (
                <div
                  key="loading"
                  data-index={index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                  className="flex justify-center p-2"
                >
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Memuat pesan lama</span>
                  </div>
                </div>
              );
            }
            
            const adjustedIndex = hasMoreMessages && isLoading ? index - 1 : index;
            const message = messages[adjustedIndex];
            
            if (!message) return null;
            
            return (
              <div
                key={message.id}
                data-index={index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: 'auto', // Height auto untuk diukur dengan measureElement
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <MessageBubble
                  message={message}
                  orders={orders}
                  onShowOrderDetails={onShowOrderDetails}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div ref={messagesEndRef} />
    </div>
  );
});
// Tambahkan displayName
ChatContent.displayName = 'ChatContent';

// Komponen OrderItem
interface OrderItemProps {
  item: OrderItem;
}

const OrderItem = React.memo(({ item }: OrderItemProps) => (
  <div className="flex gap-2 mt-2 pb-2 border-b">
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
));
// Tambahkan displayName
OrderItem.displayName = 'OrderItem';

// Komponen OrderDetail
interface OrderDetailProps {
  order: Order;
}

const OrderDetail = React.memo(({ order }: OrderDetailProps) => (
  <div className="border rounded-lg p-3 bg-background">
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
      <OrderItem key={`${item.item_id}-${index}`} item={item} />
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
));
// Tambahkan displayName
OrderDetail.displayName = 'OrderDetail';

// Komponen OrderList (dengan virtualisasi sederhana)
interface OrderListProps {
  orders: Order[];
  isLoading: boolean;
}

const OrderList = React.memo(({ orders, isLoading }: OrderListProps) => {
  return (
    <div className="space-y-4 p-2">
      {isLoading ? (
        // Skeleton loader untuk item pesanan
        <div className="space-y-4">
          <div className="flex flex-col space-y-3 p-4 border rounded-lg bg-card">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-4 w-[100px]" />
            </div>
            <Skeleton className="h-4 w-[250px]" />
            <div className="space-y-2">
              {Array(2).fill(0).map((_, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Skeleton className="h-12 w-12 rounded-md" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t space-y-2">
              <Skeleton className="h-4 w-[150px]" />
              <Skeleton className="h-4 w-[200px]" />
            </div>
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <ShoppingBag className="h-12 w-12 mb-2 opacity-20" />
          <p>Tidak ada pesanan</p>
        </div>
      ) : (
        orders.map((order) => (
          <OrderDetail key={order.order_sn} order={order} />
        ))
      )}
    </div>
  );
});
OrderList.displayName = 'OrderList';

const WebChatPage: React.FC = () => {
  const [selectedShop, setSelectedShop] = useState<number | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showConversationList, setShowConversationList] = useState(true);
  const [isFullScreenChat, setIsFullScreenChat] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'orders'>('chat');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  // Tambahkan state untuk menandai URL sudah diproses
  const [urlProcessed, setUrlProcessed] = useState(false);
  // Tambahkan state dan fungsi untuk debounce pencarian
  const [searchInput, setSearchInput] = useState("");
  // Tambahkan state loading untuk transisi percakapan
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);

  // Gunakan context yang telah diperbarui
  const { 
    filteredConversations: conversations, 
    uniqueShops,
    updateConversationList,
    setSearchQuery,
    setShopFilter,
    setStatusFilter,
    state,
    sendMessage: sendMessageContext,
    markMessageAsRead: markMessageAsReadContext
  } = useMiniChat();

  const { 
    messages, 
    setMessages, 
    isLoading, 
    error, 
    loadMoreMessages, 
    hasMoreMessages
  } = useConversationMessages(selectedConversation, selectedShop || 0);

  // Fungsi untuk memilih percakapan
  const handleConversationSelect = useCallback((conversation: Conversation) => {
    console.log("handleConversationSelect called:", {
      conversationId: conversation.conversation_id,
      selectedConversation,
      isSame: conversation.conversation_id === selectedConversation
    });
    
    // Jika percakapan yang dipilih sama dengan yang sebelumnya, hanya ubah tampilan
    if (conversation.conversation_id === selectedConversation) {
      console.log("Same conversation selected, just updating mobile view");
      if (isMobileView) {
        setShowConversationList(false);
        setIsFullScreenChat(true);
      }
      return;
    }
    
    // Tampilkan loading terlebih dahulu, sebelum manipulasi state lain
    setIsLoadingConversation(true);
    
    // Gunakan setTimeout dengan delay 0 untuk memberikan kesempatan UI loading dirender dahulu
    setTimeout(() => {
      // Bersihkan pesan lama
      setMessages(() => []);
      
      setSelectedShop(conversation.shop_id);
      setSelectedConversation(conversation.conversation_id);
      setShouldFetchOrders(true); // Set flag untuk fetch orders
      if (isMobileView) {
        setShowConversationList(false);
        setIsFullScreenChat(true);
      }
    }, 0);
  }, [isMobileView, setMessages, selectedConversation]);
  
  // Gunakan allConversations untuk mendapatkan data percakapan yang dipilih
  // terlepas dari filter yang aktif
  const selectedConversationData = useMemo(() => 
    state.conversations.find(conv => conv.conversation_id === selectedConversation),
    [state.conversations, selectedConversation]
  );

  // Fungsi untuk menandai pesan sebagai dibaca
  const handleMarkAsRead = useCallback(async (conversationId: string) => {
    const conversation = conversations.find(conv => conv.conversation_id === conversationId);
    if (!conversation || conversation.unread_count === 0) return;

    try {
      // Cari ID pesan terakhir dari pengirim
      const lastBuyerMessage = [...messages].reverse().find(msg => msg.sender === 'buyer');
      
      if (lastBuyerMessage) {
        await markMessageAsReadContext(
          conversation.conversation_id,
          lastBuyerMessage.id
        );
      } else if (conversation.latest_message_id) {
        // Fallback menggunakan ID pesan terakhir dari data percakapan
        await markMessageAsReadContext(
          conversation.conversation_id,
          conversation.latest_message_id
        );
      }
    } catch (error) {
      console.error('Gagal menandai pesan sebagai dibaca:', error);
    }
  }, [conversations, messages, markMessageAsReadContext]);

  // Efek untuk memperbarui tampilan chat saat percakapan yang dipilih mendapat pembaruan
  useEffect(() => {
    if (selectedConversation && selectedConversationData) {
      // Jika percakapan yang sedang dilihat mendapat pesan yang belum dibaca
      if (selectedConversationData.unread_count > 0 && messages.length > 0 && !isLoading) {
        // Tandai pesan sebagai dibaca setelah 500ms (memberi waktu UI dirender)
            const timeoutId = setTimeout(() => {
                handleMarkAsRead(selectedConversation);
            }, 500);
            
            return () => clearTimeout(timeoutId);
        }
      
      // Jika ini adalah percakapan baru yang belum pernah dibuka sebelumnya
      if (messages.length === 0 && !isLoading) {
        // Muat pesan-pesan dari percakapan tersebut
      loadMoreMessages();
    }
    }
  }, [selectedConversationData, selectedConversation, isLoading, messages.length, handleMarkAsRead, loadMoreMessages, conversations]);

  // Tambahkan effect untuk mengatasi loading selesai
  useEffect(() => {
    // Ketika pesan selesai dimuat atau terjadi error, hentikan loading
    if (selectedConversation && ((messages.length > 0 && !isLoading) || error)) {
      setIsLoadingConversation(false);
      // Scroll akan ditangani oleh efek scroll utama
    }
  }, [messages.length, isLoading, error, selectedConversation]);

  // Tambahkan flag untuk mencegah double fetch
  const [shouldFetchOrders, setShouldFetchOrders] = useState(false);

  // Tambahkan fungsi untuk mengambil data pesanan
  const fetchOrders = useCallback(async (userId: string) => {
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
  }, []);

  // Pisahkan effect untuk initial fetch dan mark as read
  useEffect(() => {
    if (selectedConversationData?.to_id && shouldFetchOrders) {
      fetchOrders(selectedConversationData.to_id.toString());
      setShouldFetchOrders(false); // Reset flag setelah fetch
    }
  }, [selectedConversationData?.to_id, shouldFetchOrders, fetchOrders]);

  // Tampilkan percakapan baru dari URL params
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
  }, [conversations, urlProcessed, handleConversationSelect, updateConversationList]);

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
    if (!selectedConversationData || !message.trim() || !selectedConversation) return;

    try {
      setIsSendingMessage(true);
      
      await sendMessageContext(
        selectedConversation, 
        message,
        (messageId) => {
          // Callback untuk sukses
          console.log('Message sent with ID:', messageId);
          
          // Tambahkan pesan ke daftar pesan
          const newSentMessage: Message = {
            id: messageId,
            sender: 'seller',
            content: message,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'text',
          };
          
          setMessages(prevMessages => [...prevMessages, newSentMessage]);
        }
      );
      
      // Update conversation list untuk menandai sudah dibalas
      updateConversationList({
        type: 'mark_as_read',
        conversation_id: selectedConversationData.conversation_id,
      });
    } catch (error) {
      console.error('Gagal mengirim pesan:', error);
      toast.error('Gagal mengirim pesan. Silakan coba lagi.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Fungsi untuk membuat objek pesan baru dari data SSE
  const createMessageFromSSE = useCallback((data: any): Message => {
    return {
      id: data.message_id,
      sender: data.sender === selectedShop ? 'seller' : 'buyer',
      type: data.message_type as any,
      content: ['text', 'image_with_text'].includes(data.message_type) 
            ? data.content.text 
        : data.message_type === 'order' 
              ? 'Menampilkan detail pesanan'
              : '',
      imageUrl: data.message_type === 'image' 
            ? data.content.url 
        : data.message_type === 'image_with_text' 
              ? data.content.image_url 
              : undefined,
      imageThumb: ['image', 'image_with_text'].includes(data.message_type) ? {
        url: data.message_type === 'image' 
              ? (data.content.thumb_url || data.content.url)
              : (data.content.thumb_url || data.content.image_url),
            height: data.content.thumb_height,
            width: data.content.thumb_width
          } : undefined,
      orderData: data.message_type === 'order' ? {
            shopId: data.content.shop_id,
            orderSn: data.content.order_sn
          } : undefined,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
  }, [selectedShop]);

  useEffect(() => {
    if (!selectedConversation) return;

    const handleSSEMessage = (event: CustomEvent) => {
      const data = event.detail;
      
      // Tangani pesan baru untuk percakapan yang sedang aktif
      if (data.type === 'new_message' && data.conversation_id === selectedConversation) {
        const newMessage = createMessageFromSSE(data);
        setMessages(prevMessages => [...prevMessages, newMessage]);
        
        // Jika pesan dari pembeli, otomatis tandai sebagai dibaca setelah jeda
        if (data.sender !== selectedShop) {
          setTimeout(() => {
            handleMarkAsRead(selectedConversation);
          }, 1500);
        }
      } 
      // Jika ada pesan baru untuk percakapan lain, dan tidak sedang melihat percakapan
      else if (data.type === 'new_message' && !selectedConversation && conversations.length > 0) {
        // Cek apakah percakapan baru sudah muncul di daftar
        const relatedConversation = conversations.find(
          conv => conv.conversation_id === data.conversation_id
        );
        
        if (relatedConversation) {
          // Buka percakapan dengan pesan baru jika belum ada percakapan yang dipilih
          handleConversationSelect(relatedConversation);
        }
      }
    };

    window.addEventListener('sse-message', handleSSEMessage as EventListener);
    return () => window.removeEventListener('sse-message', handleSSEMessage as EventListener);
  }, [selectedConversation, selectedShop, conversations, handleMarkAsRead, setMessages, handleConversationSelect, createMessageFromSSE]);

  // Tambahkan scroll saat pesan baru masuk
  useEffect(() => {
    // Scroll ke pesan terbaru dengan delay kecil agar konten dapat dirender dulu
    if (messages.length > 0 && !isLoading && messagesEndRef.current) {
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [messages.length, isLoading]);

  // Fungsi untuk debounce pencarian
  useEffect(() => {
    const timerId = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300); // Delay 300ms untuk input pencarian
    
    return () => clearTimeout(timerId);
  }, [searchInput, setSearchQuery]);

  // Tambahkan useMemo untuk format uniqueShops menjadi array objek
  const formattedUniqueShops = useMemo(() => {
    return uniqueShops.map(shopId => {
      const shopData = conversations.find(conv => conv.shop_id === shopId);
        return {
        id: shopId,
        name: shopData?.shop_name || `Toko ${shopId}`
      };
    });
  }, [uniqueShops, conversations]);

  // Optimasi untuk mencegah render berlebihan saat scroll
  const handleScroll = useCallback(() => {
    if (messagesEndRef.current && !isLoading) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [isLoading]);

  // Handler untuk menampilkan detail pesanan
  const handleShowOrderDetails = useCallback((orderSn: string) => {
    console.log(`Menampilkan detail pesanan ${orderSn}`);
    setActiveTab('orders');
  }, [setActiveTab]);

  // Ganti optimasi effect untuk scroll karena kita sudah menggunakan react-virtual
  useEffect(() => {
    // Tidak perlu scroll manual lagi, react-virtual menangani ini
  }, [messages.length, isLoading]);

  // Ganti useEffect pemilihan percakapan otomatis
  useEffect(() => {
    // Kita hilangkan fitur auto select percakapan atas
    // Hanya proses URL saja yang akan memilih percakapan otomatis
  }, [conversations.length, selectedConversation, urlProcessed, handleConversationSelect]);

  // Tambahkan pesan instruksi untuk tampilan awal
  if (!selectedConversation) {
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
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
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
                      {formattedUniqueShops.map(shop => (
                        <label key={shop.id} className="flex items-center mb-1">
                        <input
                          type="checkbox"
                            checked={state.selectedShops.includes(shop.id)}
                          onChange={() => {
                              // Perbaiki dengan mengirimkan array yang benar
                              const newSelectedShops = state.selectedShops.includes(shop.id)
                                ? state.selectedShops.filter(id => id !== shop.id)
                                : [...state.selectedShops, shop.id];
                              setShopFilter(newSelectedShops);
                          }}
                          className="mr-2"
                        />
                          {shop.name}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
              <Tabs value={state.statusFilter} onValueChange={(value) => setStatusFilter(value as 'SEMUA' | 'BELUM DIBACA' | 'BELUM DIBALAS')}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="SEMUA" className="text-xs">Semua</TabsTrigger>
                <TabsTrigger value="BELUM DIBACA" className="text-xs">Belum Dibaca</TabsTrigger>
                <TabsTrigger value="BELUM DIBALAS" className="text-xs">Belum Dibalas</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <ScrollArea className="flex-grow overflow-y-auto">
            <div className="p-3">
                {conversations.map((conversation, index) => (
                  <ConversationItem
                    key={conversation.conversation_id}
                    conversation={conversation}
                    isSelected={selectedConversation === conversation.conversation_id}
                    isMobileView={isMobileView}
                    onSelect={handleConversationSelect}
                  />
                ))}
                      </div>
            </ScrollArea>
          </div>
        )}

        {/* Tampilan instruksi saat belum ada chat yang dipilih */}
        <div className="flex-1 flex flex-col items-center justify-center min-w-0 h-full overflow-hidden">
          <div className="text-center space-y-4 max-w-md p-4">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
            <h3 className="text-lg font-medium">Pilih percakapan untuk memulai chat</h3>
            <p className="text-sm text-muted-foreground">
              Pilih salah satu percakapan dari daftar di sebelah kiri untuk mulai berkomunikasi dengan pelanggan Anda.
                      </p>
                    </div>
        </div>
      </div>
    );
  }

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
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
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
                    {formattedUniqueShops.map(shop => (
                      <label key={shop.id} className="flex items-center mb-1">
                        <input
                          type="checkbox"
                          checked={state.selectedShops.includes(shop.id)}
                          onChange={() => {
                            // Perbaiki dengan mengirimkan array yang benar
                            const newSelectedShops = state.selectedShops.includes(shop.id)
                              ? state.selectedShops.filter(id => id !== shop.id)
                              : [...state.selectedShops, shop.id];
                            setShopFilter(newSelectedShops);
                          }}
                          className="mr-2"
                        />
                        {shop.name}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
                    </div>
                    
            <Tabs value={state.statusFilter} onValueChange={(value) => setStatusFilter(value as 'SEMUA' | 'BELUM DIBACA' | 'BELUM DIBALAS')}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="SEMUA" className="text-xs">Semua</TabsTrigger>
                <TabsTrigger value="BELUM DIBACA" className="text-xs">Belum Dibaca</TabsTrigger>
                <TabsTrigger value="BELUM DIBALAS" className="text-xs">Belum Dibalas</TabsTrigger>
              </TabsList>
            </Tabs>
                  </div>

          <ScrollArea className="flex-grow overflow-y-auto">
            <div className="p-3">
              {conversations.map((conversation, index) => (
                <ConversationItem
                  key={conversation.conversation_id}
                  conversation={conversation}
                  isSelected={selectedConversation === conversation.conversation_id}
                  isMobileView={isMobileView}
                  onSelect={handleConversationSelect}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Area Chat dan Pesanan untuk Mobile */}
      {(!isMobileView || (isMobileView && !showConversationList)) && (
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Konten berdasarkan tab aktif untuk mobile */}
          {isMobileView ? (
            activeTab === 'chat' ? (
              <div className="flex flex-col w-full h-full overflow-hidden">
                {/* Header chat mobile */}
                <div className="border-b bg-background z-10 p-3 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                        // Hanya tampilkan daftar percakapan tanpa mereset selectedConversation
                    setShowConversationList(true);
                    setIsFullScreenChat(false);
                  }}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={selectedConversationData?.to_avatar} />
                      <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                    </Avatar>
                    <div className="overflow-hidden">
                      <p className="font-medium truncate text-sm">{selectedConversationData?.shop_name}</p>
                      <p className="font-bold truncate text-xs">{selectedConversationData?.to_name}</p>
                    </div>
                  </div>
                  
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
          </div>

                {/* Area isi chat */}
                <div className="flex-1 overflow-hidden min-h-0">
                  <ChatContent
                    messages={messages}
                    orders={orders}
                    isLoading={isLoading}
                    error={error}
                    hasMoreMessages={hasMoreMessages}
                    isLoadingConversation={isLoadingConversation}
                    messagesEndRef={messagesEndRef}
                    setActiveTab={setActiveTab}
                    onShowOrderDetails={handleShowOrderDetails}
                    selectedConversation={selectedConversation}
                                  />
                                </div>
                
                {/* Area Input */}
                <div className="p-4 py-3 border-t shrink-0">
                  <MessageInput 
                    onSendMessage={(message) => handleSendMessage(message)} 
                    isSendingMessage={isSendingMessage}
                  />
                </div>
              </div>
            ) : (
              <>
                {/* Header untuk tab orders */}
                <div className="border-b bg-background z-10 p-3 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => {
                        // Hanya tampilkan daftar percakapan tanpa mereset selectedConversation
                        setShowConversationList(true);
                        setIsFullScreenChat(false);
                      }}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={selectedConversationData?.to_avatar} />
                      <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                    </Avatar>
                    <div className="overflow-hidden">
                      <p className="font-medium truncate text-sm">{selectedConversationData?.shop_name}</p>
                      <p className="font-bold truncate text-xs">{selectedConversationData?.to_name}</p>
                          </div>
                        </div>
                        
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
                              </div>
                
                <ScrollArea className="flex-grow pt-2">
                  <OrderList orders={orders} isLoading={isLoadingOrders} />
              </ScrollArea>
              </>
            )
          ) : (
            <div className="flex flex-col w-full h-full overflow-hidden">
              {/* Header chat dekstop */}
              <div className="border-b bg-background z-10 p-3 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={selectedConversationData?.to_avatar} />
                    <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                  </Avatar>
                  <div className="overflow-hidden">
                    <p className="font-medium truncate text-sm">{selectedConversationData?.shop_name}</p>
                    <p className="font-bold truncate text-xs">{selectedConversationData?.to_name}</p>
                  </div>
                  </div>
                
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
                      </div>
              
              {activeTab === 'chat' ? (
                <>
                  {/* Area isi chat */}
                  <div className="flex-1 overflow-hidden min-h-0">
                    <ChatContent
                      messages={messages}
                      orders={orders}
                      isLoading={isLoading}
                      error={error}
                      hasMoreMessages={hasMoreMessages}
                      isLoadingConversation={isLoadingConversation}
                      messagesEndRef={messagesEndRef}
                      setActiveTab={setActiveTab}
                      onShowOrderDetails={handleShowOrderDetails}
                      selectedConversation={selectedConversation}
                                />
                              </div>
                  
                  {/* Area Input */}
                  <div className="p-4 py-3 border-t shrink-0">
                <MessageInput 
                  onSendMessage={(message) => handleSendMessage(message)} 
                  isSendingMessage={isSendingMessage}
                />
              </div>
            </>
              ) : (
                <ScrollArea className="flex-grow pt-2">
                  <OrderList orders={orders} isLoading={isLoadingOrders} />
                </ScrollArea>
              )}
            </div>
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
          <ScrollArea className="flex-grow pt-2">
            <OrderList orders={orders} isLoading={isLoadingOrders} />
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

export default WebChatPage;
