'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, User as UserIcon, X, Minimize, Maximize, MinusSquare, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

// Definisikan tipe Message yang sesuai dengan respons API
interface MessageContent {
  text?: string;
  sticker_id?: string;
  sticker_package_id?: string;
  image_url?: string;
  url?: string;              // Tambahkan untuk pesan tipe 'image'
  thumb_url?: string;        // Tambahkan untuk thumbnail
  thumb_height?: number;     // Dimensi thumbnail
  thumb_width?: number;      // Dimensi thumbnail
  order_sn?: string;         // Tambahkan untuk tipe pesan 'order'
  shop_id?: number;          // Tambahkan untuk tipe pesan 'order'
}

interface Message {
  message_id: string;
  from_id: number;
  to_id: number;
  from_shop_id: number;
  to_shop_id: number;
  message_type: string;
  content: MessageContent;
  conversation_id: string;
  created_timestamp: number;
  region: string;
  status: string;
  message_option: number;
  source: string;
  source_content: any;
  quoted_msg: any;
}

// Perluas interface ChatMetadata untuk menyertakan orderStatus
interface ChatMetadata {
  orderId?: string;
  productId?: string;
  source?: string;
  timestamp?: string;
  orderStatus?: string; // Tambahkan orderStatus
}

// Pisahkan komponen input untuk mengurangi re-render
const ChatInput = React.memo(({ 
  onSend, 
  isLoading 
}: { 
  onSend: (message: string) => void;
  isLoading: boolean;
}) => {
  const [inputValue, setInputValue] = useState('');
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);
  
  const handleSend = useCallback(() => {
    if (inputValue.trim()) {
      onSend(inputValue);
      setInputValue('');
    }
  }, [inputValue, onSend]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);
  
  return (
    <div className="flex items-center gap-2 p-1.5 border-t">
      <Input
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Ketik pesan..."
        className="flex-1 h-7 text-xs py-1 px-2"
        autoComplete="off"
        disabled={isLoading}
      />
      <Button 
        onClick={handleSend}
        disabled={!inputValue.trim() || isLoading}
        className="h-6 w-6 p-0 flex items-center justify-center"
        size="sm"
      >
        {isLoading ? (
          <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
        ) : (
          <Send size={10} />
        )}
      </Button>
    </div>
  );
});

ChatInput.displayName = 'ChatInput';

