'use client'

import { SessionProvider, useSession } from "next-auth/react"
import { usePathname } from 'next/navigation'

// Komponen untuk mengecek autentikasi
function AuthCheck({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const pathname = usePathname()

  // Biarkan halaman login diakses
  if (pathname === '/login') {
    return <>{children}</>
  }

  // Untuk halaman lain, cek autentikasi
  if (status !== "authenticated") {
    return null
  }

  return <>{children}</>
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthCheck>{children}</AuthCheck>
    </SessionProvider>
  )
} 