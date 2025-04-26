'use client'
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, User as UserIcon, X, Minimize, Maximize, MinusSquare, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import useStoreChat, { ChatState, ChatActions } from '@/stores/useStoreChat';
import { ShopeeMessage, UIMessage, convertToUIMessage } from '@/types/shopeeMessage';
import CustomImageLightbox from '@/components/CustomImageLightbox';

// Gunakan tipe dari store
type StoreChatType = ChatState & ChatActions;

// Definisikan tipe Message yang sesuai dengan respons API
interface MessageContent {
  text?: string;
  sticker_id?: string;
  sticker_package_id?: string;
  image_url?: string;
  url?: string;
  thumb_url?: string;
  thumb_height?: number;
  thumb_width?: number;
  order_sn?: string;
  shop_id?: number;
  item_id?: number;
}

interface Message extends ShopeeMessage {}



// Tambahkan interface ItemDetail
interface ItemDetail {
  item_id: number;
  item_sku: string;
  item_name: string;
  image: {
    image_ratio: string;
    image_id_list: string[];
    image_url_list: string[];
  };
}

// Tambahkan tipe untuk state chat
interface ChatWindow {
  conversationId: string;
  toId: number;
  shopId: number;
  toName: string;
  toAvatar: string;
  shopName: string;
  metadata?: Record<string, unknown>;
}

interface SendMessageParams {
  conversationId: string;
  content: string;
  toId: number;
  shopId: number;
}

// Tambahkan interface OrderDetail
interface Order {
  shop_name: string;
  order_sn: string;
  order_status: string;
  total_amount: number;
  shipping_carrier: string;
  payment_method: string;
  order_items: OrderItem[];
  tracking_number: string;
}

