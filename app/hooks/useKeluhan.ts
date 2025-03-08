import { useState, useEffect } from 'react'
import { supabase } from "@/lib/supabase"
import axios from 'axios'

export interface Keluhan {
  id: number
  id_pengguna: string
  nama_toko: string
  jenis_keluhan: string // Ditambahkan
  nomor_invoice: string
  create_at: string | null // Diubah dari created_at
  status_keluhan: string | null // Diubah dari status
  deskripsi_keluhan: string | null // Ditambahkan
  status_pesanan: string | null
  store_id: string | null
  msg_id: string | null
  user_id: number | null
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
  conversationId: string; // Tambahkan ini
}

export function useKeluhan() {
  const [keluhan, setKeluhan] = useState<Keluhan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chats, setChats] = useState<Chat[]>([])
  const [isLoadingSend, setIsLoadingSend] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    fetchKeluhan()
  }, [])

  async function fetchKeluhan() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('keluhan')
        .select('*')
        .order('create_at', { ascending: false }) // Diubah dari created_at
        .limit(20)
      if (error) throw error

      setKeluhan(data || [])
    } catch (error) {
      setError('Terjadi kesalahan saat mengambil data keluhan')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  async function updateStatusPesanan(id: number, newStatus: string) {
    try {
      const { error } = await supabase
        .from('keluhan')
        .update({ status_keluhan: newStatus })
        .eq('id', id)
      
      if (error) throw error

      // Memperbarui state lokal
      setKeluhan(prevState =>
        prevState.map(order =>
          order.id === id ? { ...order, status_keluhan: newStatus } : order
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
        .from('keluhan')
        .delete()
        .eq('id', id)
      
      if (error) throw error

      // Memperbarui state lokal dengan menghapus item yang dihapus
      setKeluhan(prevState =>
        prevState.filter(order => order.id !== id)
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
    sendError
  }
}