// Pisahkan komponen pesan untuk mengurangi re-render
const ChatMessage = React.memo(({ 
  message, 
  shopId
}: { 
  message: Message;
  shopId: number;
}) => {
  // Cek apakah pesan dari penjual (toko kita)
  const isSeller = message.from_shop_id === shopId;
  const messageDate = new Date(message.created_timestamp * 1000);
  const formattedTime = messageDate.toLocaleTimeString('id-ID', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  // Render konten berdasarkan tipe pesan
  const renderContent = () => {
    switch (message.message_type) {
      case 'text':
        return <div className="text-xs">{message.content.text}</div>;
      case 'sticker':
        return message.content.image_url ? (
          <img 
            src={message.content.image_url} 
            alt="Sticker" 
            className="max-w-[80px] max-h-[80px]" 
          />
        ) : (
          <div className="text-xs">Sticker</div>
        );
      case 'image':
        return message.content.url ? (
          <img 
            src={message.content.url} 
            alt="Gambar" 
            className="max-w-[80px] max-h-[80px] rounded-md" 
          />
        ) : (
          <div className="text-xs">Gambar tidak tersedia</div>
        );
      case 'image_with_text':
        return (
          <div>
            {message.content.image_url && (
              <img 
                src={message.content.image_url} 
                alt="Gambar dengan teks" 
                className="max-w-[80px] max-h-[80px] rounded-md mb-1" 
              />
            )}
            {message.content.text && (
              <div className="text-xs">{message.content.text}</div>
            )}
          </div>
        );
      case 'order':
        return (
          <div className="text-xs">
            <div className="font-medium mb-0.5">Detail Pesanan</div>
            {message.content.order_sn && (
              <div className="text-[10px] font-mono">{message.content.order_sn}</div>
            )}
          </div>
        );
      default:
        return <div className="text-xs">Pesan tidak didukung</div>;
    }
  };
  
  return (
    <div className={`flex ${isSeller ? 'justify-end' : 'justify-start'} mb-1.5`}>
      <div className={`max-w-[80%] p-1.5 rounded-lg ${
        isSeller 
          ? 'bg-blue-600 text-white dark:bg-blue-700' 
          : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
      }`}>
        {renderContent()}
        <div className={`text-[10px] mt-0.5 ${
          isSeller 
            ? 'text-blue-100 dark:text-blue-200' 
            : 'text-gray-500 dark:text-gray-400'
        }`}>
          {formattedTime}
        </div>
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

// Definisikan props untuk komponen Avatar
interface AvatarProps {
  src: string | undefined | null;
  name: string;
  size?: number;
  className?: string;
}

// Komponen Avatar dengan fallback ke ikon Lucide
const Avatar = React.memo(({ 
  src, 
  name, 
  size = 5,
  className = ""
}: AvatarProps) => {
  const [hasError, setHasError] = useState(!src);
  
  // Reset error state jika src berubah
  useEffect(() => {
    setHasError(!src);
  }, [src]);
  
  if (hasError) {
    return (
      <div className={`w-${size} h-${size} rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center ${className}`}>
        <UserIcon size={size * 3} className="text-gray-500 dark:text-gray-400" strokeWidth={1.5} />
      </div>
    );
  }
  
  return (
    <img 
      src={src || ''}
      alt={name}
      className={`w-${size} h-${size} rounded-full ${className}`}
      onError={() => setHasError(true)}
    />
  );
});

Avatar.displayName = 'Avatar';

interface MiniChatProps {
  conversationId: string;
  shopId: number;
  toId: number;
  toName: string;
  toAvatar: string;
  shopName: string;
  isMinimized: boolean;
  metadata?: ChatMetadata;
  onClose: () => void;
  onMinimize: () => void;
  position?: number;
}

const MiniChat = React.memo(({
  conversationId,
  shopId: propShopId,
  toId: propToId,
  toName,
  toAvatar,
  shopName,
  isMinimized,
  metadata,
  onClose,
  onMinimize,
  position = 0
}: MiniChatProps) => {
  // Konversi ke angka jika belum
  const shopId = typeof propShopId === 'number' ? propShopId : Number(propShopId);
  const toId = typeof propToId === 'number' ? propToId : Number(propToId);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [processedOrderSns, setProcessedOrderSns] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Fungsi untuk mengambil pesan
  const fetchMessages = useCallback(async () => {
    if (!conversationId || !shopId) return;
    
    try {
      setIsLoading(true);
      
      const response = await fetch(`/api/msg/get_message?conversationId=${conversationId}&shopId=${shopId}&pageSize=25`);
      
      if (!response.ok) {
        throw new Error('Gagal mengambil pesan');
      }
      
      const data = await response.json();
      
      if (data && data.response && data.response.messages) {
        // Urutkan pesan dari yang terlama ke terbaru
        const sortedMessages = [...data.response.messages].sort((a, b) => 
          a.created_timestamp - b.created_timestamp
        );
        
        setMessages(sortedMessages);
      } else {
        console.error('Format respons tidak sesuai:', data);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Gagal mengambil pesan');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, shopId]);
  
  // Ambil pesan saat komponen dimuat
  useEffect(() => {
    if (conversationId && shopId && !isMinimized) {
      fetchMessages();
    }
  }, [conversationId, shopId, fetchMessages, isMinimized]);
  
  // Fungsi untuk mengirim pesan
  const handleSendMessage = useCallback(async (content: string) => {
    try {
      setIsSending(true);
      
      // Log parameter untuk debugging
      console.log('Parameter untuk pengiriman pesan:', {
        toId,
        shopId,
        conversationId,
        message: content
      });
      
      // Format permintaan yang benar untuk API
      const response = await fetch('/api/msg/send_message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toId: toId, // Menggunakan toId sebagai tujuan pengiriman
          shopId: shopId,
          messageType: 'text',
          content: content // atau gunakan 'text' jika API meminta format berbeda
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal mengirim pesan');
      }
      
      // Tambahkan pesan ke state lokal sementara
      const tempMessage: Message = {
        message_id: `temp_${Date.now()}`,
        from_id: shopId,
        to_id: toId,
        from_shop_id: shopId,
        to_shop_id: 0, // Tidak tahu to_shop_id, akan diupdate saat refresh
        message_type: 'text',
        content: { text: content },
        conversation_id: conversationId,
        created_timestamp: Math.floor(Date.now() / 1000),
        region: 'ID',
        status: 'normal',
        message_option: 0,
        source: 'web',
        source_content: {},
        quoted_msg: null
      };
      
      setMessages(prev => [...prev, tempMessage]);
      
      // Refresh pesan setelah mengirim untuk mendapatkan data lengkap
      setTimeout(() => {
        fetchMessages();
      }, 1000);
      
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(error instanceof Error ? error.message : 'Gagal mengirim pesan');
    } finally {
      setIsSending(false);
    }
  }, [conversationId, shopId, toId, fetchMessages]);
  
  // Scroll ke bawah saat ada pesan baru
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);
  
  // Modifikasi fungsi pembatalan - hapus pesan konfirmasi dalam chat
  const handleCancellationAction = useCallback(async (orderSn: string, action: 'ACCEPT' | 'REJECT') => {
    try {
      setLoadingAction(action);
      
      const response = await fetch('/api/orders/handle-cancellation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shopId,
          orderSn,
          operation: action
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Gagal memproses pembatalan');
      }
      
      // Tandai pesanan sebagai sudah diproses
      setProcessedOrderSns(prev => [...prev, orderSn]);
      
      // Tampilkan pesan sukses via toast saja, tanpa tambah pesan ke chat
      toast.success(`Berhasil ${action === 'ACCEPT' ? 'menerima' : 'menolak'} pembatalan`);
      
      // Tidak perlu menambahkan pesan konfirmasi ke chat
      // Tidak perlu merefresh messages
      
    } catch (error) {
      console.error('Gagal memproses pembatalan:', error);
      toast.error(error instanceof Error ? error.message : 'Gagal memproses pembatalan');
    } finally {
      setLoadingAction(null);
    }
  }, [shopId, toId]);
  
  // Jika diminimalkan, tampilkan hanya header
  if (isMinimized) {
    return (
      <div 
        className="flex items-center justify-between p-2 border border-gray-100 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 w-64 z-50 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)]"
        style={{ right: `${position * 17}rem` }}
      >
        <div className="flex items-center">
          <Avatar src={toAvatar} name={toName} size={5} className="mr-1.5" />
          <div>
            <div className="text-xs font-medium dark:text-white truncate max-w-[120px]">{toName}</div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[120px]">{shopName}</div>
          </div>
        </div>
        <div className="flex items-center">
          <button onClick={onMinimize} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700/70 rounded-full transition-colors">
            <MinusSquare size={14} className="text-gray-600 dark:text-gray-400" />
          </button>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700/70 rounded-full transition-colors">
            <X size={14} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      className="flex flex-col w-64 h-96 border border-gray-100 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 z-50 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)]"
      style={{ right: `${position * 17}rem` }}
    >
      {/* Header dengan visual yang disederhanakan */}
      <div className="flex items-center justify-between p-2 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-lg">
        <div className="flex items-center">
          <Avatar 
            src={toAvatar} 
            name={toName} 
            size={5} 
            className="mr-1.5"
          />
          <div>
            <div className="text-xs font-medium dark:text-white truncate max-w-[120px]">{toName}</div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[120px]">{shopName}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={fetchMessages} 
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700/70 rounded-full transition-colors"
            disabled={isLoading}
            title="Refresh pesan"
          >
            <RefreshCw size={14} className={`${isLoading ? "animate-spin" : ""} text-gray-600 dark:text-gray-400`} />
          </button>
          <button onClick={onMinimize} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700/70 rounded-full transition-colors">
            <MinusSquare size={14} className="text-gray-600 dark:text-gray-400" />
          </button>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700/70 rounded-full transition-colors">
            <X size={14} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>
      
      {/* Tampilkan metadata order jika ada - dengan desain yang lebih clean */}
      {metadata?.orderId && (
        <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900/50 text-[10px] text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center">
            <span className="font-medium">Order:</span>
            <span className="ml-1 truncate font-mono">{metadata.orderId}</span>
          </div>
          
          {/* Cek apakah pesanan sedang memiliki status IN_CANCEL dan belum diproses */}
          {metadata?.orderStatus === 'IN_CANCEL' && !processedOrderSns.includes(metadata.orderId!) && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 p-0 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancellationAction(metadata.orderId!, 'ACCEPT');
                }}
                title="Terima Pembatalan"
                disabled={loadingAction !== null}
              >
                {loadingAction === 'ACCEPT' ? (
                  <div className="h-2 w-2 rounded-full border border-green-600 border-t-transparent animate-spin" />
                ) : (
                  <CheckCircle size={12} className="text-green-600 dark:text-green-400" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 p-0 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancellationAction(metadata.orderId!, 'REJECT');
                }}
                title="Tolak Pembatalan"
                disabled={loadingAction !== null}
              >
                {loadingAction === 'REJECT' ? (
                  <div className="h-2 w-2 rounded-full border border-red-600 border-t-transparent animate-spin" />
                ) : (
                  <XCircle size={12} className="text-red-600 dark:text-red-400" />
                )}
              </Button>
            </div>
          )}
        </div>
      )}
      
      {/* Messages area */}
      <div className="flex-1 p-2 overflow-y-auto bg-white dark:bg-gray-800">
        {isLoading && messages.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center items-center h-full text-gray-400 text-xs">
            Belum ada pesan
          </div>
        ) : (
          messages.map(message => (
            <ChatMessage 
              key={message.message_id} 
              message={message} 
              shopId={shopId}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input dengan styling yang sederhana */}
      <div className="border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-lg">
        <ChatInput onSend={handleSendMessage} isLoading={isSending} />
      </div>
    </div>
  );
});

MiniChat.displayName = 'MiniChat';

export default MiniChat; 