import { useState, useEffect } from 'react'
import { supabase } from "@/lib/supabase"
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
  store_id: string | null
  msg_id: string | null
  user_id: number | null
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
  conversationId: string; // Tambahkan ini
}

export function useUbahPesanan() {
  const [perubahanPesanan, setPerubahanPesanan] = useState<PerubahanPesanan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chats, setChats] = useState<Chat[]>([])
  const [isLoadingSend, setIsLoadingSend] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    fetchPerubahanPesanan()
  }, [])

  async function fetchPerubahanPesanan() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('perubahan_pesanan')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      
      if (error) throw error

      setPerubahanPesanan(data || [])
    } catch (error) {
      setError('Terjadi kesalahan saat mengambil data perubahan pesanan')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  async function updateStatusPesanan(id: number, newStatus: string) {
    try {
      const { error } = await supabase
        .from('perubahan_pesanan')
        .update({ status: newStatus })
        .eq('id', id)
      
      if (error) throw error

      // Memperbarui state lokal
      setPerubahanPesanan(prevState =>
        prevState.map(order =>
          order.id === id ? { ...order, status: newStatus } : order
        )
      )
    } catch (error) {
      setError('Terjadi kesalahan saat memperbarui status pesanan')
      console.error('Error:', error)
    }
  }

  async function hapusPerubahanPesanan(id: number) {
    try {
      const { error } = await supabase
        .from('perubahan_pesanan')
        .delete()
        .eq('id', id)
      
      if (error) throw error

      // Memperbarui state lokal dengan menghapus item yang dihapus
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

      // Jika berhasil, perbarui state chat
      const newChat: Chat = {
        id: parseInt(data.message_id) || Date.now(),
        sender: 'seller',
        message: content,
        timestamp: new Date().toISOString()
      }
      setChats(prevChats => [...prevChats, newChat]);

      // Setelah mengirim pesan, muat ulang chat
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
        console.log('msg.from_shop_id:', msg.from_shop_id); // Log from_shop_id untuk setiap pesan
        
        const isSeller = msg.from_shop_id == shopId; // Gunakan == untuk perbandingan longgar
        console.log('isSeller:', isSeller); // Log hasil perbandingan
        
        return {
          id: parseInt(msg.message_id),
          sender: isSeller ? 'seller' : 'buyer',
          message: msg.content.text,
          timestamp: new Date(msg.created_timestamp * 1000).toISOString()
        };
      });

      // Membalikkan urutan chat
      setChats(formattedChats.reverse());
      

      // Simpan informasi halaman berikutnya jika diperlukan
      // const nextOffset = response.data.response.page_result.next_offset;
    } catch (error) {
      console.error('Error fetching chats:', error);
      setError('Gagal mengambil riwayat chat');
    }
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
    sendError
  }
}
