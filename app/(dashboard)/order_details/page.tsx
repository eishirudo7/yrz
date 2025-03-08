'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Store } from "lucide-react"

interface OrderItem {
  item_id: number
  item_name: string
  model_name: string
  model_quantity_purchased: number
  model_discounted_price: number
  image_url: string
}

interface OrderDetail {
  order_sn: string
  buyer_username: string
  create_time: number
  order_status: string
  total_amount: number
  shipping_carrier: string
  estimated_shipping_fee: number
  payment_method: string
  order_items: OrderItem[]
  tracking_number: string | null
  shop_name: string
  cancel_reason?: string
  order_chargeable_weight_gram?: number
  ship_by_date?: number
  message_to_seller?: string
  total_belanja?: number
}

import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

// Tambahkan informasi status yang lebih informatif
const getStatusLabel = (status: string) => {
  const statusMap: { [key: string]: string } = {
    'CANCELLED': 'Dibatalkan',
    'SHIPPED': 'Dalam Pengiriman',
    'COMPLETED': 'Selesai',
    'TO_SHIP': 'Perlu Dikirim',
    // ... tambahkan status lainnya
  }
  return statusMap[status] || status
}

export default function OrderDetails() {
  const searchParams = useSearchParams()
  const [orderDetails, setOrderDetails] = useState<OrderDetail[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const userId = searchParams.get('user_id')
    if (userId) {
      fetchOrderDetails(userId)
    }
  }, [searchParams])

  const fetchOrderDetails = async (userId: string) => {
    try {
      const response = await fetch(`/api/order_details?user_id=${userId}`)
      const data = await response.json()
      setOrderDetails(data.data)
    } catch (error) {
      console.error('Error fetching order details:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-4">Memuat data...</div>
  }

  return (
    <div className="p-4 max-w-4xl mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-center">Detail Pesanan</h1>
      {orderDetails.map((order) => (
        <Card key={order.order_sn} className="mb-6 shadow-md hover:shadow-lg transition-shadow">
          {/* Header Card */}
          <CardHeader className="bg-white border-b">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">No. Pesanan:</span>
                  <span className="font-mono">{order.order_sn}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-gray-600" />
                  <span className="text-gray-600">{order.shop_name}</span>
                </div>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                  order.order_status === 'CANCELLED' 
                    ? 'bg-red-100 text-red-700' 
                    : order.order_status === 'COMPLETED'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {getStatusLabel(order.order_status)}
                </span>
                {order.cancel_reason && (
                  <p className="text-sm text-red-500 mt-2 bg-red-50 p-2 rounded">
                    Alasan Pembatalan: {order.cancel_reason}
                  </p>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6 p-6">
            {/* Informasi Dasar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfoItem 
                label="Pembeli" 
                value={order.buyer_username}
                icon="user"
              />
              <InfoItem 
                label="Tanggal Pesanan" 
                value={new Date(order.create_time * 1000).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
                icon="calendar"
              />
              <InfoItem 
                label="Kurir" 
                value={order.shipping_carrier}
                icon="truck"
              />
              <InfoItem 
                label="Metode Pembayaran" 
                value={order.payment_method}
                icon="credit-card"
              />
            </div>

            <Separator />
            
            {/* Daftar Produk */}
            <div>
              <h3 className="font-semibold text-lg mb-4">Produk yang Dibeli</h3>
              <div className="space-y-4">
                {order.order_items.map((item) => (
                  <div key={item.item_id} className="flex gap-4 bg-white p-4 rounded-lg shadow-sm">
                    <img 
                      src={item.image_url} 
                      alt={item.item_name}
                      className="w-24 h-24 object-cover rounded-md"
                    />
                    <div className="flex-1 space-y-2">
                      <p className="font-medium line-clamp-2">{item.item_name}</p>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <span>Variasi: {item.model_name}</span>
                        <span>Jumlah: {item.model_quantity_purchased}</span>
                      </div>
                      <p className="text-lg font-semibold text-blue-600">
                        Rp {item.model_discounted_price.toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Informasi Pengiriman */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Informasi Pengiriman
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <p className="flex items-center gap-2">
                    <span className="font-medium">Berat Paket:</span>
                    <span>{order.order_chargeable_weight_gram}g</span>
                  </p>
                  {order.tracking_number && (
                    <p className="flex items-center gap-2">
                      <span className="font-medium">No. Resi:</span>
                      <span className="font-mono">{order.tracking_number}</span>
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  {order.ship_by_date && (
                    <p className="flex items-center gap-2">
                      <span className="font-medium">Kirim sebelum:</span>
                      <span>{new Date(order.ship_by_date * 1000).toLocaleDateString('id-ID')}</span>
                    </p>
                  )}
                  {order.message_to_seller && (
                    <p className="flex items-center gap-2">
                      <span className="font-medium">Pesan:</span>
                      <span>{order.message_to_seller}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>

          <Separator />
          
          {/* Footer dengan Total */}
          <CardFooter className="flex flex-col items-end gap-3 pt-4 bg-gray-50">
            <div className="w-full md:w-72 space-y-2 bg-white p-4 rounded-lg shadow-sm">
              <div className="flex justify-between text-gray-600">
                <span>Total Belanja:</span>
                <span>Rp {(order.total_belanja || 0).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Ongkos Kirim:</span>
                <span>Rp {order.estimated_shipping_fee.toLocaleString('id-ID')}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-center">
                <span className="font-medium">Total Pembayaran:</span>
                <span className="text-xl font-bold text-blue-600">
                  Rp {order.total_amount.toLocaleString('id-ID')}
                </span>
              </div>
              {order.payment_method === "Cash on Delivery" && (
                <div className="mt-2 text-sm text-gray-500 bg-gray-50 p-2 rounded">
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Pembayaran COD
                  </span>
                </div>
              )}
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

// Komponen InfoItem untuk informasi dasar
const InfoItem = ({ label, value, icon }: { label: string, value: string, icon: string }) => (
  <div className="bg-white p-3 rounded-lg shadow-sm">
    <p className="text-sm text-gray-600 mb-1">{label}</p>
    <p className="font-medium">{value}</p>
  </div>
)
