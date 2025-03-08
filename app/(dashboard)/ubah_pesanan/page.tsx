'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { useUbahPesanan, PerubahanPesanan } from '@/app/hooks/useUbahPesanan'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trash2, FileText, MessageSquare, Send } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

// Perbarui interface OrderDetail
interface OrderItem {
  item_id: number;
  item_name: string;
  model_name: string;
  model_quantity_purchased: number;
  model_discounted_price: number;
  image_url: string;
}

interface OrderDetail {
  order_sn: string;
  buyer_user_id: number;
  buyer_username: string;
  order_status: string;
  total_amount: number;
  shipping_carrier: string;
  payment_method: string;
  message_to_seller: string;
  cancel_reason: string;
  order_items: OrderItem[];
  total_belanja: number;
  create_time: number;
}

export default function OrderChangesPage() {
  const { 
    perubahanPesanan, 
    loading, 
    error, 
    updateStatusPesanan, 
    hapusPerubahanPesanan,
    chats,
    sendMessage,
    fetchChats,
    isLoadingSend
  } = useUbahPesanan()
  const { toast } = useToast()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<PerubahanPesanan | null>(null)
  const [chatMessage, setChatMessage] = useState('')
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [orderDetails, setOrderDetails] = useState<OrderDetail[] | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'orders'>('chat')

  const handleStatusClick = async (order: PerubahanPesanan) => {
    const newStatus = order.status === "BARU" ? "DICATAT" : "BARU"
    await updateStatusPesanan(order.id, newStatus)
  }

  const handleDeleteClick = async (id: number) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus perubahan pesanan ini?')) {
      await hapusPerubahanPesanan(id)
      toast({
        title: "Perubahan pesanan dihapus",
        description: "Data perubahan pesanan telah berhasil dihapus.",
      })
    }
  }

  const handleChatClick = async (order: PerubahanPesanan) => {
    setSelectedOrder(order)
    setIsDialogOpen(true)
    if (order.msg_id && order.store_id && order.user_id) {
      await fetchChats(order.msg_id.toString(), order.store_id.toString())
      await fetchOrderDetails(order.user_id.toString())
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedOrder && selectedOrder.store_id && selectedOrder.user_id && selectedOrder.msg_id) {
      try {
        await sendMessage({
          toId: selectedOrder.user_id,
          content: chatMessage,
          shopId: parseInt(selectedOrder.store_id),
          conversationId: selectedOrder.msg_id.toString()
        })
        setChatMessage('')
        // Perbaikan: Gunakan msg_id sebagai conversationId, bukan store_id
        
      } catch (error) {
        toast({
          title: "Gagal mengirim pesan",
          description: "Terjadi kesalahan saat mengirim pesan.",
          variant: "destructive"
        })
      }
    }
  }

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chats])

  // Tambahkan fungsi untuk mengambil detail pesanan
  const fetchOrderDetails = async (userId: string) => {
    setLoadingDetails(true)
    try {
      const response = await fetch(`/api/order_details?user_id=${userId}`)
      const result = await response.json()
      setOrderDetails(result.data) // Simpan array dari result.data
    } catch (error) {
      console.error('Error fetching order details:', error)
      toast({
        title: "Gagal mengambil detail pesanan",
        description: "Terjadi kesalahan saat mengambil data pesanan.",
        variant: "destructive"
      })
    } finally {
      setLoadingDetails(false)
    }
  }

  if (loading) return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">Data Perubahan Pesanan</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, index) => (
          <Card key={index} className="overflow-hidden shadow-md">
            <CardHeader className="p-4 bg-gray-50">
              <Skeleton className="h-5 w-3/4" />
            </CardHeader>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-1/2 mb-3" />
              <div className="space-y-2">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
              <div className="flex justify-between items-center mt-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            </CardContent>
            <CardFooter className="p-4 bg-gray-50 flex justify-between items-center">
              <Skeleton className="h-8 w-1/4" />
              <Skeleton className="h-6 w-6 rounded-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
  
  if (error) return <div>Error: {error}</div>

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 dark:text-white">Data Perubahan Pesanan</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {perubahanPesanan.map((order) => (
          <Card key={order.id} className="overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 dark:bg-gray-800 dark:text-white flex flex-col">
            <CardHeader className="p-4 bg-gray-50 dark:bg-gray-900">
              <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300 flex justify-between items-center">
                <span>No. Invoice: {order.nomor_invoice || 'N/A'}</span>
                <MessageSquare 
                  className="h-5 w-5 text-blue-500 hover:text-blue-600 cursor-pointer transition-colors duration-200" 
                  onClick={() => handleChatClick(order)}
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex-grow dark:bg-gray-800">
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{order.nama_toko}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">ID: {order.id_pengguna}</p>
              </div>
              
              <div className="flex space-x-3 mb-3">
                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md flex-1">
                  <h3 className="font-semibold text-xs mb-2 text-gray-700 dark:text-gray-300">Perubahan:</h3>
                  {order.perubahan && Object.keys(order.perubahan).length > 0 ? (
                    Object.entries(order.perubahan).map(([key, value]) => (
                      <p key={key} className="text-xs mb-1">
                        <span className="font-medium text-gray-600 dark:text-gray-400">{key}:</span>{' '}
                        <span className="text-blue-600 dark:text-blue-400">{JSON.stringify(value)}</span>
                      </p>
                    ))
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 italic text-xs">Tidak ada perubahan</span>
                  )}
                </div>
                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md flex-1">
                  <h3 className="font-semibold text-xs mb-2 text-gray-700 dark:text-gray-300">Detail:</h3>
                  <p className="text-xs dark:text-gray-200">{order.detail_perubahan || 'Tidak ada detail'}</p>
                </div>
              </div>
              <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                <p>Dibuat: {new Date(order.created_at).toLocaleString()}</p>
                <Badge variant="outline" className="font-semibold">{order.status_pesanan}</Badge>
              </div>
            </CardContent>
            <CardFooter className="p-4 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
              <Button 
                variant={order.status === "DICATAT" ? "default" : "destructive"}
                size="sm"
                className="flex items-center text-xs py-1 px-3 h-auto min-h-0 transition-colors duration-200"
                onClick={() => handleStatusClick(order)}
              >
                <FileText className="h-3 w-3 mr-2" />
                {order.status}
              </Button>
              <Trash2 
                className="h-5 w-5 text-red-500 hover:text-red-600 cursor-pointer transition-colors duration-200" 
                onClick={() => handleDeleteClick(order.id)}
              />
            </CardFooter>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[900px] w-[95vw] h-[90vh] overflow-hidden flex flex-col bg-white dark:bg-gray-800">
          <DialogHeader className="py-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <DialogTitle className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
              <span className="text-sm sm:text-base text-gray-900 dark:text-gray-100">
                {selectedOrder?.nomor_invoice}
              </span>
              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                {selectedOrder?.nama_toko}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ID: {selectedOrder?.id_pengguna}
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* Tab buttons untuk mobile */}
          <div className="sm:hidden flex border-b border-gray-200 dark:border-gray-700 shrink-0">
            <button
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                activeTab === 'chat'
                  ? 'border-b-2 border-blue-500 text-blue-500 dark:border-blue-400 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              onClick={() => setActiveTab('chat')}
            >
              Chat
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                activeTab === 'orders'
                  ? 'border-b-2 border-blue-500 text-blue-500 dark:border-blue-400 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              onClick={() => setActiveTab('orders')}
            >
              Detail Pesanan
            </button>
          </div>

          <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
            {/* Chat Section */}
            <div className={`
              sm:w-1/2 flex flex-col
              ${activeTab === 'chat' ? 'flex' : 'hidden sm:flex'}
              w-full
              h-full
            `}>
              <div 
                ref={chatContainerRef} 
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-gray-800"
              >
                {chats.map((chat) => (
                  <div key={chat.id} className={`flex ${chat.sender === 'seller' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-lg ${
                      chat.sender === 'seller' 
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                    } p-3 shadow-sm`}>
                      <p className="text-sm whitespace-pre-wrap break-words">{chat.message}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(chat.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 dark:border-gray-700 shrink-0 bg-white dark:bg-gray-800">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Ketik pesan..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    className="flex-grow bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700"
                    disabled={isLoadingSend}
                  />
                  <Button 
                    type="submit" 
                    size="sm" 
                    disabled={isLoadingSend}
                    className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </div>

            {/* Order Details Section */}
            <div className={`
              sm:w-1/2 sm:border-l border-gray-200 dark:border-gray-700
              ${activeTab === 'orders' ? 'flex' : 'hidden sm:flex'}
              flex-col
              w-full
              h-full
            `}>
              <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-gray-800">
                {loadingDetails ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full bg-gray-200 dark:bg-gray-700" />
                    <Skeleton className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700" />
                  </div>
                ) : orderDetails && orderDetails.length > 0 ? (
                  <div className="space-y-4">
                    {orderDetails.map((order) => (
                      <div 
                        key={order.order_sn} 
                        className={`bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-700 shadow-sm transition-all duration-300
                          ${order.order_sn === selectedOrder?.nomor_invoice 
                            ? 'border-blue-400 dark:border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                            : 'hover:shadow-md'
                          }
                        `}
                      >
                        {/* Header Pesanan */}
                        <div className="p-3 border-b dark:border-gray-700">
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xs font-medium dark:text-white">No. Pesanan: {order.order_sn}</h3>
                            <Badge variant="outline" className="bg-black text-white hover:bg-black text-xs">
                              {order.order_status}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-x-12 text-xs text-gray-500 dark:text-gray-400">
                            <div className="space-y-0.5">
                              <p>Pembeli: {order.buyer_username}</p>
                              <p>{order.shipping_carrier}</p>
                            </div>
                            <div className="space-y-0.5">
                              <p>{new Date(order.create_time * 1000).toLocaleString()}</p>
                              <p>{order.payment_method}</p>
                            </div>
                          </div>
                        </div>

                        {/* Detail Produk */}
                        <div className="p-3">
                          {order.order_items.map((item) => (
                            <div key={item.item_id} className="flex gap-3 items-start">
                              <img 
                                src={item.image_url} 
                                alt={item.item_name}
                                className="w-20 h-20 object-cover rounded-md border dark:border-gray-700"
                              />
                              <div className="flex-1">
                                <h4 className="font-medium text-sm line-clamp-2 mb-1 dark:text-white">
                                  {item.item_name}
                                </h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                  Variasi: {item.model_name}
                                </p>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-gray-600 dark:text-gray-400">
                                    {item.model_quantity_purchased}x
                                  </span>
                                  <span className="font-medium text-sm dark:text-white">
                                    Rp {item.model_discounted_price.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Footer dengan Total */}
                        <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-b-lg border-t dark:border-gray-700">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-sm dark:text-white">Total Belanja</span>
                            <span className="text-base font-bold dark:text-white">
                              Rp {order.total_belanja.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 dark:text-gray-400">
                    Tidak ada detail pesanan
                  </p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
