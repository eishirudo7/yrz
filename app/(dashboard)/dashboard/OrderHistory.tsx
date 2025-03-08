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
import { Package2, Truck, User, Calendar, Receipt, Store } from 'lucide-react'
import { Card, CardContent, CardHeader } from "@/components/ui/card"

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

  return (
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
                        <Badge 
                          variant="outline" 
                          className="text-xs sm:text-sm whitespace-nowrap px-2 py-0.5"
                        >
                          {order.order_status}
                        </Badge>
                      </div>
                      {order.order_status === 'IN_CANCEL' || order.order_status === 'CANCELLED' ? (
                        <div className="mt-2">
                          <p className="text-xs sm:text-sm font-medium text-red-600">
                            {order.cancel_reason || 'Tidak ada alasan yang diberikan'}
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
            <div className="text-center py-4 text-gray-500">
              Data tidak ditemukan
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
} 