import { Header } from "@/components/layout/Header"
import { Sidebar } from "@/components/layout/Sidebar"
import { GlobalNotification } from '@/components/GlobalNotification';
import { SSEProvider } from '../services/SSEService';
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Periksa autentikasi
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
   
      <div className="flex h-[100dvh] w-full overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 w-full md:pl-[56px] overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto overflow-x-hidden w-full">
            {children}
          </main>
        </div>
      </div>
 
  )
} 