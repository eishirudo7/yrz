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
  const [userId, setUserId] = useState<string | null>(null)
  const [shops, setShops] = useState<Shop[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  const supabase = createClient()
  
  // Fungsi untuk memuat data
  const loadUserData = async () => {
    setIsLoading(true)
    
    try {
      // Ambil data user yang sedang login
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setIsLoading(false)
        return
      }
      
      setUserId(user.id)
      
      // Ambil data toko
      const { data: shopData, error: shopError } = await supabase
        .from('shopee_tokens')
        .select('id, shop_id, shop_name, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      
      if (shopData && !shopError) {
        setShops(shopData)
      }
      
      // Ambil data subscription
      const { data: subscriptionData, error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .select(`
          id, 
          plan_id, 
          status, 
          start_date, 
          end_date,
          subscription_plans (
            id,
            name,
            max_shops,
            features
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (subscriptionData && !subscriptionError) {
        // Pastikan kita mengakses elemen pertama dari array (index 0)
        const planData = Array.isArray(subscriptionData.subscription_plans) 
          ? subscriptionData.subscription_plans[0] 
          : subscriptionData.subscription_plans;
        
        setSubscription({
          id: subscriptionData.id,
          plan_id: subscriptionData.plan_id,
          plan_name: planData.name,
          status: subscriptionData.status,
          start_date: subscriptionData.start_date,
          end_date: subscriptionData.end_date,
          max_shops: planData.max_shops,
          features: planData.features || []
        })
      } else {
        // Set default ke free jika tidak ada subscription aktif
        setSubscription(null)
      }
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
          loadUserData()
        } else if (event === 'SIGNED_OUT') {
          setUserId(null)
          setShops([])
          setSubscription(null)
        }
      }
    )
    
    // Cleanup listener
    return () => {
      authSubscription.unsubscribe()
    }
  }, [])
  
  // Fungsi untuk memuat ulang data
  const refreshData = async () => {
    await loadUserData()
  }
  
  useEffect(() => {
    // Log data setiap kali berubah
    console.log({
      userId,
      subscription,
      shops,
      isLoading
    });
  }, [userId, subscription, shops, isLoading]);
  
  // Tambahkan akses global untuk debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.__userData = {
        userId,
        subscription,
        shops,
        isLoading,
        refreshData
      };
      
      // @ts-ignore
      window.getUserData = () => {
        return {
          userId,
          subscription,
          shops,
          isLoading
        };
      };
    }
  }, [userId, subscription, shops, isLoading]);
  
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