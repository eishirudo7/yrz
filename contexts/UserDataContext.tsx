"use client";

// contexts/UserDataContext.tsx

import { createContext, useContext, ReactNode, useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

// Tipe data untuk toko
interface Shop {
  id: number
  shop_id: number
  shop_name: string
  is_active: boolean
}

// Tipe data untuk subscription
interface Subscription {
  id: string
  plan_id: string
  plan_name: string
  status: string
  start_date: string | null
  end_date: string | null
  max_shops: number
  features: string[]
}

// Tipe data untuk konteks
interface UserDataContextType {
  // Data user dan loading state
  userId: string | null
  isLoading: boolean
  
  // Data mentah dari database
  shops: Shop[]
  subscription: Subscription | null
  
  // Method untuk memuat ulang data
  refreshData: () => Promise<void>
}

// Buat konteks
const UserDataContext = createContext<UserDataContextType | undefined>(undefined)

// Provider konteks
export function UserDataProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()
  
  const [userId, setUserId] = useState<string | null>(null)
  const [shops, setShops] = useState<Shop[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastLoadTime, setLastLoadTime] = useState(0)
  const CACHE_DURATION = 5 * 60 * 1000 // 5 menit dalam milidetik
  
  const loadUserData = async (force = false) => {
    // Jika data sudah dimuat dalam 5 menit terakhir dan tidak force reload, 
    // jangan muat ulang data
    const now = Date.now()
    if (!force && lastLoadTime > 0 && now - lastLoadTime < CACHE_DURATION) {
      return // Gunakan data yang sudah di-cache
    }
    
    try {
      setIsLoading(true)

      // Ambil data user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setUserId(null)
        setShops([])
        setSubscription(null)
        return
      }

      setUserId(user.id)

      // Ambil data toko
      const { data: shopsData, error: shopsError } = await supabase
        .from('shopee_tokens')
        .select('*')
        .order('id', { ascending: true })

      if (shopsError) {
        throw shopsError
      }

      // Format data toko
      if (shopsData) {
        setShops(shopsData)
      }

      // Ambil data subscription
      const { data: subscriptionData, error: subscriptionError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('id', { ascending: false })
        .limit(1)
        .single()

      if (subscriptionError && subscriptionError.code !== 'PGRST116') {
        // PGRST116 adalah kode untuk "no rows returned", bukan error sebenarnya
        throw subscriptionError
      }

      // Format data subscription
      if (subscriptionData) {
        setSubscription(subscriptionData)
      } else {
        // Set default ke free jika tidak ada subscription aktif
        setSubscription(null)
      }
      
      // Update waktu terakhir data dimuat
      setLastLoadTime(now)
    } catch (error) {
      console.error('Error loading user data:', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  // Efek untuk memuat data saat komponen mount
  useEffect(() => {
    loadUserData()
    
    // Setup listener untuk perubahan auth state
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          loadUserData(true) // Force reload untuk event login
        } else if (event === 'SIGNED_OUT') {
          setUserId(null)
          setShops([])
          setSubscription(null)
          setLastLoadTime(0)
        }
      }
    )
    
    // Cleanup listener
    return () => {
      authSubscription.unsubscribe()
    }
  }, [])
  
  // Fungsi untuk memuat ulang data dengan flag force
  const refreshData = async () => {
    await loadUserData(true)
  }
  
  return (
    <UserDataContext.Provider value={{
      userId,
      shops,
      subscription,
      isLoading,
      refreshData
    }}>
      {children}
    </UserDataContext.Provider>
  )
}

// Hook untuk menggunakan konteks
export function useUserData() {
  const context = useContext(UserDataContext)
  if (context === undefined) {
    throw new Error('useUserData must be used within a UserDataProvider')
  }
  return context
}