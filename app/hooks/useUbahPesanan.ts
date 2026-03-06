import { useState, useEffect } from 'react'
import axios from 'axios'

export interface PerubahanPesanan {
  id: number
  id_pengguna: string
  nama_toko: string
  nomor_invoice: string | null
  perubahan: Record<string, any>
  created_at: string
  updated_at: string
  status: string
  status_pesanan: string | null
  detail_perubahan: string | null
  shop_id: string | null
  msg_id: string | null
  userid: number | null
  user_id: number | null
}

interface SendMessageParams {
  toId: number;
  messageType?: 'text' | 'image' | 'sticker';
  content: string;
  shopId: number;
  conversationId: string;
}

interface Chat {
  id: string;
  message: string;
  sender: 'seller' | 'buyer';
  timestamp: string;
  message_type: 'text' | 'image' | 'order';
  content: {
    text?: string;
    image_url?: string;
    url?: string;
    thumb_url?: string;
    thumb_height?: number;
    thumb_width?: number;
    shop_id?: number;
    order_sn?: string;
  };
  quoted_msg?: {
    message: string;
    image_url?: string;
  } | null;
}

export function useUbahPesanan() {
  const [perubahanPesanan, setPerubahanPesanan] = useState<PerubahanPesanan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chats, setChats] = useState<Chat[]>([])
  const [isLoadingSend, setIsLoadingSend] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [userShopIds, setUserShopIds] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(21)
  const [pageSize, setPageSize] = useState(21)
  const [statusFilter, setStatusFilter] = useState<string>('semua')

  useEffect(() => {
    fetchUserShops().then((shops) => {
      if (shops.length > 0) {
        fetchPerubahanPesanan();
      }
    });
  }, [])

  useEffect(() => {
    if (userShopIds.length > 0) {
      fetchPerubahanPesanan(1, itemsPerPage);
    }
  }, [statusFilter])

  async function fetchUserShops() {
    try {
      const response = await fetch('/api/shops');
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Gagal mengambil daftar toko');
      }

      const shopIds = result.data.map((shop: any) => shop.shop_id.toString());
      setUserShopIds(shopIds);

      return shopIds;
    } catch (error: unknown) {
      console.error('Error fetching user shops:', error);
      setError(error instanceof Error ? error.message : 'Terjadi kesalahan saat mengambil data toko');
      return [];
    }
  }

  async function fetchPerubahanPesanan(page: number = currentPage, size: number = itemsPerPage) {
    try {
      setLoading(true)

      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
        status: statusFilter
      });

      const response = await fetch(`/api/data/perubahan-pesanan?${params}`);
      if (!response.ok) throw new Error('Gagal mengambil data');

      const result = await response.json();

      setTotalItems(result.total || 0);
      setPerubahanPesanan(result.data || []);
      setCurrentPage(page);
      setItemsPerPage(size);
    } catch (error) {
      setError('Terjadi kesalahan saat mengambil data perubahan pesanan')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    setItemsPerPage(newSize)
    setCurrentPage(1)
    fetchPerubahanPesanan(1, newSize)
  }

  const changePage = (page: number) => {
    fetchPerubahanPesanan(page);
  };

  async function updateStatusPesanan(id: number, newStatus: string) {
    try {
      const response = await fetch('/api/data/perubahan-pesanan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      });

      if (!response.ok) throw new Error('Gagal memperbarui status');

      if (statusFilter !== 'semua' && statusFilter !== newStatus) {
        setPerubahanPesanan(prevState => prevState.filter(order => order.id !== id))
        setTotalItems(prev => Math.max(0, prev - 1))
      } else {
        setPerubahanPesanan(prevState =>
          prevState.map(order =>
            order.id === id
              ? {
                ...order,
                status: newStatus,
                updated_at: new Date().toISOString()
              }
              : order
          )
        )
      }

      if (perubahanPesanan.length === 1 && currentPage > 1) {
        fetchPerubahanPesanan(currentPage - 1, itemsPerPage)
      }

    } catch (error) {
      console.error('Error updating status:', error)
      throw error
    }
  }

  async function hapusPerubahanPesanan(id: number) {
    try {
      const response = await fetch(`/api/data/perubahan-pesanan?id=${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Gagal menghapus');

      setPerubahanPesanan(prevState =>
        prevState.filter(order => order.id !== id)
      )
    } catch (error) {
      setError('Terjadi kesalahan saat menghapus perubahan pesanan')
      console.error('Error:', error)
    }
  }

  const sendMessage = async ({ toId, messageType = 'text', content, shopId, conversationId }: SendMessageParams) => {
    setIsLoadingSend(true);
    setSendError(null);

    try {
      const uniqueParam = Date.now();
      const response = await fetch(`/api/msg/send_message?_=${uniqueParam}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ toId, messageType, content, shopId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Terjadi kesalahan saat mengirim pesan');
      }

      const newChat: Chat = {
        id: (parseInt(data.message_id) || Date.now()).toString(),
        sender: 'seller',
        message: content,
        timestamp: new Date().toISOString(),
        message_type: 'text',
        content: {
          text: content
        }
      }
      setChats(prevChats => [...prevChats, newChat]);

      await fetchChats(conversationId, shopId.toString());

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan yang tidak diketahui';
      setSendError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoadingSend(false);
    }
  };

  async function fetchChats(conversationId: string, shopId: string, offset: number = 0) {
    try {
      const response = await axios.get(`/api/msg/get_message?_=${Date.now()}`, {
        params: {
          conversationId,
          shopId,
          pageSize: 25,
          offset
        }
      });

      if (response.status !== 200) {
        throw new Error(response.data.error || 'Terjadi kesalahan saat mengambil pesan');
      }

      const formattedChats: Chat[] = response.data.response.messages.map((msg: any) => {
        const isSeller = msg.from_shop_id.toString() === shopId;

        return {
          id: msg.message_id.toString(),
          sender: isSeller ? 'seller' : 'buyer',
          message: msg.content.text || '',
          timestamp: new Date(msg.created_timestamp * 1000).toISOString(),
          message_type: msg.message_type || 'text',
          content: {
            text: msg.content.text || '',
            image_url: msg.content.image_url,
            url: msg.content.url,
            thumb_url: msg.content.thumb_url,
            thumb_height: msg.content.thumb_height,
            thumb_width: msg.content.thumb_width,
            shop_id: msg.from_shop_id,
            order_sn: msg.content.order_sn
          },
          quoted_msg: msg.quoted_msg ? {
            message: msg.quoted_msg.content?.text || '',
            image_url: msg.quoted_msg.content?.image_url
          } : null
        };
      });

      setChats(formattedChats.reverse());

    } catch (error) {
      console.error('Error fetching chats:', error);
      setError('Gagal mengambil riwayat chat');
    }
  }

  const handleStatusFilterChange = (newStatus: string) => {
    setStatusFilter(newStatus)
    setCurrentPage(1)
  }

  return {
    perubahanPesanan,
    loading,
    error,
    fetchPerubahanPesanan,
    updateStatusPesanan,
    hapusPerubahanPesanan,
    chats,
    sendMessage,
    fetchChats,
    isLoadingSend,
    sendError,
    userShopIds,
    currentPage,
    totalItems,
    itemsPerPage,
    pageSize,
    changePage: (page: number) => fetchPerubahanPesanan(page, itemsPerPage),
    handlePageSizeChange,
    statusFilter,
    handleStatusFilterChange
  }
}
