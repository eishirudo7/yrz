'use client'

import { useEffect } from 'react'
import { useSSE } from '@/app/services/SSEService'
import { toast } from 'sonner'
import { ShoppingBag, MessageSquare, AlertTriangle, Bell } from 'lucide-react'
import useStoreChat from '@/stores/useStoreChat'

export function GlobalNotification() {
  const { lastMessage } = useSSE();
  const { handleSSEMessage } = useStoreChat();

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'new_message':
        if (lastMessage) {
          handleSSEMessage(lastMessage);
          handleChatNotification(lastMessage);
        }
        break;
      case 'new_order':
        handleOrderNotification(lastMessage);
        break;
      case 'item_violation':
        handleViolationNotification(lastMessage);
        break;
      case 'shopee_update':
        handleUpdateNotification(lastMessage);
        break;
    }
  }, [lastMessage, handleSSEMessage]);

  const handleChatNotification = (message: any) => {
    console.log("Pesan baru dari", message.shop_name)
    toast.info(`${message.shop_name}`, {
      icon: <MessageSquare className="w-4 h-4" />,
      description: (
        <>
          <span className="font-semibold">{message.sender_name}</span>
          <span className="text-gray-600">: {message.content?.text || ''}</span>
        </>
      ),
      action: {
        label: "Balas",
        onClick: () => {
          // Gunakan custom event openChat seperti di ChatButton
          console.log('[GlobalNotification] Mengirim event openChat untuk:', message);
          const chatData = {
            conversationId: message.conversation_id,
            shopId: message.shop_id,
            toId: message.sender,
            toName: message.sender_name,
            toAvatar: message.sender_avatar || '',
            shopName: message.shop_name,
            metadata: {}
          };
          
          const event = new CustomEvent('openChat', { 
            detail: chatData 
          });
          window.dispatchEvent(event);
          toast.dismiss();
        }
      }
    });
  };

  const handleOrderNotification = (message: any) => {
    const audio = new Audio('/order.mp3');
    console.log("Pesanan baru dari", message.shop_name)
    
    // Tangani error pemutaran audio
    audio.play().catch(err => {
      console.log("Tidak dapat memainkan suara notifikasi:", err.message);
    });
    
    toast.success(`${message.shop_name} - #${message.order_sn}`, {
      icon: <ShoppingBag className="w-4 h-4" />
    });
  };

  const handleViolationNotification = (message: any) => {
    const audio = new Audio('/alert.mp3');
    
    // Tangani error pemutaran audio
    audio.play().catch(err => {
      console.log("Tidak dapat memainkan suara notifikasi:", err.message);
    });
    
    const getViolationTitle = () => {
      switch (message.action) {
        case 'ITEM_BANNED': return 'Produk Diblokir';
        case 'ITEM_DELETED': return 'Produk Dihapus';
        case 'ITEM_DEBOOSTED': return 'Produk Diturunkan';
        default: return 'Pelanggaran Produk';
      }
    };

    toast.error(`${getViolationTitle()}`, {
      icon: <AlertTriangle className="w-4 h-4" />,
      description: (
        <div className="space-y-1">
          <p className="font-medium">{message.details.item_name}</p>
          {message.details.violations.map((v: any, i: number) => (
            <div key={i} className="text-sm">
              <p className="text-red-500">{v.type}</p>
              <p className="text-gray-600">{v.suggestion}</p>
            </div>
          ))}
        </div>
      ),
      duration: 8000 // Durasi lebih lama untuk violation
    });
  };

  const handleUpdateNotification = (message: any) => {
    const audio = new Audio('/notification.mp3');
    
    // Tangani error pemutaran audio
    audio.play().catch(err => {
      console.log("Tidak dapat memainkan suara notifikasi:", err.message);
    });
    
    toast.info(message.title, {
      icon: <Bell className="w-4 h-4" />,
      description: message.content,
      action: message.url ? {
        label: "Buka",
        onClick: () => window.open(message.url, '_blank')
      } : undefined,
      duration: 5000
    });
  };

  return null;
}