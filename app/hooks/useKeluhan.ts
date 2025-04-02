import { useState, useEffect } from 'react'
import { createClient } from "@/utils/supabase/client"
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
  const supabase = createClient();

  useEffect(() => {
    // Pertama, ambil daftar toko yang dimiliki user
    fetchUserShops().then(() => {
      // Setelah mendapatkan toko user, ambil data keluhan
      fetchKeluhan();
    });
  }, [])

  // Fungsi untuk mengambil daftar toko user
  async function fetchUserShops() {
    try {
      // Gunakan API endpoint untuk mendapatkan toko milik user
      const response = await fetch('/api/shops');
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Gagal mengambil daftar toko');
      }
      
      // Simpan ID toko milik user
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
      
      // Jika belum ada data toko user, ambil dulu
      let shops = userShopIds;
      if (shops.length === 0) {
        shops = await fetchUserShops();
      }
      
      if (shops.length === 0) {
        // Jika tetap tidak ada toko, kembalikan array kosong
        setKeluhan([]);
        setLoading(false);
        return;
      }
      
      // Query dengan filter berdasarkan toko milik user
      const { data, error } = await supabase
        .from('keluhan')
        .select('*')
        .in('shop_id', shops) // Menggunakan kolom yang benar sesuai dengan database
        .order('create_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;

      setKeluhan(data || []);
    } catch (error) {
      setError('Terjadi kesalahan saat mengambil data keluhan');
      console.error('Error:', error);
    } finally {
      setLoading(false);
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
      const { error } = await supabase
        .from('keluhan')
        .delete()
        .eq('id', id)
      
      if (error) throw error

      // Memperbarui state lokal dengan menghapus item yang dihapus
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
    sendError,
    userShopIds
  }
}
