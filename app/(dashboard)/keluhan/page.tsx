'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { useKeluhan, Keluhan } from '@/app/hooks/useKeluhan'
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

export default function OrderChangesPage() {
  const { 
    keluhan, 
    loading, 
    error, 
    updateStatusPesanan, 
    hapusPerubahanPesanan,
    chats,
    sendMessage,
    fetchChats,
    isLoadingSend
  } = useKeluhan()
  const { toast } = useToast()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Keluhan | null>(null)
  const [chatMessage, setChatMessage] = useState('')
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const handleStatusClick = async (order: Keluhan) => {
    // Pastikan status_keluhan memiliki nilai default jika null
    const currentStatus = order.status_keluhan || "BELUM DITANGANI"
    const newStatus = currentStatus === "BELUM DITANGANI" ? "SUDAH DITANGANI" : "BELUM DITANGANI"
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

  const handleChatClick = async (order: Keluhan) => {
    setSelectedOrder(order)
    setIsDialogOpen(true)
    if (order.msg_id && order.store_id) {
      await fetchChats(order.msg_id.toString(), order.store_id)
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
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">Data Perubahan Pesanan</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {keluhan.map((order) => (
          <Card key={order.id} className="overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 bg-white dark:bg-gray-800 flex flex-col">
            <CardHeader className="p-4 bg-gray-50 dark:bg-gray-900">
              <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300 flex justify-between items-center">
                <span>No. Invoice: {order.nomor_invoice || 'N/A'}</span>
                <MessageSquare 
                  className="h-5 w-5 text-blue-500 hover:text-blue-600 cursor-pointer transition-colors duration-200" 
                  onClick={() => handleChatClick(order)}
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex-grow">
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{order.nama_toko}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">ID: {order.id_pengguna}</p>
              </div>
              
              <div className="flex space-x-3 mb-3">
                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md flex-1">
                  <h3 className="font-semibold text-xs mb-2 text-gray-700 dark:text-gray-300">Jenis Keluhan:</h3>
                  <p className="text-xs mb-1 text-gray-800 dark:text-gray-200">{order.jenis_keluhan}</p>
                </div>
                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md flex-1">
                  <h3 className="font-semibold text-xs mb-2 text-gray-700 dark:text-gray-300">Deskripsi Keluhan:</h3>
                  <p className="text-xs text-gray-800 dark:text-gray-200">{order.deskripsi_keluhan || 'Tidak ada deskripsi'}</p>
                </div>
              </div>
              <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                <p>Dibuat: {new Date(order.create_at ?? '').toLocaleString()}</p>
                <Badge variant="outline" className="font-semibold">{order.status_pesanan}</Badge>
              </div>
            </CardContent>
            <CardFooter className="p-4 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
              <Button 
                variant={order.status_keluhan === "SUDAH DITANGANI" ? "default" : "destructive"}
                size="sm"
                className="flex items-center text-xs py-1 px-3 h-auto min-h-0 transition-colors duration-200"
                onClick={() => handleStatusClick(order)}
              >
                <FileText className="h-3 w-3 mr-2" />
                {order.status_keluhan || "BELUM DITANGANI"} {/* Tambahkan nilai default */}
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
        <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[90vh] flex flex-col bg-white dark:bg-gray-800">
          <DialogHeader className="py-2 border-b border-gray-200 dark:border-gray-700">
            <DialogTitle className="text-sm flex justify-between items-center text-gray-900 dark:text-gray-100">
              <span className="font-medium">{selectedOrder?.nomor_invoice}</span>
              <span className="text-gray-500 dark:text-gray-400">
                {selectedOrder?.nama_toko.split(' ')[0]}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">ID: {selectedOrder?.id_pengguna}</span>
            </DialogTitle>
          </DialogHeader>
          <div ref={chatContainerRef} className="flex-grow overflow-y-auto p-2 sm:p-4 space-y-3">
            {chats.map((chat) => (
              <div key={chat.id} className={`flex ${chat.sender === 'seller' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-2 sm:p-3 rounded-lg ${chat.sender === 'seller' ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-700'}`}>
                  <p className="text-xs sm:text-sm text-gray-900 dark:text-gray-100">{chat.message}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1">{new Date(chat.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={handleSendMessage} className="mt-2 flex items-center space-x-2 p-2 sm:p-4 border-t border-gray-200 dark:border-gray-700">
            <Input
              type="text"
              placeholder="Ketik pesan..."
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              className="flex-grow text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
              disabled={isLoadingSend}
            />
            <Button type="submit" size="sm" disabled={isLoadingSend}>
              <Send className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
