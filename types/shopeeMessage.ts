// Tipe untuk konten pesan
export interface MessageContent {
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
}

// Tipe untuk source content
export interface SourceContent {
  order_sn?: string;
  [key: string]: any;
}

// Tipe lengkap yang mewakili respons API Shopee
export interface ShopeeMessage {
  message_id: string;
  from_id: number;
  to_id: number;
  from_shop_id: number;
  to_shop_id: number;
  message_type: 'text' | 'image' | 'image_with_text' | 'order' | 'sticker';
  content: MessageContent;
  conversation_id: string;
  created_timestamp: number;
  region: string;
  status: string;
  message_option: number;
  source: string;
  source_content: SourceContent;
  quoted_msg: any;
}

// Tipe yang lebih sederhana untuk UI, dapat diturunkan dari ShopeeMessage
export interface UIMessage {
  id: string;
  sender: 'buyer' | 'seller';
  content: string;
  time: string;
  type: 'text' | 'image' | 'image_with_text' | 'order' | 'sticker';
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
  stickerData?: {
    stickerId: string;
    packageId: string;
  };
  sourceContent?: SourceContent;
}

// Fungsi untuk mengkonversi dari ShopeeMessage ke UIMessage
export function convertToUIMessage(
  message: ShopeeMessage, 
  shopId: number
): UIMessage {
  return {
    id: message.message_id,
    sender: message.from_shop_id === shopId ? 'seller' : 'buyer',
    type: message.message_type,
    content: ['text', 'image_with_text'].includes(message.message_type)
      ? message.content.text || ''
      : message.message_type === 'order'
        ? 'Menampilkan detail pesanan'
        : message.message_type === 'sticker'
          ? 'Stiker'
          : '',
    imageUrl: message.message_type === 'image'
      ? message.content.url
      : message.message_type === 'image_with_text'
        ? message.content.image_url
        : undefined,
    imageThumb: ['image', 'image_with_text'].includes(message.message_type) 
      ? {
          url: message.message_type === 'image'
            ? (message.content.thumb_url || message.content.url || '')
            : (message.content.thumb_url || message.content.image_url || ''),
          height: message.content.thumb_height || 0,
          width: message.content.thumb_width || 0
        }
      : undefined,
    orderData: message.message_type === 'order'
      ? {
          shopId: message.content.shop_id || 0,
          orderSn: message.content.order_sn || ''
        }
      : undefined,
    stickerData: message.message_type === 'sticker'
      ? {
          stickerId: message.content.sticker_id || '',
          packageId: message.content.sticker_package_id || ''
        }
      : undefined,
    sourceContent: message.source_content,
    time: new Date(message.created_timestamp * 1000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })
  };
}
