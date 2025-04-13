'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { useUbahPesanan, PerubahanPesanan } from '@/app/hooks/useUbahPesanan'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trash2, FileText, MessageSquare, Send, Printer, RefreshCcw, ChevronLeft, ChevronRight } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useShippingDocument } from '@/app/hooks/useShippingDocument'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Interface untuk item pesanan
interface OrderItem {
  item_id: number
  item_name: string
  model_name: string
  model_quantity_purchased: number
  model_discounted_price: number
  image_url: string
}

// Interface untuk detail pesanan
interface OrderDetail {
  order_sn: string
  buyer_user_id: number
  buyer_username: string
  order_status: string
  total_amount: number
  shipping_carrier: string
  payment_method: string
  message_to_seller: string
  cancel_reason: string
  order_items: OrderItem[]
  total_belanja: number
  create_time: number
  shop_id: number
}

export default function UbahPesananPage() {
  // State dan hooks
  const { 
    perubahanPesanan, 
    loading, 
    error, 
    updateStatusPesanan, 
    hapusPerubahanPesanan,
    chats,
    sendMessage,
    fetchChats,
    isLoadingSend,
    currentPage,
    totalItems,
    itemsPerPage,
    changePage,
    handlePageSizeChange,
    statusFilter,
    handleStatusFilterChange
  } = useUbahPesanan()
  
  const { toast } = useToast()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<PerubahanPesanan | null>(null)
  const [chatMessage, setChatMessage] = useState('')
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [orderDetails, setOrderDetails] = useState<OrderDetail[] | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'orders'>('chat')
  
  // Hook untuk print dokumen
  const { 
    downloadDocument, 
    isLoadingForOrder 
  } = useShippingDocument()

  // Hitung total halaman
  const totalPages = Math.ceil(totalItems / itemsPerPage)

  // Fungsi untuk navigasi halaman
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      changePage(newPage)
    }
  }

  // Handler untuk mengubah status pesanan
  const handleStatusClick = async (order: PerubahanPesanan) => {
    const newStatus = order.status === "BARU" ? "DICATAT" : "BARU"
    await updateStatusPesanan(order.id, newStatus)
    
    // Update selectedOrder jika yang diubah adalah order yang sedang dibuka
    if (selectedOrder && selectedOrder.id === order.id) {
      setSelectedOrder({
        ...selectedOrder,
        status: newStatus
      })
    }
  }

  // Handler untuk menghapus perubahan pesanan
  const handleDeleteClick = async (id: number) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus perubahan pesanan ini?')) {
      await hapusPerubahanPesanan(id)
      toast({
        title: "Perubahan pesanan dihapus",
        description: "Data perubahan pesanan telah berhasil dihapus.",
      })
    }
  }

  // Handler untuk membuka chat
  const handleChatClick = async (order: PerubahanPesanan) => {
    setSelectedOrder(order)
    setIsDialogOpen(true)
    if (order.msg_id && order.shop_id && order.userid) {
      await fetchChats(order.msg_id.toString(), order.shop_id.toString())
      await fetchOrderDetails(order.userid.toString())
    }
  }

  // Handler untuk mengirim pesan
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedOrder && selectedOrder.shop_id && selectedOrder.userid && selectedOrder.msg_id) {
      try {
        await sendMessage({
          toId: selectedOrder.userid,
          content: chatMessage,
          shopId: parseInt(selectedOrder.shop_id),
          conversationId: selectedOrder.msg_id.toString()
        })
        setChatMessage('')
      } catch (error) {
        toast({
          title: "Gagal mengirim pesan",
          description: "Terjadi kesalahan saat mengirim pesan.",
          variant: "destructive"
        })
      }
    }
  }

  // Handler untuk print dokumen
  const handlePrintDocument = async (order: OrderDetail) => {
    try {
      const params = {
        order_sn: order.order_sn,
        shipping_document_type: "THERMAL_AIR_WAYBILL" as const,
        shipping_carrier: order.shipping_carrier
      };

      const { blob } = await downloadDocument(order.shop_id, [params]);
      const url = URL.createObjectURL(blob);
      
      window.open(url, '_blank');
      
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);

      toast({
        title: "Dokumen berhasil dicetak",
        description: "Dokumen pengiriman telah berhasil dicetak.",
      });
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: "Gagal mencetak dokumen",
        description: "Terjadi kesalahan saat mencetak dokumen.",
        variant: "destructive"
      });
    }
  };

  // Effect untuk scroll chat ke bawah
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chats])

  // Fungsi untuk mengambil detail pesanan
  const fetchOrderDetails = async (userId: string) => {
    setLoadingDetails(true)
    try {
      const response = await fetch(`/api/order_details?user_id=${userId}`)
      const result = await response.json()
      setOrderDetails(result.data)
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

  const handleCardPrint = (order: PerubahanPesanan) => {
    // Validasi data yang diperlukan
    if (!order.nomor_invoice || !order.shop_id) {
      toast({
        title: "Gagal mencetak dokumen",
        description: "Data pesanan tidak lengkap untuk mencetak dokumen.",
        variant: "destructive"
      });
      return;
    }

    // Panggil fungsi print dengan data yang sudah divalidasi
    handlePrintDocument({
      order_sn: order.nomor_invoice,
      shop_id: parseInt(order.shop_id),
      shipping_carrier: "unknown", // Karena tidak ada di interface, kita set default
      buyer_user_id: order.userid || 0,
      buyer_username: '',
      order_status: order.status_pesanan || '',
      total_amount: 0,
      payment_method: '',
      message_to_seller: '',
      cancel_reason: '',
      order_items: [],
      total_belanja: 0,
      create_time: 0
    });
  };

  // Loading state
  if (loading) {
    return (
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
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (error) return <div>Error: {error}</div>

  // Render utama
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Data Perubahan Pesanan</h1>
        <div className="flex items-center gap-4">
          {/* Filter Status */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Status:</span>
            <Select
              value={statusFilter}
              onValueChange={handleStatusFilterChange}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue>
                  {statusFilter === 'semua' ? 'Semua' : 
                   statusFilter === 'BARU' ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="h-4 text-[10px] font-medium py-0">Baru</Badge>
                    </div>
                   ) : (
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="h-4 text-[10px] font-medium py-0">Dicatat</Badge>
                    </div>
                   )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">
                  <span>Semua</span>
                </SelectItem>
                <SelectItem value="BARU">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="h-4 text-[10px] font-medium py-0">Baru</Badge>
                  </div>
                </SelectItem>
                <SelectItem value="DICATAT">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="h-4 text-[10px] font-medium py-0">Dicatat</Badge>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Items Per Page */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Tampilkan:</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => handlePageSizeChange(Number(value))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="21" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="21">21 item</SelectItem>
                <SelectItem value="42">42 item</SelectItem>
                <SelectItem value="63">63 item</SelectItem>
                <SelectItem value="84">84 item</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Grid untuk kartu pesanan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {perubahanPesanan.map((order) => (
          <Card key={order.id} className="overflow-hidden shadow-md">
            <CardHeader className="p-4 bg-gray-50">
              <CardTitle className="text-sm font-medium text-gray-700 flex justify-between items-center">
                <span>No. Invoice: {order.nomor_invoice || 'N/A'}</span>
                <div className="flex items-center gap-2">
                  <MessageSquare 
                    className="h-5 w-5 text-blue-500 hover:text-blue-600 cursor-pointer" 
                    onClick={() => handleChatClick(order)}
                  />
                  {order.nomor_invoice && order.shop_id && (
                    <Button
                      onClick={() => handleCardPrint(order)}
                      disabled={isLoadingForOrder(order.nomor_invoice)}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                    >
                      {isLoadingForOrder(order.nomor_invoice) ? (
                        <RefreshCcw size={12} className="animate-spin" />
                      ) : (
                        <Printer size={12} className="text-primary hover:text-primary/80" />
                      )}
                    </Button>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-semibold">{order.nama_toko}</p>
                <p className="text-xs text-gray-500">ID: {order.id_pengguna}</p>
              </div>
              
              <div className="flex space-x-3 mb-3">
                <div className="bg-gray-100 p-3 rounded-md flex-1">
                  <h3 className="font-semibold text-xs mb-2">Perubahan:</h3>
                  {order.perubahan && Object.keys(order.perubahan).length > 0 ? (
                    Object.entries(order.perubahan).map(([key, value]) => (
                      <p key={key} className="text-xs mb-1">
                        <span className="font-medium">{key}:</span>{' '}
                        <span className="text-blue-600">{JSON.stringify(value)}</span>
                      </p>
                    ))
                  ) : (
                    <span className="text-gray-400 italic text-xs">Tidak ada perubahan</span>
                  )}
                </div>
                <div className="bg-gray-100 p-3 rounded-md flex-1">
                  <h3 className="font-semibold text-xs mb-2">Detail:</h3>
                  <p className="text-xs">{order.detail_perubahan || 'Tidak ada detail'}</p>
                </div>
              </div>

              {/* Tambahkan informasi waktu */}
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
                <div>
                  <span className="font-medium">Dibuat:</span>{' '}
                  {order.created_at ? new Date(order.created_at).toLocaleString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'N/A'}
                </div>
                <div>
                  <span className="font-medium">Diperbarui:</span>{' '}
                  {order.updated_at ? new Date(order.updated_at).toLocaleString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'N/A'}
                </div>
              </div>
            </CardContent>

            <CardFooter className="p-4 bg-gray-50 flex justify-between items-center">
              <Button 
                variant={order.status === "DICATAT" ? "default" : "destructive"}
                size="sm"
                onClick={() => handleStatusClick(order)}
              >
                <FileText className="h-4 w-4 mr-2" />
                {order.status}
              </Button>
              <Trash2 
                className="h-5 w-5 text-red-500 hover:text-red-600 cursor-pointer" 
                onClick={() => handleDeleteClick(order.id)}
              />
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Pagination yang lebih profesional */}
      {!loading && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-8 bg-white p-4 rounded-lg shadow-sm">
          <div className="text-sm text-gray-500">
            Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalItems)} dari {totalItems} item
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className="hidden sm:flex"
            >
              Pertama
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-1 px-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                    className={`w-8 h-8 p-0`}
                  >
                    {pageNum}
                  </Button>
                )
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="hidden sm:flex"
            >
              Terakhir
            </Button>
          </div>
        </div>
      )}

      {/* Dialog untuk chat dan detail pesanan */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[900px] w-[95vw] h-[90vh] overflow-hidden flex flex-col bg-white">
          <DialogHeader className="py-2 border-b border-gray-200 shrink-0">
            <DialogTitle className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
              <span className="text-sm sm:text-base text-gray-900 font-medium">
                {selectedOrder?.nomor_invoice}
              </span>
              <span className="text-xs sm:text-sm text-gray-600">
                {selectedOrder?.nama_toko}
              </span>
              <span className="text-xs text-gray-500">
                ID: {selectedOrder?.id_pengguna}
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* Tab buttons untuk mobile */}
          <div className="sm:hidden flex border-b border-gray-200 shrink-0">
            <button
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                activeTab === 'chat'
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('chat')}
            >
              Chat
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                activeTab === 'orders'
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'text-gray-500 hover:text-gray-700'
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
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-white"
              >
                {chats.map((chat) => (
                  <div key={chat.id} className={`flex ${chat.sender === 'seller' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-lg ${
                      chat.sender === 'seller' 
                      ? 'bg-blue-100 text-blue-900' 
                      : 'bg-gray-100 text-gray-900'
                    } p-3 shadow-sm`}>
                      {/* Quoted Message jika ada */}
                      {chat.quoted_msg && (
                        <div className="mb-2 p-2 bg-white/50 rounded text-xs border-l-2 border-gray-400">
                          {chat.quoted_msg.image_url && (
                            <img 
                              src={chat.quoted_msg.image_url} 
                              alt="Quoted image"
                              className="w-16 h-16 object-cover rounded mb-1"
                            />
                          )}
                          <p className="text-gray-600 line-clamp-2">{chat.quoted_msg.message}</p>
                        </div>
                      )}

                      {/* Content berdasarkan message_type */}
                      {chat.message_type === 'text' && (
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {chat.content.text}
                        </p>
                      )}

                      {chat.message_type === 'image' && (chat.content.url || chat.content.image_url) && (
                        <div className="space-y-2">
                          <img 
                            src={chat.content.url || chat.content.image_url}
                            alt="Chat image"
                            className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            style={{
                              maxHeight: '300px',
                              width: 'auto',
                              maxWidth: '100%',
                              aspectRatio: chat.content.thumb_width && chat.content.thumb_height 
                                ? `${chat.content.thumb_width}/${chat.content.thumb_height}` 
                                : 'auto'
                            }}
                            onClick={() => window.open(chat.content.url || chat.content.image_url, '_blank')}
                          />
                          {chat.content.text && (
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {chat.content.text}
                            </p>
                          )}
                        </div>
                      )}

                      {chat.message_type === 'order' && (
                        <div className="bg-white/50 p-2 rounded border border-gray-200">
                          <p className="text-xs font-medium">Order: {chat.content.order_sn}</p>
                        </div>
                      )}

                      {/* Timestamp */}
                      <p className="text-[10px] text-gray-500 mt-1">
                        {new Date(chat.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 shrink-0 bg-white">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Ketik pesan..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    className="flex-grow bg-white text-gray-900 border-gray-200"
                    disabled={isLoadingSend}
                  />
                  <Button 
                    type="submit" 
                    size="sm" 
                    disabled={isLoadingSend}
                    className="bg-blue-500 hover:bg-blue-600"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </div>

            {/* Order Details Section */}
            <div className={`
              sm:w-1/2 sm:border-l border-gray-200
              ${activeTab === 'orders' ? 'flex' : 'hidden sm:flex'}
              flex-col
              w-full
              h-full
            `}>
              <div className="p-3 border-b border-gray-200 bg-white">
                {selectedOrder && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status Perubahan:</span>
                    <Button 
                      variant={selectedOrder.status === "DICATAT" ? "default" : "destructive"}
                      size="sm"
                      onClick={() => handleStatusClick(selectedOrder)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      {selectedOrder.status}
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 bg-white">
                {loadingDetails ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full bg-gray-200" />
                    <Skeleton className="h-4 w-3/4 bg-gray-200" />
                  </div>
                ) : orderDetails && orderDetails.length > 0 ? (
                  <div className="space-y-4">
                    {orderDetails.map((order) => (
                      <div 
                        key={order.order_sn} 
                        className={`bg-white rounded-lg border shadow-sm transition-all duration-300
                          ${order.order_sn === selectedOrder?.nomor_invoice 
                            ? 'border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                            : 'hover:shadow-md'
                          }
                        `}
                      >
                        {/* Header Pesanan */}
                        <div className="p-3 border-b">
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xs font-medium">No. Pesanan: {order.order_sn}</h3>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-black text-white hover:bg-black text-xs">
                                {order.order_status}
                              </Badge>
                              <Button
                                onClick={() => handlePrintDocument(order)}
                                disabled={isLoadingForOrder(order.order_sn)}
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                              >
                                {isLoadingForOrder(order.order_sn) ? (
                                  <RefreshCcw size={12} className="animate-spin" />
                                ) : (
                                  <Printer size={12} className="text-primary hover:text-primary/80" />
                                )}
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-x-12 text-xs text-gray-500">
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
                                className="w-20 h-20 object-cover rounded-md border"
                              />
                              <div className="flex-1">
                                <h4 className="font-medium text-sm line-clamp-2 mb-1">
                                  {item.item_name}
                                </h4>
                                <p className="text-xs text-gray-600 mb-2">
                                  Variasi: {item.model_name}
                                </p>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-gray-600">
                                    {item.model_quantity_purchased}x
                                  </span>
                                  <span className="font-medium text-sm">
                                    Rp {item.model_discounted_price.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Footer dengan Total */}
                        <div className="p-3 bg-gray-50 rounded-b-lg border-t">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-sm">Total Belanja</span>
                            <span className="text-base font-bold">
                              Rp {order.total_belanja.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500">
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
