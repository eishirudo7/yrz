import { useState, useEffect } from 'react'
import axios from 'axios'
import { useToast } from "@/components/ui/use-toast"

interface ActiveOrderItem {
  order_id: string
  operator: string
  number: string
  serviceName: string
  price: string
  sms: string
  status_sms: string
  second_sms: boolean
  created_at: string
  expired_time: string
}

interface ActiveOrderResponse {
  status: boolean
  data: ActiveOrderItem[]
}

interface CopiedState {
  id: string;
  type: 'nomor' | 'otp';
}

export default function useOtpOrder() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [activeOrders, setActiveOrders] = useState<ActiveOrderItem[]>([])
  const [checkInterval, setCheckInterval] = useState<NodeJS.Timeout | null>(null)
  const [copiedState, setCopiedState] = useState<CopiedState | null>(null)
  const { toast } = useToast()

  const startChecking = () => {
    if (!checkInterval) {
      const interval = setInterval(checkActiveOrders, 7000)
      setCheckInterval(interval)
    }
  }

  const stopChecking = () => {
    if (checkInterval) {
      clearInterval(checkInterval)
      setCheckInterval(null)
    }
  }

  const processActiveOrders = async () => {
    const { data } = await axios.get('/api/otp?action=active_order')
    
    if (!data.status) {
      setActiveOrders([])
      stopChecking()
      console.log('Tidak ada orderan aktif')
      return false
    }

    const modifiedData = data.data.map((order: any) => ({
      order_id: order.order_id,
      operator: order.operator,
      number: order.number,
      serviceName: order.serviceName,
      price: order.price,
      sms: order.sms,
      status_sms: order.status_sms,
      second_sms: order.second_sms,
      created_at: order.created_at,
      expired_time: order.expired_time
    }))
    
    setActiveOrders(modifiedData)
    
    const hasPendingOrder = modifiedData.some((order: { status_sms: string }) => 
      order.status_sms.toLowerCase() === "waiting"
    )
    
    if (!hasPendingOrder) {
      stopChecking()
    }
    
    return hasPendingOrder
  }

  const checkActiveOrders = async () => {
    try {
      await processActiveOrders()
    } catch (err) {
      console.error('Error checking active orders:', err)
      setActiveOrders([])
    }
  }



  const orderOtp = async () => {
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/otp?action=order&operator_id=random')
      const data = await response.json()
      
      if (data.status) {
        startChecking()
        await checkActiveOrders()
      } else {
        setError(data.message || 'Terjadi kesalahan saat memesan nomor')
      }
    } catch (err) {
      setError('Terjadi kesalahan pada jaringan')
    } finally {
      setLoading(false)
    }
  }

  const cancelOrder = async (id: string, status: number = 2) => {
    try {
      const response = await axios.get(`/api/otp?action=set_status&order_id=${id}&status=${status}`)
      if (response.data.status) {
        toast({
          description: "Pesanan berhasil dibatalkan",
        })
        await checkActiveOrders()
      } else {
        toast({
          variant: "destructive",
          description: response.data.msg || "Gagal membatalkan pesanan",
        })
      }
    } catch (err) {
      console.error('Error setting status:', err)
      toast({
        variant: "destructive",
        description: "Terjadi kesalahan saat membatalkan pesanan",
      })
    }
  }

  const copyToClipboard = async (text: string, id: string, type: 'nomor' | 'otp' = 'nomor') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedState({ id, type })
      
      setTimeout(() => {
        setCopiedState(null)
      }, 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const canCancelOrder = (order: ActiveOrderItem) => {
    const minutes = parseInt(order.expired_time.split(' ')[0])
    return !isNaN(minutes) && minutes > 0 && minutes <= 17
  }

  useEffect(() => {
    const initialCheck = async () => {
      try {
        const hasPendingOrder = await processActiveOrders()
        if (hasPendingOrder) {
          startChecking()
        }
      } catch (err) {
        console.error('Error in initial check:', err)
        setActiveOrders([])
      }
    }
    
    initialCheck()
    return () => stopChecking()
  }, [])

  return {
    loading,
    error,
    orderOtp,
    activeOrders,
    cancelOrder,
    copyToClipboard,
    copiedState,
    canCancelOrder
  }
} 