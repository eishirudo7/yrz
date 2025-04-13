import { useState, useEffect } from 'react'
import { createClient } from "@/utils/supabase/client"
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
  conversationId: string; // Tambahkan ini
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
  const [statusFilter, setStatusFilter] = useState<string>('semua') // Filter status
  const supabase = createClient()

  useEffect(() => {
    // Pertama, ambil daftar toko yang dimiliki user
    fetchUserShops().then((shops) => {
      if (shops.length > 0) {
        // Setelah mendapatkan toko user, ambil perubahan pesanan
        fetchPerubahanPesanan();
      }
    });
  }, []) // Initial load

  // Tambahkan useEffect baru untuk memantau perubahan filter
  useEffect(() => {
    if (userShopIds.length > 0) {
      fetchPerubahanPesanan(1, itemsPerPage);
    }
  }, [statusFilter]) // Dipicu ketika filter berubah

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

  async function fetchPerubahanPesanan(page: number = currentPage, size: number = itemsPerPage) {
    try {
      setLoading(true)
      
      let shops = userShopIds
      if (shops.length === 0) {
        shops = await fetchUserShops()
      }
      
      if (shops.length === 0) {
        setPerubahanPesanan([])
        setLoading(false)
        return
      }

      const offset = (page - 1) * size
      
      // Query dasar dengan filter shop_id
      let query = supabase
        .from('perubahan_pesanan')
        .select('*', { count: 'exact' })
        .in('shop_id', shops)

      // Tambahkan filter status jika bukan 'semua'
      if (statusFilter !== 'semua') {
        query = query.eq('status', statusFilter)
      }

      // Log untuk debugging
      console.log('Fetching with filter:', statusFilter, 'page:', page)

      // Ambil total items dengan filter yang sama
      const { count } = await query

      setTotalItems(count || 0)
      
      // Query untuk data dengan pagination dan filter yang sama
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + size - 1)
      
      if (error) throw error

      // Log hasil query
      console.log('Query result:', data?.length, 'items')

      setPerubahanPesanan(data || [])
      setCurrentPage(page)
      setItemsPerPage(size)
    } catch (error) {
      setError('Terjadi kesalahan saat mengambil data perubahan pesanan')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fungsi untuk mengubah jumlah item per halaman
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    setItemsPerPage(newSize)
    setCurrentPage(1) // Reset ke halaman pertama
    fetchPerubahanPesanan(1, newSize)
  }

  // Fungsi untuk mengubah halaman
  const changePage = (page: number) => {
    fetchPerubahanPesanan(page);
  };

  // Fungsi untuk mengubah status pesanan
  async function updateStatusPesanan(id: number, newStatus: string) {
    try {
      const { error } = await supabase
        .from('perubahan_pesanan')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error

      // Jika ada filter aktif dan status baru tidak sesuai filter
      if (statusFilter !== 'semua' && statusFilter !== newStatus) {
        // Hapus item dari tampilan
        setPerubahanPesanan(prevState => prevState.filter(order => order.id !== id))
        // Update total items
        setTotalItems(prev => Math.max(0, prev - 1))
      } else {
        // Update state secara lokal
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

      // Jika halaman saat ini kosong setelah update, kembali ke halaman sebelumnya
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

      // Membalikkan urutan chat agar yang terbaru di bawah
      setChats(formattedChats.reverse());
      
    } catch (error) {
      console.error('Error fetching chats:', error);
      setError('Gagal mengambil riwayat chat');
    }
  }

  // Fungsi untuk mengubah filter status
  const handleStatusFilterChange = (newStatus: string) => {
    setStatusFilter(newStatus)
    setCurrentPage(1) // Reset ke halaman pertama
    // Hapus fetchPerubahanPesanan dari sini karena sudah ditangani oleh useEffect
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
    // Pagination
    currentPage,
    totalItems,
    itemsPerPage,
    pageSize,
    changePage: (page: number) => fetchPerubahanPesanan(page, itemsPerPage),
    handlePageSizeChange,
    // Filter
    statusFilter,
    handleStatusFilterChange
  }
}
