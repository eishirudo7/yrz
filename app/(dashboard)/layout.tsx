import { Header } from "@/components/layout/Header"
import { Sidebar } from "@/components/layout/Sidebar"
import { GlobalNotification } from '@/components/GlobalNotification';
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
    <>
      <GlobalNotification />
      <div className="flex h-[100dvh]">
        <Sidebar />
        <div className="flex flex-col">
          <Header />
          <main>
            {children}
          </main>
        </div>
      </div>
    </>
  )
} 