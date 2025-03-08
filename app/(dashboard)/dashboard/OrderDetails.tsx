import React, { useState, useEffect } from 'react'
import axios from 'axios'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Package2, Truck, User, Calendar, Store, PackageX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface OrderDetailsProps {
  orderSn: string
  isOpen: boolean
  onClose: () => void
}

interface OrderItem {
  item_id: number
  item_sku: string
  model_id: number
  image_url: string
  item_name: string
  model_sku: string
  model_name: string
  order_item_id: number
  model_original_price: number
  model_discounted_price: number
  model_quantity_purchased: number
}

interface OrderDetail {
  order_sn: string
  shop_name: string
  buyer_username: string
  pay_time: number
  total_amount: number
  shipping_carrier: string
  tracking_number: string
  order_status: string
  order_items: OrderItem[]
  total_belanja: number
  cancel_reason?: string
  shop_id: number
}

// Tambahkan fungsi untuk menentukan variant badge
const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'SHIPPED':
      return 'bg-blue-100 text-blue-800 hover:bg-blue-100'
    case 'COMPLETED':
      return 'bg-green-100 text-green-800 hover:bg-green-100'
    case 'IN_CANCEL':
    case 'CANCELLED':
      return 'bg-red-100 text-red-800 hover:bg-red-100'
    case 'READY_TO_SHIP':
      return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
    default:
      return 'bg-gray-100 text-gray-800 hover:bg-gray-100'
  }
}

export function OrderDetails({ orderSn, isOpen, onClose }: OrderDetailsProps) {
  const [orderDetails, setOrderDetails] = useState<OrderDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!orderSn || !isOpen) {
        setOrderDetails(null)
        return
      }
      
      setIsLoading(true)
      try {
        const response = await axios.get(`/api/order_details?order_sn=${orderSn}`)
        setOrderDetails(response.data.data[0])
      } catch (error) {
        console.error('Error fetching order details:', error)
        setOrderDetails(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrderDetails()
  }, [orderSn, isOpen])

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleCancelOrder = async () => {
    if (!orderDetails || !orderSn) return;

    try {
      const itemList = orderDetails.order_items.map(item => ({
        item_id: item.item_id,
        model_id: item.model_id
      }));

      const response = await fetch('/api/cancel-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shopId: orderDetails.shop_id,
          orderSn,
          itemList
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Pesanan telah dibatalkan');
        setShowConfirmDialog(false);
        onClose();
      } else {
        toast.error(data.message || 'Gagal membatalkan pesanan');
      }
    } catch (error) {
      toast.error('Terjadi kesalahan saat membatalkan pesanan');
    }
  };

  const renderCancelButton = (status: string) => {
    const allowedStatuses = ['UNPAID', 'READY_TO_SHIP', 'PROCESSED'];
    
    if (allowedStatuses.includes(status)) {
      return (
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setShowConfirmDialog(true)}
          className="h-6 w-6"
        >
          <PackageX className="h-4 w-4 text-destructive stroke-2" />
        </Button>
      );
    }
    return null;
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent 
          className="w-full sm:w-[80%] lg:max-w-[500px] p-2 sm:p-6 overflow-hidden" 
          side="right"
        >
          <SheetHeader className="mb-1">
            <SheetTitle className="text-lg font-bold">
              Detail Pesanan
            </SheetTitle>
            <SheetDescription className="sr-only">
              Detail informasi pesanan
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-80px)] pr-1 sm:pr-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : orderDetails ? (
              <div className="space-y-6">
                {/* Nomor Pesanan */}
                <div className="bg-muted p-2 sm:p-4 rounded-lg">
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2 justify-between w-full min-w-0">
                    <h3 className="text-xs sm:text-sm font-medium truncate min-w-0 flex-1">
                      {orderDetails.order_sn}
                    </h3>
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                      <Badge 
                        variant="outline" 
                        className="text-xs sm:text-sm whitespace-nowrap px-2 py-0.5"
                      >
                        {orderDetails.order_status}
                      </Badge>
                      {renderCancelButton(orderDetails.order_status)}
                    </div>
                  </div>
                  {orderDetails.order_status === 'IN_CANCEL' || orderDetails.order_status === 'CANCELLED' ? (
                    <div className="mt-2">
                      <p className="text-[10px] md:text-sm font-medium text-red-600">
                        {orderDetails.cancel_reason || 'Tidak ada alasan yang diberikan'}
                      </p>
                    </div>
                  ) : null}
                </div>

                {/* Informasi Toko & Pembeli */}
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Store className="h-4 w-4 mt-1" />
                    <div>
                      <p className="text-sm font-medium">Toko</p>
                      <p className="text-sm text-muted-foreground">{orderDetails.shop_name}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <User className="h-4 w-4 mt-1" />
                    <div>
                      <p className="text-sm font-medium">Pembeli</p>
                      <p className="text-sm text-muted-foreground">{orderDetails.buyer_username}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Calendar className="h-4 w-4 mt-1" />
                    <div>
                      <p className="text-sm font-medium">Tanggal Pembayaran</p>
                      <p className="text-sm text-muted-foreground">{formatDate(orderDetails.pay_time)}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Truck className="h-4 w-4 mt-1" />
                    <div>
                      <p className="text-sm font-medium">Informasi Pengiriman</p>
                      <p className="text-sm text-muted-foreground">
                        {orderDetails.shipping_carrier} - {orderDetails.tracking_number}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Detail Produk */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Package2 className="h-4 w-4" />
                    Detail Produk
                  </h3>
                  <div className="space-y-2">
                    {orderDetails?.order_items && orderDetails.order_items.length > 0 ? (
                      orderDetails.order_items.map((item, index) => (
                        <div key={index} className="border rounded-lg p-3 space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{item.item_sku}</p>
                              <p className="text-xs text-muted-foreground truncate">{item.model_name}</p>
                            </div>
                            <div className="text-xs text-right flex-shrink-0">
                              <p>Rp {item.model_discounted_price.toLocaleString('id-ID')}</p>
                              <p className="text-muted-foreground">Qty: {item.model_quantity_purchased}</p>
                            </div>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t">
                            <span className="text-xs">Subtotal</span>
                            <span className="text-xs font-medium">
                              Rp {(item.model_discounted_price * item.model_quantity_purchased).toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-xs text-muted-foreground">
                        Tidak ada data produk
                      </div>
                    )}
                  </div>
                </div>

                {/* Total */}
                <div className="bg-muted p-4 rounded-lg mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[12px] md:text-base font-semibold">Total Pembayaran</span>
                    <span className="text-[12px] md:text-base font-semibold">
                      Rp {orderDetails.total_belanja?.toLocaleString('id-ID') || '0'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                Data tidak ditemukan
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Pembatalan</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin membatalkan pesanan ini? 
              Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelOrder}
            >
              Ya, Batalkan Pesanan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
} 