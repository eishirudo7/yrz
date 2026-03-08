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
  item_id?: number;
  video_url?: string;
  vid?: string | number;
  duration?: number;
  duration_seconds?: number;
}

// Tipe untuk source content
export interface SourceContent {
  order_sn?: string;
  [key: string]: any;
}

// Definisikan message type sebagai type tersendiri
export type ShopeeMessageType = 'text' | 'image' | 'video' | 'image_with_text' | 'order' | 'sticker' | 'item' | 'new_message';
export type UIMessageType = 'text' | 'image' | 'video' | 'image_with_text' | 'order' | 'sticker' | 'item';

// Tipe lengkap yang mewakili respons API Shopee
export interface ShopeeMessage {
  message_id: string;
  from_id: number;
  to_id: number;
  from_shop_id: number;
  to_shop_id: number;
  message_type: ShopeeMessageType;
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
  type: UIMessageType;
  status?: 'sending' | 'error' | 'success';
  localFileUrl?: string;
  file?: File;
  imageUrl?: string;
  videoUrl?: string;
  videoDuration?: number;
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
  itemData?: {
    shopId: number;
    itemId: number;
  };
  sourceContent?: SourceContent;
}

// Fungsi untuk mengkonversi dari ShopeeMessage ke UIMessage
export function convertToUIMessage(
  message: ShopeeMessage,
  shopId: number
): UIMessage {
  // Skip konversi jika tipe pesan adalah new_message
  if (message.message_type === 'new_message') {
    return {
      id: message.message_id,
      sender: message.from_shop_id === shopId ? 'seller' : 'buyer',
      type: 'text',
      content: 'Pesan baru',
      time: new Date(message.created_timestamp * 1000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  }

  // Pastikan content adalah object (Shopee sering mengembalikan JSON string jika lewat API langsung)
  let parsedContent = message.content as any;
  if (typeof message.content === 'string') {
    try {
      parsedContent = JSON.parse(message.content);
    } catch (e) {
      console.warn('Gagal mem-parsing message.content:', message.content);
      parsedContent = {};
    }
  }

  if (message.message_type === 'video') {
    console.log('[DEBUG UIMessage Conversion] Raw Message:', message);
    console.log('[DEBUG UIMessage Conversion] Parsed Content:', parsedContent);
  }

  return {
    id: message.message_id,
    sender: message.from_shop_id === shopId ? 'seller' : 'buyer',
    type: message.message_type,
    content: ['text', 'image_with_text'].includes(message.message_type)
      ? parsedContent.text || ''
      : message.message_type === 'order'
        ? 'Menampilkan detail pesanan'
        : message.message_type === 'sticker'
          ? 'Stiker'
          : message.message_type === 'item'
            ? 'Menampilkan detail produk'
            : '',
    imageUrl: message.message_type === 'image'
      ? parsedContent.url
      : message.message_type === 'image_with_text'
        ? parsedContent.image_url
        : undefined,
    videoUrl: (() => {
      if (message.message_type !== 'video') return undefined;
      const url = parsedContent.video_url || parsedContent.url || '';
      if (!url) return '';
      if (!url.startsWith('http')) return `https://down-tx-sg.vod.susercontent.com/${url}`;
      return url;
    })(),
    videoDuration: (() => {
      if (message.message_type !== 'video') return undefined;
      return parsedContent.duration_seconds || parsedContent.duration || 0;
    })(),
    imageThumb: (() => {
      if (!['image', 'image_with_text', 'video'].includes(message.message_type)) return undefined;

      let url = '';
      if (message.message_type === 'image') {
        url = parsedContent.thumb_url || parsedContent.url || '';
      } else if (message.message_type === 'video') {
        url = parsedContent.thumb_url || '';
      } else {
        url = parsedContent.thumb_url || parsedContent.image_url || '';
      }

      if (!url) return undefined;

      return {
        url,
        height: parsedContent.thumb_height || 0,
        width: parsedContent.thumb_width || 0
      };
    })(),
    orderData: message.message_type === 'order'
      ? {
        shopId: parsedContent.shop_id || 0,
        orderSn: parsedContent.order_sn || ''
      }
      : undefined,
    stickerData: message.message_type === 'sticker'
      ? {
        stickerId: parsedContent.sticker_id || '',
        packageId: parsedContent.sticker_package_id || ''
      }
      : undefined,
    itemData: message.message_type === 'item'
      ? {
        shopId: parsedContent.shop_id || 0,
        itemId: parsedContent.item_id || 0
      }
      : undefined,
    sourceContent: message.source_content,
    time: new Date(message.created_timestamp * 1000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })
  };
}
