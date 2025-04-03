'use client'

import { useEffect } from 'react'
import { useSSE } from '@/app/services/SSEService'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { ShoppingBag, MessageSquare, AlertTriangle, Bell } from 'lucide-react'
import { useMiniChat } from '@/contexts/MiniChatContext'

export function GlobalNotification() {
  const { lastMessage, isConnected } = useSSE();
  const router = useRouter();
  const { openChat } = useMiniChat();

  useEffect(() => {
    console.log('SSE Connection Status:', isConnected);
  }, [isConnected]);

  useEffect(() => {
    console.log('Received lastMessage:', lastMessage);
    
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'new_message':
        console.log('Processing new_message notification');
        handleChatNotification(lastMessage);
        break;
      case 'new_order':
        console.log('Processing new_order notification');
        handleOrderNotification(lastMessage);
        break;
      case 'item_violation':
        console.log('Processing item_violation notification');
        handleViolationNotification(lastMessage);
        break;
      case 'shopee_update':
        console.log('Processing shopee_update notification');
        handleUpdateNotification(lastMessage);
        break;
      default:
        console.log('Unhandled message type:', lastMessage.type);
    }
  }, [lastMessage]);

  const handleChatNotification = (message: any) => {
    console.log("Pesan baru dari", message.shop_name, "dengan konten:", message.content);
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
          openChat({
            toId: message.sender,
            toName: message.sender_name,
            toAvatar: '',
            shopId: message.shop_id,
            shopName: message.shop_name,
            conversationId: message.conversation_id,
            metadata: {
              source: 'notification',
              timestamp: new Date(message.timestamp * 1000).toISOString()
            }
          });
          
          toast.dismiss();
        }
      }
    });
  };

  const handleOrderNotification = (message: any) => {
    const audio = new Audio('/order.mp3');
    console.log("Memproses notifikasi pesanan baru dari", message.shop_name, "dengan ID:", message.order_sn);
    audio.play();
    
    toast.success(`${message.shop_name} - #${message.order_sn}`, {
      icon: <ShoppingBag className="w-4 h-4" />
    });
  };

  const handleViolationNotification = (message: any) => {
    const audio = new Audio('/alert.mp3'); // Tambahkan sound untuk violation
    console.log("Memproses notifikasi pelanggaran produk:", message);
    audio.play();
    
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
    const audio = new Audio('/notification.mp3'); // Tambahkan sound untuk update
    console.log("Memproses notifikasi update:", message);
    audio.play();
    
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