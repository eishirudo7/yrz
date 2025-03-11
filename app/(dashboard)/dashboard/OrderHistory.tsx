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
import { Package2, Truck, User, Calendar, Receipt, Store, CheckCircle, XCircle, PackageX } from 'lucide-react'
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface OrderHistoryProps {
  userId: string | number
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

interface Order {
  order_sn: string
  buyer_user_id: number
  create_time: number
  estimated_shipping_fee: number
  actual_shipping_fee_confirmed: boolean
  cod: boolean
  days_to_ship: number
  ship_by_date: number
  payment_method: string
  fulfillment_flag: string
  message_to_seller: string
  note: string
  note_update_time: number
  order_chargeable_weight_gram: number
  pickup_done_time: number
  cancel_by: string
  shipping_carrier_info: string
  shop_id: number
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

export function OrderHistory({ userId, isOpen, onClose }: OrderHistoryProps) {
  const [orderHistory, setOrderHistory] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedAction, setSelectedAction] = useState<{
    orderSn: string;
    action: 'ACCEPT' | 'REJECT';
    shopId: number;
  }>({ orderSn: '', action: 'ACCEPT', shopId: 0 })
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [selectedOrderToCancel, setSelectedOrderToCancel] = useState<{
    orderSn: string;
    shopId: number;
    items: { item_id: number; model_id: number }[];
  }>({ orderSn: '', shopId: 0, items: [] })

  useEffect(() => {
    const fetchOrderHistory = async () => {
      if (!userId || !isOpen) {
        
        setOrderHistory([]);
        return;
      }
      
      console.log('Fetching order history for userId:', userId);
      setIsLoading(true);
      try {
        const response = await axios.get(`/api/order_details?user_id=${userId}`);
        console.log('API Response:', response.data);
        setOrderHistory(response.data.data);
      } catch (error) {
        console.error('Error fetching order history:', error);
        setOrderHistory([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrderHistory();
  }, [userId, isOpen]);

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleCancellationAction = async (orderSn: string, shopId: number, action: 'ACCEPT' | 'REJECT') => {
    setSelectedAction({ orderSn, action, shopId });
    setIsConfirmOpen(true);
  };

  const handleConfirmAction = async () => {
    setIsConfirmOpen(false);
    
    try {
      toast.promise(
        async () => {
          const response = await fetch('/api/orders/handle-cancellation', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              shopId: selectedAction.shopId,
              orderSn: selectedAction.orderSn,
              operation: selectedAction.action
            })
          });

          const result = await response.json();
          
          if (!result.success) {
            throw new Error(result.message || 'Gagal memproses pembatalan');
          }

          // Update local state jika berhasil
          setOrderHistory(prev => 
            prev.map(order => 
              order.order_sn === selectedAction.orderSn 
                ? { 
                    ...order, 
                    order_status: selectedAction.action === 'ACCEPT' ? 'CANCELLED' : 'READY_TO_SHIP' 
                  } 
                : order
            )
          );

          return result;
        },
        {
          loading: 'Memproses pembatalan...',
          success: `Berhasil ${selectedAction.action === 'ACCEPT' ? 'menerima' : 'menolak'} pembatalan`,
          error: (err) => `${err.message}`
        }
      );
    } catch (error) {
      console.error('Gagal memproses pembatalan:', error);
    }
  };

  const handleShowCancelDialog = (order: Order) => {
    const itemList = order.order_items.map(item => ({
      item_id: item.item_id,
      model_id: item.model_id
    }));
    
    setSelectedOrderToCancel({
      orderSn: order.order_sn,
      shopId: order.shop_id,
      items: itemList
    });
    
    setShowCancelDialog(true);
  };

  const handleCancelOrder = async () => {
    setShowCancelDialog(false);
    
    try {
      toast.promise(
        async () => {
          const response = await fetch('/api/cancel-order', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              shopId: selectedOrderToCancel.shopId,
              orderSn: selectedOrderToCancel.orderSn,
              itemList: selectedOrderToCancel.items
            })
          });

          const data = await response.json();

          if (!data.success) {
            throw new Error(data.message || 'Gagal membatalkan pesanan');
          }

          // Update local state jika berhasil
          setOrderHistory(prev => 
            prev.map(order => 
              order.order_sn === selectedOrderToCancel.orderSn 
                ? { ...order, order_status: 'IN_CANCEL' } 
                : order
            )
          );

          return data;
        },
        {
          loading: 'Membatalkan pesanan...',
          success: 'Pesanan telah dibatalkan',
          error: (err) => `${err.message}`
        }
      );
    } catch (error) {
      console.error('Terjadi kesalahan saat membatalkan pesanan:', error);
    }
  };

  const canCancelOrder = (status: string): boolean => {
    const allowedStatuses = ['UNPAID', 'READY_TO_SHIP', 'PROCESSED'];
    return allowedStatuses.includes(status);
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent 
          className="w-[95%] sm:w-[80%] lg:max-w-[500px] p-3 sm:p-6" 
          side="right"
        >
          <SheetHeader className="mb-1">
            <SheetTitle className="text-lg font-bold">
              Riwayat Pesanan
            </SheetTitle>
            <SheetDescription className="sr-only">
              Daftar riwayat pesanan pengguna
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-80px)] pr-2 sm:pr-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : orderHistory.length > 0 ? (
              <div className="space-y-6">
                {orderHistory.map((order, index) => (
                  <Card key={order.order_sn} className="shadow-sm">
                    <CardContent className="space-y-6 pt-6">
                      {/* Nomor Pesanan */}
                      <div className="bg-muted p-2 sm:p-4 rounded-lg">
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2 justify-between w-full min-w-0">
                          <h3 className="text-xs sm:text-sm font-medium truncate min-w-0 flex-1">
                            {order.order_sn}
                          </h3>
                          <div className="flex items-center gap-1">
                            <Badge 
                              variant="outline" 
                              className="text-xs sm:text-sm whitespace-nowrap px-2 py-0.5"
                            >
                              {order.order_status}
                            </Badge>
                            {canCancelOrder(order.order_status) && (
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleShowCancelDialog(order)}
                                className="h-6 w-6 dark:hover:bg-gray-700"
                                title="Batalkan Pesanan"
                              >
                                <PackageX className="h-4 w-4 text-destructive stroke-2 dark:text-red-400" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {order.order_status === 'IN_CANCEL' || order.order_status === 'CANCELLED' ? (
                          <div className="mt-2">
                            <p className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-400">
                              {order.cancel_reason || 'Tidak ada alasan yang diberikan'}
                            </p>
                            {order.order_status === 'IN_CANCEL' && (
                              <div className="flex gap-2 mt-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="h-7 px-2 text-xs bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:text-green-800 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/50 dark:hover:text-green-300"
                                  onClick={() => handleCancellationAction(order.order_sn, order.shop_id, 'ACCEPT')}
                                >
                                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                  Terima Pembatalan
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="h-7 px-2 text-xs bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:text-red-800 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/50 dark:hover:text-red-300"
                                  onClick={() => handleCancellationAction(order.order_sn, order.shop_id, 'REJECT')}
                                >
                                  <XCircle className="h-3.5 w-3.5 mr-1" />
                                  Tolak
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>

                      {/* Informasi Toko & Pembeli */}
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <Store className="h-4 w-4 mt-1" />
                          <div>
                            <p className="text-sm font-medium">Toko</p>
                            <p className="text-sm text-muted-foreground">{order.shop_name}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <User className="h-4 w-4 mt-1" />
                          <div>
                            <p className="text-sm font-medium">Pembeli</p>
                            <p className="text-sm text-muted-foreground">{order.buyer_username}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <Calendar className="h-4 w-4 mt-1" />
                          <div>
                            <p className="text-sm font-medium">Tanggal Pembayaran</p>
                            <p className="text-sm text-muted-foreground">{formatDate(order.pay_time)}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <Truck className="h-4 w-4 mt-1" />
                          <div>
                            <p className="text-sm font-medium">Informasi Pengiriman</p>
                            <p className="text-sm text-muted-foreground">
                              {order.shipping_carrier} - {order.tracking_number}
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
                          {order.order_items && order.order_items.length > 0 ? (
                            order.order_items.map((item, index) => (
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
                          <span className="text-xs sm:text-sm font-semibold">Total Pembayaran</span>
                          <span className="text-xs sm:text-sm font-semibold">
                            Rp {order.total_belanja?.toLocaleString('id-ID') || '0'}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Tidak ada riwayat pesanan</p>
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">
              Konfirmasi {selectedAction.action === 'ACCEPT' ? 'Terima' : 'Tolak'} Pembatalan
            </AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-300">
              {selectedAction.action === 'ACCEPT' 
                ? 'Anda akan menerima permintaan pembatalan pesanan ini. Pesanan akan dibatalkan. Lanjutkan?' 
                : 'Anda akan menolak permintaan pembatalan pesanan ini. Pesanan akan tetap diproses. Lanjutkan?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 dark:border-gray-600">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmAction}
              className={selectedAction.action === 'ACCEPT' 
                ? "bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-800"
                : "bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800"
              }
            >
              {selectedAction.action === 'ACCEPT' ? 'Terima Pembatalan' : 'Tolak Pembatalan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Konfirmasi Pembatalan</DialogTitle>
            <DialogDescription className="dark:text-gray-300">
              Apakah Anda yakin ingin membatalkan pesanan ini? 
              Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              className="dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 dark:border-gray-600"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelOrder}
              className="dark:bg-red-700 dark:hover:bg-red-800"
            >
              Ya, Batalkan Pesanan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
} 