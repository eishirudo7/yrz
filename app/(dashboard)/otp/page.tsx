'use client'

import { useState } from 'react'
import useOtpOrder from '@/app/hooks/useOtpOrder'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Loader2, Copy, CheckCircle, InboxIcon } from 'lucide-react'
import { motion } from "framer-motion"

export default function OtpPage() {
  const { loading, error, orderOtp, activeOrders, cancelOrder, copyToClipboard, copiedState, canCancelOrder } = useOtpOrder()
  const [cancelLoadingIds, setCancelLoadingIds] = useState<Set<string | number>>(new Set())

  

  const handleSetStatus = async (id: string | number, status: number) => {
    console.log('Order ID yang akan dikirim:', id)
    setCancelLoadingIds(prev => new Set(prev).add(id))
    try {
      await cancelOrder(id.toString(), status)
    } finally {
      setCancelLoadingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  return (
    <div className="container max-w-5xl mx-auto px-6 py-6 space-y-6">
      <Card>
        {error && (
          <div className="mx-6 mt-6 p-3 bg-destructive/10 text-destructive rounded-md">
            {error}
          </div>
        )}

        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Yorozuya OTP Service</h2>
              <Button 
                onClick={orderOtp} 
                disabled={loading}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Memproses...' : 'Pesan Nomor Baru'}
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[180px] font-semibold">Nomor</TableHead>
                    <TableHead className="hidden md:table-cell w-[150px] font-semibold">Layanan</TableHead>
                    <TableHead className="hidden md:table-cell w-[120px] font-semibold">Status</TableHead>
                    <TableHead className="text-center w-[180px] font-semibold">OTP</TableHead>
                    <TableHead className="hidden md:table-cell w-[120px] font-semibold">Sisa Waktu</TableHead>
                    <TableHead className="w-[150px] font-semibold">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeOrders.length > 0 ? (
                    activeOrders.map((order) => (
                      <TableRow 
                        key={order.order_id}
                        className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <TableCell>
                          <div className="flex items-center">
                            <span className="font-medium">{order.number}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyToClipboard(order.number, order.order_id, 'nomor')}
                            >
                              {copiedState?.id === order.order_id && copiedState?.type === 'nomor' ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <div className="md:hidden mt-1">
                            <motion.div
                              initial={{ scale: 0.8 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 200, damping: 10 }}
                            >
                              <Badge variant={
                                order.status_sms.toLowerCase() === 'success' || 
                                order.status_sms.toLowerCase() === 'sms recieved' ? 'success' :
                                order.status_sms.toLowerCase() === 'expired' ? 'destructive' :
                                order.status_sms.toLowerCase() === 'canceled' ? 'secondary' :
                                order.status_sms.toLowerCase() === 'waiting' ? 'warning' :
                                'warning'
                              }>
                                {order.status_sms.toLowerCase() === 'success' || 
                                 order.status_sms.toLowerCase() === 'sms recieved' ? 'Success' : order.status_sms}
                              </Badge>
                            </motion.div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{order.serviceName}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <motion.div
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 10 }}
                          >
                            <Badge variant={
                              order.status_sms.toLowerCase() === 'success' || 
                              order.status_sms.toLowerCase() === 'sms recieved' ? 'success' :
                              order.status_sms.toLowerCase() === 'expired' ? 'destructive' :
                              order.status_sms.toLowerCase() === 'canceled' ? 'secondary' :
                              order.status_sms.toLowerCase() === 'waiting' ? 'warning' :
                              'warning'
                            }>
                              {order.status_sms.toLowerCase() === 'success' || 
                               order.status_sms.toLowerCase() === 'sms recieved' ? 'Success' : order.status_sms}
                            </Badge>
                          </motion.div>
                        </TableCell>
                        <TableCell className="text-center">
                          {order.status_sms.toLowerCase() === 'waiting' ? (
                            <motion.div 
                              className="flex justify-center space-x-1"
                              initial={{ opacity: 0.5 }}
                              animate={{ opacity: 1 }}
                              transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
                            >
                              {[1, 2, 3].map((i) => (
                                <motion.div
                                  key={i}
                                  className="w-1.5 h-1.5 rounded-full bg-yellow-500"
                                  initial={{ y: 0 }}
                                  animate={{ y: [-2, 2, -2] }}
                                  transition={{
                                    repeat: Infinity,
                                    duration: 1,
                                    delay: i * 0.2,
                                    ease: "easeInOut"
                                  }}
                                />
                              ))}
                            </motion.div>
                          ) : (
                            <div className="flex items-center justify-center">
                              <span className="font-bold text-green-600">{order.sms}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => copyToClipboard(order.sms, order.order_id, 'otp')}
                              >
                                {copiedState?.id === order.order_id && copiedState?.type === 'otp' ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (order.status_sms.toLowerCase() === 'success' || 
                                    order.status_sms.toLowerCase() === 'sms recieved') && (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {order.expired_time}
                        </TableCell>
                        <TableCell>
                          {order.status_sms.toLowerCase() !== 'canceled' && 
                           order.status_sms.toLowerCase() !== 'expired' && (
                            <div className="flex flex-col md:flex-row gap-2">
                              {(order.status_sms.toLowerCase() === 'sms recieved') ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => handleSetStatus(order.order_id, 4)}
                                    disabled={cancelLoadingIds.has(order.order_id)}
                                  >
                                    {cancelLoadingIds.has(order.order_id) && (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Selesai
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                    onClick={() => handleSetStatus(order.order_id, 3)}
                                    disabled={cancelLoadingIds.has(order.order_id)}
                                  >
                                    {cancelLoadingIds.has(order.order_id) && (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Resend
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleSetStatus(order.order_id, 2)}
                                  disabled={
                                    cancelLoadingIds.has(order.order_id) || 
                                    parseInt(order.expired_time.split(' ')[0]) > 17
                                  }
                                >
                                  {cancelLoadingIds.has(order.order_id) && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  )}
                                  Batalkan
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-[400px] text-center">
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex flex-col items-center justify-center text-muted-foreground"
                        >
                          <InboxIcon className="h-16 w-16 mb-4 opacity-20" />
                          <p className="font-medium text-lg">Tidak ada pesanan aktif</p>
                          <p className="text-sm mt-1">Silakan pesan nomor OTP baru untuk memulai</p>
                        </motion.div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
