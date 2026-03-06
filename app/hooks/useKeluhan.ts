import { useState, useEffect } from 'react'
import axios from 'axios'

export interface Keluhan {
  id: number
  id_pengguna: string
  nama_toko: string
  jenis_keluhan: string
  nomor_invoice: string
  create_at: string | null
  status_keluhan: string | null
  deskripsi_keluhan: string | null
  status_pesanan: string | null
  shop_id: string | null
  msg_id: string | null
  user_id: number | null
  userid: string | null
  updated_at: string | null
}

interface Chat {
  id: number
  sender: string
  message: string
  timestamp: string
}

interface SendMessageParams {
  toId: number;
  messageType?: 'text' | 'image' | 'sticker';
  content: string;
  shopId: number;
  conversationId: string;
}

export function useKeluhan() {
  const [keluhan, setKeluhan] = useState<Keluhan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chats, setChats] = useState<Chat[]>([])
  const [isLoadingSend, setIsLoadingSend] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [userShopIds, setUserShopIds] = useState<string[]>([]);

  useEffect(() => {
    fetchUserShops().then(() => {
      fetchKeluhan();
    });
  }, [])

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

  async function fetchKeluhan() {
    try {
      setLoading(true);

      const response = await fetch('/api/data/keluhan');
      if (!response.ok) throw new Error('Gagal mengambil data keluhan');

      const result = await response.json();
      setKeluhan(result.data || []);
    } catch (error) {
      setError('Terjadi kesalahan saat mengambil data keluhan');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatusPesanan(id: number, newStatus: string) {
    try {
      const response = await fetch('/api/data/keluhan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status_keluhan: newStatus })
      });

      if (!response.ok) throw new Error('Gagal memperbarui status');

      setKeluhan(prevState =>
        prevState.map(item =>
          item.id === id ? { ...item, status_keluhan: newStatus } : item
        )
      )
    } catch (error) {
      setError('Terjadi kesalahan saat memperbarui status keluhan')
      console.error('Error:', error)
    }
  }

  async function hapusPerubahanPesanan(id: number) {
    try {
      const response = await fetch(`/api/data/keluhan?id=${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Gagal menghapus keluhan');

      setKeluhan(prevState =>
        prevState.filter(item => item.id !== id)
      )
    } catch (error) {
      setError('Terjadi kesalahan saat menghapus keluhan')
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
        id: parseInt(data.message_id) || Date.now(),
        sender: 'seller',
        message: content,
        timestamp: new Date().toISOString()
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
        const isSeller = msg.from_shop_id == shopId;

        return {
          id: parseInt(msg.message_id),
          sender: isSeller ? 'seller' : 'buyer',
          message: msg.content.text,
          timestamp: new Date(msg.created_timestamp * 1000).toISOString()
        };
      });

      setChats(formattedChats.reverse());
    } catch (error) {
      console.error('Error fetching chats:', error);
      setError('Gagal mengambil riwayat chat');
    }
  }

  return {
    keluhan,
    loading,
    error,
    fetchKeluhan,
    updateStatusPesanan,
    hapusPerubahanPesanan,
    chats,
    sendMessage,
    fetchChats,
    isLoadingSend,
    sendError,
    userShopIds
  }
}
