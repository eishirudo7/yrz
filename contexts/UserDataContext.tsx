"use client";

// contexts/UserDataContext.tsx

import { createContext, useContext, ReactNode, useState, useEffect, useRef } from 'react'
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
  
  // Referensi untuk melacak apakah data sudah dimuat
  const isDataLoaded = useRef(false)
  // Referensi untuk melacak userId saat ini
  const currentUserIdRef = useRef<string | null>(null)
  
  const supabase = createClient()
  
  // Fungsi untuk memuat data
  const loadUserData = async (forceRefresh = false) => {
    // Cek apakah perlu memuat ulang data
    if (isDataLoaded.current && !forceRefresh) {
      console.log('[UserData]: Data sudah dimuat, skip loading');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true)
    
    try {
      // Ambil data user yang sedang login
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setIsLoading(false)
        return
      }
      
      // Cek apakah user ID berubah
      if (currentUserIdRef.current === user.id && !forceRefresh) {
        console.log('[UserData]: User ID sama, skip loading');
        setIsLoading(false);
        return;
      }
      
      setUserId(user.id)
      currentUserIdRef.current = user.id
      
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
      
      // Tandai bahwa data telah berhasil dimuat
      isDataLoaded.current = true;
      console.log('[UserData]: Data berhasil dimuat');
    } catch (error) {
      console.error('Error loading user data:', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  // Fungsi untuk memuat ulang data
  const refreshData = async () => {
    console.log('[UserData]: Memuat ulang data (force refresh)');
    await loadUserData(true)
  }

  // Inisialisasi data saat komponen dimuat pertama kali
  useEffect(() => {
    loadUserData()
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab menjadi aktif lagi, tapi tidak perlu memuat ulang data
        console.log('[UserData]: Tab menjadi aktif, namun tidak memicu fetch ulang');
      }
    };
    
    // Tambahkan listener untuk perubahan visibilitas tab
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Setup listener untuk perubahan auth state
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log(`[Auth Event]: ${event}`, { session: session?.user?.email || 'No active session' });
        
        if (event === 'SIGNED_IN') {
          // Cek apakah ini adalah proses login awal atau pindah tab
          const isNewLogin = currentUserIdRef.current !== session?.user?.id;
          console.log(`[UserData]: SIGNED_IN - ${isNewLogin ? 'Login baru' : 'Same user kembali ke tab'}`);
          
          if (isNewLogin) {
            console.log(`[UserData]: Memuat ulang data pengguna setelah login baru`);
            loadUserData(true);
          }
        } else if (event === 'TOKEN_REFRESHED') {
          // Tidak perlu memuat ulang data hanya karena token di-refresh
          console.log('[UserData]: Token di-refresh, tidak perlu memuat ulang data');
        } else if (event === 'SIGNED_OUT') {
          console.log('[UserData]: Menghapus data pengguna setelah logout');
          setUserId(null)
          setShops([])
          setSubscription(null)
          isDataLoaded.current = false;
          currentUserIdRef.current = null;
        }
      }
    )
    
    // Cleanup listener
    return () => {
      console.log('[UserData]: Membersihkan auth listener dan visibility listener');
      authSubscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }, [])
  
  // Effect untuk log perubahan data
  useEffect(() => {
    // Format data subscription agar lebih mudah dibaca
    const formattedSubscription = subscription ? {
      ...subscription,
      features: subscription.features?.length ? `[${subscription.features.length} fitur]` : '[]'
    } : null;
    
    // Format data shops agar lebih mudah dibaca
    const formattedShops = shops.length ? 
      `[${shops.length} toko: ${shops.map(shop => shop.shop_name).join(', ')}]` : 
      '[]';
    
    console.log('[UserData Context]:', {
      userId,
      isLoading,
      subscription: formattedSubscription ? {
        plan_name: formattedSubscription.plan_name,
        max_shops: formattedSubscription.max_shops,
        status: formattedSubscription.status,
        features: formattedSubscription.features
      } : 'null',
      shops: formattedShops
    });
  }, [userId, shops, subscription, isLoading]);
  
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