interface OrderItem {
  item_id: number;
  item_name: string;
  model_name: string;
  model_quantity_purchased: number;
  model_discounted_price: number;
  model_original_price: number;
  image_url: string;
  item_sku: string;
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

// Komponen ItemPreview
const ItemPreview = React.memo(({ itemId }: { itemId: number }) => {
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchItem = async () => {
      try {
        const response = await fetch(`/api/get_sku?item_ids=${itemId}`);
        const data = await response.json();
        if (data.items?.[0]) {
          setItem(data.items[0]);
        }
      } catch (error) {
        console.error('Error fetching item:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchItem();
  }, [itemId]);

  if (isLoading) {
    return (
      <div className="flex gap-2 items-center p-1.5 bg-gray-100 dark:bg-gray-700/50 rounded-md mt-1">
        <div className="h-8 w-8 rounded bg-gray-200 dark:bg-gray-600 animate-pulse" />
        <div className="space-y-1 flex-1">
          <div className="h-2 w-3/4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
          <div className="h-2 w-1/2 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!item) return null;

  // Ambil gambar pertama dari list
  const imageUrl = item.image.image_url_list[0];

  return (
    <div className="flex gap-2 items-center p-1.5 bg-gray-100 dark:bg-gray-700/50 rounded-md mt-1">
      <img 
        src={imageUrl} 
        alt={item.item_name}
        className="h-8 w-8 object-cover rounded"
      />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium line-clamp-2">{item.item_name}</p>
        <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">SKU: {item.item_sku}</p>
      </div>
    </div>
  );
});
ItemPreview.displayName = 'ItemPreview';

// Tambahkan komponen Lightbox
const Lightbox = React.memo(({ 
  isOpen, 
  onClose, 
  imageUrl 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  imageUrl: string; 
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div className="relative max-w-[90vw] max-h-[90vh]">
        <img 
          src={imageUrl} 
          alt="Preview" 
          className="max-w-full max-h-[90vh] object-contain"
          onClick={(e) => e.stopPropagation()}
        />
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 p-1 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
        >
          <X size={20} className="text-white" />
        </button>
      </div>
    </div>
  );
});
Lightbox.displayName = 'Lightbox';

// Komponen untuk render message content
const MessageContent = React.memo(({ message, uiMessage }: { message: Message; uiMessage: UIMessage }) => {
  switch (uiMessage.type) {
    case 'text':
      return (
        <div className="text-xs">
          {uiMessage.content}
        </div>
      );
    
    case 'order':
      return (
        <div className="text-xs">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-3 h-3 rounded-full bg-blue-500/20 flex items-center justify-center">
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1 4L3 6L7 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-medium">Detail Pesanan</span>
          </div>
          {uiMessage.orderData?.orderSn && (
            <div className="flex items-center gap-1.5 bg-blue-100 dark:bg-gray-700/50 px-2 py-1 rounded-md">
              <span className="text-[10px] text-blue-600 dark:text-gray-400 font-medium">ORDER SN:</span>
              <span className="text-[10px] font-mono font-medium text-blue-700 dark:text-gray-200">
                {uiMessage.orderData.orderSn}
              </span>
            </div>
          )}
        </div>
      );
    
    default:
      return (
        <div className="text-xs text-gray-500">
          {uiMessage.content || `Tipe pesan tidak didukung: ${uiMessage.type}`}
        </div>
      );
  }
});

MessageContent.displayName = 'MessageContent';

// Komponen untuk render single message dengan bubble
const MessageBubble = React.memo(({ 
  message,
  shopId,
  orders = [] // Tambahkan orders sebagai parameter opsional
}: { 
  message: Message;
  shopId: number;
  orders?: Order[];
}) => {
  const uiMessage = useMemo(() => convertToUIMessage(message, shopId), [message, shopId]);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isOrderExpanded, setIsOrderExpanded] = useState(false);
  
  // Cek jika message memiliki source_content dengan order_sn
  const hasOrderReference = uiMessage.type === 'order' || 
    (uiMessage.sourceContent && uiMessage.sourceContent.order_sn);
  
  // Ambil order_sn baik dari orderData atau sourceContent
  const orderSn = uiMessage.orderData?.orderSn || 
    (uiMessage.sourceContent && uiMessage.sourceContent.order_sn);
  
  // Dapatkan informasi order jika tersedia
  const orderInfo = useMemo(() => {
    if (!orderSn || !orders.length) return null;
    return orders.find(o => o.order_sn === orderSn);
  }, [orderSn, orders]);
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return `Rp${amount.toLocaleString('id-ID')}`;
  };
  
  return (
    <div className={`flex ${uiMessage.sender === 'seller' ? 'justify-end' : 'justify-start'} mb-1.5`}>
      <div className={`max-w-[80%] p-1.5 rounded-lg ${
        uiMessage.sender === 'seller'
          ? 'bg-blue-600 text-white dark:bg-blue-700' 
          : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
      }`}>
        {/* Handle text messages */}
        {uiMessage.type === 'text' ? (
          <div className="text-xs">
            <p className="break-words whitespace-pre-wrap">{uiMessage.content}</p>
            
            {/* Cek jika ada item_id di sourceContent */}
            {uiMessage.sourceContent?.item_id && (
              <ItemPreview itemId={uiMessage.sourceContent.item_id} />
            )}
            
            {/* Tambahkan penanganan untuk source_content.order_sn */}
            {uiMessage.sourceContent?.order_sn && (
              <div className="flex flex-col mt-1 bg-blue-500/20 dark:bg-gray-600/30 rounded p-1.5">
                {/* Header order yang selalu ditampilkan */}
                <div 
                  className="flex items-center justify-between w-full cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setIsOrderExpanded(!isOrderExpanded)}
                >
                  <div className="flex items-center gap-1.5 mr-2 flex-1 min-w-0">
                    <div className="w-3 h-3 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1 4L3 6L7 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span className="break-words text-[10px] font-medium truncate">
                      Pesanan #{uiMessage.sourceContent.order_sn}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {orderInfo && orderInfo.order_status && (
                      <span className={`text-[8px] px-1 py-0.5 rounded-full leading-none ${
                        orderInfo.order_status === 'PAID'
                          ? 'bg-green-500 text-white'
                          : orderInfo.order_status === 'UNPAID'
                          ? 'bg-yellow-500 text-white'
                          : orderInfo.order_status === 'CANCELLED'
                          ? 'bg-red-500 text-white'
                          : orderInfo.order_status === 'COMPLETED'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-500 text-white'
                      }`}>
                        {orderInfo.order_status}
                      </span>
                    )}
                    
                    {/* Indikator expand/collapse */}
                    <div className="text-current opacity-70">
                      {isOrderExpanded ? (
                        <svg width="8" height="5" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <svg width="8" height="5" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
        </div>
      </div>
    </div>
                
                {/* Detail order yang hanya ditampilkan jika di-expand */}
                {isOrderExpanded && orderInfo && (
                  <div className={`ml-4 text-[10px] space-y-0.5 mt-1 ${uiMessage.sender === 'seller' ? 'text-blue-100' : 'text-gray-600 dark:text-gray-300'}`}>
                    <div className="flex justify-between items-center">
                      <span>Pembayaran:</span>
                      <span className="text-[9px]">{orderInfo.payment_method}</span>
                    </div>
                    
                    {/* Items in order */}
                    {orderInfo.order_items && orderInfo.order_items.length > 0 && (
                      <div>
                        {orderInfo.order_items.map((item, index) => (
                          <div key={`${item.item_id}-${index}`} className="text-[9px] mt-1">
                            <div className="flex items-start gap-1">
                              {item.image_url && (
                                <img 
                                  src={item.image_url} 
                                  alt={item.item_name}
                                  className="w-6 h-6 object-cover rounded-sm flex-shrink-0"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="line-clamp-1 font-medium flex-1">{item.item_name}</p>
                                  <span className="opacity-90 ml-1 flex-shrink-0">x{item.model_quantity_purchased}</span>
                                </div>
                                <div className="flex justify-between items-center mt-0.5">
                                  <span className="opacity-90 line-clamp-1 flex-1">
                                    {item.item_sku ? `SKU: ${item.item_sku}` : item.model_name}
                                  </span>
                                  <div className="flex flex-col items-end ml-1 flex-shrink-0">
                                    <span className="text-[8px] line-through opacity-70">{formatCurrency(item.model_original_price)}</span>
                                    <span className="font-medium">{formatCurrency(item.model_discounted_price)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Total di bagian bawah */}
                    <div className="flex justify-between border-t border-current opacity-30 pt-1 mt-1">
                      <span>Total:</span>
                      <span className="font-medium">{formatCurrency(orderInfo.total_amount)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Handle image messages */
          (uiMessage.type === 'image' || uiMessage.type === 'image_with_text') && uiMessage.imageUrl ? (
            <div className="space-y-1">
              <div className="relative">
                <img
                  src={uiMessage.imageUrl}
                  alt="Pesan gambar"
                  className="rounded max-w-full cursor-pointer hover:opacity-90 transition-opacity"
                  style={{
                    maxHeight: '150px',
                    width: 'auto',
                    maxWidth: '100%',
                    aspectRatio: uiMessage.imageThumb ? `${uiMessage.imageThumb.width}/${uiMessage.imageThumb.height}` : 'auto'
                  }}
                  onClick={() => setIsLightboxOpen(true)}
                />
                
                <CustomImageLightbox
                  isOpen={isLightboxOpen}
                  onClose={() => setIsLightboxOpen(false)}
                  imageUrl={uiMessage.imageUrl}
                  altText={uiMessage.type === 'image_with_text' ? uiMessage.content : 'Pesan gambar'}
                />
              </div>
              {uiMessage.type === 'image_with_text' && uiMessage.content && (
                <p className="text-xs break-words whitespace-pre-wrap mt-1">{uiMessage.content}</p>
              )}
            </div>
          ) : (
            /* Handle order messages */
            uiMessage.type === 'order' && uiMessage.orderData ? (
              <div className="flex flex-col text-xs">
                {/* Header order yang selalu ditampilkan */}
                <div 
                  className="flex items-center justify-between w-full cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setIsOrderExpanded(!isOrderExpanded)}
                >
                  <div className="flex items-center gap-1.5 mr-2 flex-1 min-w-0">
                    <div className="w-3 h-3 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1 4L3 6L7 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span className="break-words font-medium truncate">
                      Pesanan #{uiMessage.orderData.orderSn}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {orderInfo && orderInfo.order_status && (
                      <span className={`text-[8px] px-1 py-0.5 rounded-full leading-none ${
                        orderInfo.order_status === 'PAID'
                          ? 'bg-green-500 text-white'
                          : orderInfo.order_status === 'UNPAID'
                          ? 'bg-yellow-500 text-white'
                          : orderInfo.order_status === 'CANCELLED'
                          ? 'bg-red-500 text-white'
                          : orderInfo.order_status === 'COMPLETED'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-500 text-white'
                      }`}>
                        {orderInfo.order_status}
                      </span>
                    )}
                    
                    {/* Indikator expand/collapse */}
                    <div className="text-current opacity-70">
                      {isOrderExpanded ? (
                        <svg width="8" height="5" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <svg width="8" height="5" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
      </div>
                  </div>
                </div>
                
                {/* Detail order yang hanya ditampilkan jika di-expand */}
                {isOrderExpanded && orderInfo && (
                  <div className={`ml-4 text-[10px] space-y-0.5 mt-1 ${uiMessage.sender === 'seller' ? 'text-blue-100' : 'text-gray-600 dark:text-gray-300'}`}>
                    <div className="flex justify-between items-center">
                      <span>Pembayaran:</span>
                      <span className="text-[9px]">{orderInfo.payment_method}</span>
                    </div>
                    
                    {/* Items in order */}
                    {orderInfo.order_items && orderInfo.order_items.length > 0 && (
                      <div>
                        {orderInfo.order_items.map((item, index) => (
                          <div key={`${item.item_id}-${index}`} className="text-[9px] mt-1">
                            <div className="flex items-start gap-1">
                              {item.image_url && (
                                <img 
                                  src={item.image_url} 
                                  alt={item.item_name}
                                  className="w-6 h-6 object-cover rounded-sm flex-shrink-0"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="line-clamp-1 font-medium flex-1">{item.item_name}</p>
                                  <span className="opacity-90 ml-1 flex-shrink-0">x{item.model_quantity_purchased}</span>
                                </div>
                                <div className="flex justify-between items-center mt-0.5">
                                  <span className="opacity-90 line-clamp-1 flex-1">
                                    {item.item_sku ? `SKU: ${item.item_sku}` : item.model_name}
                                  </span>
                                  <div className="flex flex-col items-end ml-1 flex-shrink-0">
                                    <span className="text-[8px] line-through opacity-70">{formatCurrency(item.model_original_price)}</span>
                                    <span className="font-medium">{formatCurrency(item.model_discounted_price)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Total di bagian bawah */}
                    <div className="flex justify-between border-t border-current opacity-30 pt-1 mt-1">
                      <span>Total:</span>
                      <span className="font-medium">{formatCurrency(orderInfo.total_amount)}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Handle item messages */
              uiMessage.type === 'item' && uiMessage.itemData ? (
                <div className="flex flex-col text-xs">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-3 h-3 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1 4L3 6L7 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span className="font-medium">Detail Produk</span>
                  </div>
                  <ItemPreview itemId={uiMessage.itemData.itemId} />
                </div>
              ) : (
                /* Handle sticker messages */
                uiMessage.type === 'sticker' && uiMessage.stickerData ? (
                  <div className="flex flex-col items-center justify-center">
                    <img
                      src={message.content.image_url || `https://deo.shopeemobile.com/shopee/shopee-sticker-live-id/packs/${uiMessage.stickerData.packageId}/${uiMessage.stickerData.stickerId}@1x.png`}
                      alt="Stiker"
                      className="w-16 h-16 object-contain"
                    />
                    <p className="text-[10px] mt-1 opacity-70">Stiker</p>
                  </div>
                ) : (
                  /* Default fallback for unsupported message types */
                  <div className="text-xs text-gray-500">
                    {uiMessage.content || `Tipe pesan tidak didukung: ${uiMessage.type}`}
                  </div>
                )
              )
            )
          )
        )}
        
        {/* Message timestamp */}
        <div className={`text-[10px] mt-0.5 ${
          uiMessage.sender === 'seller'
            ? 'text-blue-100 dark:text-blue-200' 
            : 'text-gray-500 dark:text-gray-400'
        }`}>
          {uiMessage.time}
        </div>
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

// Optimasi MessageList dengan memo dan logging yang lebih baik
const MessageList = React.memo(({ 
  messages, 
  shopId,
  orders = [] // Tambahkan orders sebagai parameter opsional
}: { 
  messages: Message[];
  shopId: number;
  orders?: Order[];
}) => {
  // Log sekali saat messages berubah
  const messagesRef = useRef(messages);
  useEffect(() => {
    if (messagesRef.current !== messages) {
      console.log('[MiniChat] Messages diupdate:', messages.map(msg => ({
        id: msg.message_id,
        type: msg.message_type,
        sender: msg.from_shop_id === shopId ? 'seller' : 'buyer',
        timestamp: new Date(msg.created_timestamp * 1000).toLocaleString(),
        preview: msg.message_type === 'text' ? 
          msg.content.text?.slice(0, 30) + '...' : 
          msg.message_type === 'order' ? 
          `Order: ${msg.content.order_sn}` : 
          msg.message_type
      })));
      messagesRef.current = messages;
    }
  }, [messages, shopId]);

  return (
    <>
      {messages.map(message => (
        <MessageBubble 
          key={message.message_id} 
          message={message} 
          shopId={shopId}
          orders={orders}
        />
      ))}
    </>
  );
});

MessageList.displayName = 'MessageList';

interface MiniChatProps {
  conversationId?: string;
  shopId: number;
  toId: number;
  toName: string;
  toAvatar: string;
  shopName: string;
  isMinimized: boolean;
  metadata?: {
    orderId?: string;
    productId?: string;
    orderStatus?: string;
    source?: string;
    timestamp?: string;
  };
  onClose: () => void;
  onMinimize: () => void;
  position?: number;
  onConversationInitialized?: (conversationId: string) => void;
}

const MiniChat = React.memo(({
  conversationId: initialConversationId,
  shopId,
  toId,
  toName,
  toAvatar,
  shopName,
  isMinimized,
  metadata,
  onClose,
  onMinimize,
  position = 0,
  onConversationInitialized
}: MiniChatProps) => {
  // State untuk tracking conversation
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [processedOrderSns, setProcessedOrderSns] = useState<string[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);
  
  // Gunakan store chat dengan tipe yang benar
  const { 
    initializeConversation,
    sendMessage: sendMessageToStore,
    lastMessage,
    isInitializing: storeIsInitializing,
    fetchMessages,
  } = useStoreChat() as StoreChatType;
  
  // State untuk menyimpan pesan lokal
  const [localMessages, setLocalMessages] = useState<ShopeeMessage[]>([]);
  
  // Set untuk melacak pesan yang sudah diproses
  const [processedSSEMessages] = useState<Set<string>>(new Set());
  
  // Pantau lastMessage dari SSE untuk update realtime
  useEffect(() => {
    // Jika tidak ada lastMessage atau tidak ada conversationId, abaikan
    if (!lastMessage?.message_id || !conversationId) return;
    
    // Periksa apakah pesan ini untuk percakapan yang saat ini terbuka
    if (lastMessage.conversation_id !== conversationId) return;
    
    // Periksa apakah pesan ini sudah pernah diproses sebelumnya
    if (processedSSEMessages.has(lastMessage.message_id)) return;
    
    console.log('[MiniChat] Menerima pesan baru dari SSE:', { 
      id: lastMessage.message_id,
      type: lastMessage.message_type,
      sender: lastMessage.sender
    });
    
    // Tambahkan pesan ke daftar yang sudah diproses
    processedSSEMessages.add(lastMessage.message_id);
    
    // Buat objek ShopeeMessage dari data SSE
    const newMessage: ShopeeMessage = {
      message_id: lastMessage.message_id,
      conversation_id: lastMessage.conversation_id,
      from_id: lastMessage.sender,
      to_id: lastMessage.receiver || toId,
      from_shop_id: lastMessage.sender === shopId ? lastMessage.shop_id : 0,
      to_shop_id: lastMessage.sender !== shopId ? lastMessage.shop_id : 0,
      message_type: lastMessage.message_type as any,
      content: lastMessage.content || {},
      created_timestamp: lastMessage.timestamp || Math.floor(Date.now() / 1000),
      region: "",
      status: "received",
      message_option: 0,
      source: "sse",
      source_content: {},
      quoted_msg: null
    };
    
    // Periksa apakah pesan sudah ada di daftar pesan lokal
    const messageExists = localMessages.some(msg => msg.message_id === lastMessage.message_id);
    
    if (!messageExists) {
      // Tambahkan pesan baru ke daftar pesan lokal
      setLocalMessages(prev => [...prev, newMessage]);
      
      // Scroll ke pesan terbaru
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      
      console.log('[MiniChat] Pesan baru berhasil ditambahkan ke state lokal');
    }
  }, [lastMessage, conversationId, processedSSEMessages, localMessages, shopId, toId]);
  
  // Tambahkan state untuk menyimpan daftar pesanan
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  
  // Fungsi untuk mengambil data pesanan
  const fetchOrders = useCallback(async (userId: number) => {
    if (!userId) return;
    
    try {
      setIsLoadingOrders(true);
      const response = await fetch(`/api/order_details?user_id=${userId}`);
      const data = await response.json();
      setOrders(data.data || []);
    } catch (error) {
      console.error('[MiniChat] Error fetching orders:', error);
    } finally {
      setIsLoadingOrders(false);
    }
  }, []);
  
  // Panggil fetchOrders saat percakapan dimulai
  useEffect(() => {
    if (toId && !isMinimized) {
      fetchOrders(toId);
    }
  }, [toId, isMinimized, fetchOrders]);
  
  // Effect untuk setup dan fetch messages saat pertama kali
  useEffect(() => {
    const setupAndFetch = async () => {
      try {
        setIsLoading(true);

        let targetId = initialConversationId;

        // Jika tidak ada initialConversationId, coba inisialisasi baru
        if (!targetId && !isMinimized && toId && shopId && metadata?.orderId) {
          console.log('[MiniChat] Menginisialisasi percakapan baru');
          console.log('[MiniChat] Mencoba inisialisasi dengan:', { 
            userId: toId, 
            shopId, 
            orderSn: metadata.orderId 
          });

          targetId = await initializeConversation({
            userId: toId.toString(),
            shopId: shopId.toString(),
            orderSn: metadata.orderId
          });

          if (targetId) {
            console.log('[MiniChat] Berhasil mendapatkan conversationId baru:', targetId);
            onConversationInitialized?.(targetId);
          }
        }

        // Set conversationId dan fetch messages jika ada
        if (targetId) {
          setConversationId(targetId);
          console.log('[MiniChat] Fetch messages pertama kali untuk:', { conversationId: targetId });
          const fetchedMessages = await fetchMessages(targetId);
          // Konversi ke ShopeeMessage sebelum disimpan
          setLocalMessages(fetchedMessages.map(msg => ({
            message_id: msg.message_id,
            conversation_id: msg.conversation_id,
            from_id: msg.from_id,
            to_id: msg.to_id,
            from_shop_id: msg.from_shop_id,
            to_shop_id: msg.to_shop_id,
            content: msg.content,
            message_type: msg.message_type as any,
            created_timestamp: msg.created_timestamp,
            region: "",
            status: msg.status,
            message_option: 0,
            source: "api",
            source_content: {},
            quoted_msg: null
          })));
        }
      } catch (error) {
        console.error('[MiniChat] Error setup chat:', error);
        setError(error instanceof Error ? error.message : 'Gagal memulai percakapan');
      } finally {
        setIsLoading(false);
      }
    };

    setupAndFetch();
  }, [initialConversationId, toId, shopId, metadata?.orderId, isMinimized]);

  // Handler untuk refresh manual
  const handleRefresh = useCallback(async () => {
    if (!conversationId) return;

    try {
      console.log('[MiniChat] Refresh manual messages untuk:', { conversationId });
      setIsLoading(true);
      const fetchedMessages = await fetchMessages(conversationId);
      // Konversi ke ShopeeMessage sebelum disimpan
      setLocalMessages(fetchedMessages.map(msg => ({
        message_id: msg.message_id,
        conversation_id: msg.conversation_id,
        from_id: msg.from_id,
        to_id: msg.to_id,
        from_shop_id: msg.from_shop_id,
        to_shop_id: msg.to_shop_id,
        content: msg.content,
        message_type: msg.message_type as any,
        created_timestamp: msg.created_timestamp,
        region: "",
        status: msg.status,
        message_option: 0,
        source: "api",
        source_content: {},
        quoted_msg: null
      })));
    } catch (error) {
      console.error('[MiniChat] Error saat refresh messages:', error);
      setError(error instanceof Error ? error.message : 'Gagal memuat ulang pesan');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, fetchMessages]);

  // Ambil messages dari state lokal, bukan dari store
  const messages = useMemo(() => localMessages, [localMessages]);

  // Memoize messages untuk MessageList
  const memoizedMessages = useMemo(() => messages, [messages]);
  
  // Scroll ke bawah saat ada pesan baru
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);
  
  // Fungsi untuk mengirim pesan
  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !conversationId) return;
    
    try {
      setIsLoading(true);
      
      const messageId = await sendMessageToStore({
        conversationId,
        content,
        toId: Number(toId),
        shopId: Number(shopId)
      });
      
      // Menambahkan pesan baru langsung ke state lokal untuk UI yang lebih responsif
      if (messageId) {
        const newMessage: ShopeeMessage = {
          message_id: messageId,
          conversation_id: conversationId,
          from_id: Number(shopId),
          to_id: Number(toId), 
          from_shop_id: Number(shopId),
          to_shop_id: 0,
          message_type: "text",
          content: {
            text: content
          },
          created_timestamp: Math.floor(Date.now() / 1000),
          region: "",
          status: "sent",
          message_option: 0,
          source: "manual",
          source_content: {},
          quoted_msg: null
        };
        
        setLocalMessages(prev => [...prev, newMessage]);
      }
      
      // Refresh setelah kirim untuk memastikan data terbaru
      setTimeout(() => {
        handleRefresh();
      }, 500);
      
    } catch (error) {
      console.error('[MiniChat] Error sending message:', error);
      toast.error(error instanceof Error ? error.message : 'Gagal mengirim pesan');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, shopId, toId, sendMessageToStore, handleRefresh]);
  
  // Modifikasi fungsi pembatalan - hapus pesan konfirmasi dalam chat
  const handleCancellationAction = useCallback(async (orderSn: string, action: 'ACCEPT' | 'REJECT') => {
    try {
      setLoadingAction(action);
      
      const response = await fetch('/api/handle-cancellation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shopId: Number(shopId),
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
      
    } catch (error) {
      console.error('Gagal memproses pembatalan:', error);
      toast.error(error instanceof Error ? error.message : 'Gagal memproses pembatalan');
    } finally {
      setLoadingAction(null);
    }
  }, [shopId]);
  
  // Fungsi untuk navigasi ke halaman webchat
  const navigateToWebchat = useCallback(() => {
    // Buka di tab baru dengan conversationId jika tersedia
    const url = conversationId 
      ? `/webchat?user_id=${toId}&shop_id=${shopId}&conversation_id=${conversationId}` 
      : `/webchat?user_id=${toId}&shop_id=${shopId}`;
    
    window.open(url, '_blank');
  }, [toId, shopId, conversationId]);
  
  // Jika diminimalkan, tampilkan hanya header
  if (isMinimized) {
    return (
      <div 
        className="flex items-center justify-between p-2 border border-gray-100 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 w-64 z-50 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)]"
        style={{ right: `${position * 17}rem` }}
      >
        <div 
          className="flex items-center flex-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-1 rounded-md transition-colors"
          onClick={navigateToWebchat}
        >
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
        <div 
          className="flex items-center flex-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-1 rounded-md transition-colors"
          onClick={navigateToWebchat}
        >
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
            onClick={handleRefresh} 
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700/70 rounded-full transition-colors"
            disabled={isLoading || !conversationId}
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
          
          {/* Tampilkan status pesanan atau tombol aksi */}
          <div className="flex items-center gap-1">
            {metadata?.orderStatus === 'IN_CANCEL' && !processedOrderSns.includes(metadata.orderId!) ? (
              <>
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
              </>
            ) : metadata?.orderStatus ? (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                metadata.orderStatus === 'PAID' 
                  ? 'bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400'
                  : metadata.orderStatus === 'UNPAID'
                  ? 'bg-yellow-500/10 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400'
                  : metadata.orderStatus === 'CANCELLED'
                  ? 'bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400'
                  : metadata.orderStatus === 'COMPLETED'
                  ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
                  : metadata.orderStatus === 'PROCESSED'
                  ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
                  : 'bg-gray-500/10 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400'
              }`}>
                {metadata.orderStatus}
              </span>
            ) : null}
          </div>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 p-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Messages area with optimized rendering */}
      <div className="flex-1 p-2 overflow-y-auto bg-white dark:bg-gray-800">
        {(isLoading || storeIsInitializing) && messages.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-full gap-2">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {storeIsInitializing ? 'Memulai percakapan...' : 'Memuat pesan...'}
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center items-center h-full text-gray-400 text-xs">
            {conversationId ? 'Belum ada pesan' : 'Siap memulai percakapan'}
          </div>
        ) : (
          <MessageList messages={memoizedMessages} shopId={shopId} orders={orders} />
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input dengan styling yang sederhana */}
      <div className="border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-lg">
        <ChatInput onSend={handleSendMessage} isLoading={isLoading || storeIsInitializing} />
      </div>
    </div>
  );
});

MiniChat.displayName = 'MiniChat';

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

export default MiniChat; 