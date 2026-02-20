import { useEffect, useState, useCallback } from 'react'
import { DateRange } from 'react-day-picker'
import { useUserData } from '@/contexts/UserDataContext'
import { toast } from 'sonner'

export interface Booking {
  id: number
  booking_sn: string
  shop_id: number
  shop_name?: string
  order_sn?: string
  booking_status: string
  match_status?: string
  shipping_carrier?: string
  create_time: number
  update_time: number
  recipient_address?: {
    name: string
    phone: string
    town: string
    district: string
    city: string
    state: string
    region: string
    zipcode: string
    full_address: string
  }
  item_list?: Array<{
    item_name: string
    item_sku?: string
    model_name?: string
    model_sku?: string
    weight?: number
    product_location_id?: string
    image_info?: {
      image_url?: string
    }
  }>
  dropshipper?: string
  dropshipper_phone?: string
  cancel_by?: string
  cancel_reason?: string
  fulfillment_flag?: string
  pickup_done_time?: number
  tracking_number?: string
  is_printed: boolean
  document_status: string
  // Computed fields
  buyer_username?: string
  total_amount?: number
  payment_method?: string
}

export interface BookingSummary {
  pending: number
  confirmed: number
  cancelled: number
  completed: number
  ready_to_ship: number
  total: number
}

export interface Shop {
  shop_id: number
  shop_name: string
  is_active: boolean
}

export function useBookings(dateRange?: DateRange | undefined) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [summary, setSummary] = useState<BookingSummary>({
    pending: 0,
    confirmed: 0,
    cancelled: 0,
    completed: 0,
    ready_to_ship: 0,
    total: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastDateRange, setLastDateRange] = useState<DateRange | undefined>(dateRange)

  const { userId } = useUserData()

  // Fetch shops first
  const fetchShops = useCallback(async () => {
    try {
      const response = await fetch('/api/shops')
      if (!response.ok) {
        throw new Error('Gagal mengambil daftar toko')
      }

      const result = await response.json()
      if (result.success) {
        setShops(result.data || [])
        return result.data || []
      } else {
        throw new Error(result.message || 'Gagal mengambil daftar toko')
      }
    } catch (err) {
      console.error('Error fetching shops:', err)
      setError(err instanceof Error ? err.message : 'Gagal mengambil daftar toko')
      return []
    }
  }, [])

  const fetchBookings = useCallback(async (dateRangeToUse: DateRange | undefined = dateRange) => {
    if (!dateRangeToUse?.from) return

    try {
      setLoading(true)
      setError(null)

      // Simpan parameter ini untuk refetch nanti
      setLastDateRange(dateRangeToUse)

      // Konversi tanggal ke UNIX timestamp (dalam detik)
      const startDate = new Date(dateRangeToUse.from)
      const endDate = new Date(dateRangeToUse.to || dateRangeToUse.from)

      startDate.setHours(0, 0, 0, 0)
      endDate.setHours(23, 59, 59, 999)

      const startTimestamp = Math.floor(startDate.getTime() / 1000)
      const endTimestamp = Math.floor(endDate.getTime() / 1000)

      // Gunakan API database lokal
      const params = new URLSearchParams({
        startTime: startTimestamp.toString(),
        endTime: endTimestamp.toString(),
        bookingStatus: 'ALL',
        pageSize: '100'
      });

      const response = await fetch(`/api/booking-orders?${params.toString()}`)

      if (!response.ok) {
        if (response.status === 504) {
          throw new Error('Request timeout. Silahkan coba kurangi rentang tanggal atau coba lagi nanti.');
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        setBookings(result.data || [])
        setSummary(result.summary || {
          pending: 0,
          confirmed: 0,
          cancelled: 0,
          completed: 0,
          ready_to_ship: 0,
          total: 0
        })
      } else {
        throw new Error(result.message || 'Terjadi kesalahan saat mengambil data booking')
      }

    } catch (err) {
      console.error('Error fetching bookings:', err)
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat mengambil data booking')
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  // Fungsi refetch yang dapat dipanggil dari luar
  const refetch = useCallback(() => {
    return fetchBookings(lastDateRange);
  }, [fetchBookings, lastDateRange]);

  // Fungsi untuk mengambil detail booking
  const getBookingDetail = useCallback(async (bookingSn: string) => {
    try {
      // Cari booking di state lokal
      const booking = bookings.find(b => b.booking_sn === bookingSn)
      if (!booking) {
        throw new Error('Booking tidak ditemukan')
      }

      // Return data yang sudah ada karena dari database sudah lengkap
      return booking
    } catch (err) {
      console.error('Error fetching booking detail:', err)
      throw err
    }
  }, [bookings])

  // Fungsi untuk ship booking - menggunakan API Shopee
  const shipBooking = useCallback(async (
    bookingSn: string,
    shippingMethod: 'pickup' | 'dropoff' = 'dropoff'
  ) => {
    try {
      // Cari booking di state lokal untuk mendapatkan shop_id
      const booking = bookings.find(b => b.booking_sn === bookingSn)
      if (!booking) {
        throw new Error('Booking tidak ditemukan')
      }

      const response = await fetch('/api/shopee/ship-booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shopId: booking.shop_id,
          bookingSn,
          shippingMethod
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        toast.success(`Booking ${bookingSn} berhasil dikirim`)
        // Refresh data setelah berhasil ship
        await refetch()
        return result.data
      } else {
        throw new Error(result.message || 'Gagal mengirim booking')
      }
    } catch (err) {
      console.error('Error shipping booking:', err)
      toast.error(`Gagal mengirim booking: ${err instanceof Error ? err.message : 'Unknown error'}`)
      throw err
    }
  }, [bookings, refetch])

  // Fungsi untuk mendapatkan tracking number
  const getTrackingNumber = useCallback(async (bookingSn: string, packageNumber?: string) => {
    try {
      // Cari booking di state lokal
      const booking = bookings.find(b => b.booking_sn === bookingSn)
      if (!booking) {
        return {
          success: false,
          message: 'Booking tidak ditemukan'
        }
      }

      // Jika tracking number sudah ada di database, return langsung
      if (booking.tracking_number) {
        return {
          success: true,
          data: {
            tracking_number: booking.tracking_number,
            shipping_carrier: booking.shipping_carrier
          }
        }
      }

      // Jika belum ada, ambil dari API Shopee
      const url = packageNumber
        ? `/api/shopee/booking-tracking-number?shopId=${booking.shop_id}&bookingSn=${bookingSn}&packageNumber=${packageNumber}`
        : `/api/shopee/booking-tracking-number?shopId=${booking.shop_id}&bookingSn=${bookingSn}`

      const response = await fetch(url)

      if (!response.ok) {
        return {
          success: false,
          message: `HTTP error! status: ${response.status}`
        }
      }

      const result = await response.json()

      if (result.success) {
        return {
          success: true,
          data: result.data
        }
      } else {
        return {
          success: false,
          message: result.message || 'Gagal mengambil tracking number'
        }
      }
    } catch (err) {
      console.error('Error fetching tracking number:', err)
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error'
      }
    }
  }, [bookings])

  // Fetch shops on component mount
  useEffect(() => {
    fetchShops()
  }, [fetchShops])

  useEffect(() => {
    if (dateRange?.from) {
      fetchBookings(dateRange)
    }
  }, [dateRange, fetchBookings])

  return {
    bookings,
    shops,
    summary,
    loading,
    error,
    refetch,
    getBookingDetail,
    shipBooking,
    getTrackingNumber
  }
} 