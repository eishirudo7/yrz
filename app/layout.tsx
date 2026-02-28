import '@/app/globals.css'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner';

import MiniChatContainer from '@/components/MiniChatContainer';
import { UserDataProvider } from '@/contexts/UserDataContext'
import { SSEProvider } from '@/app/services/SSEService';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { GlobalNotification } from '@/components/GlobalNotification';
import StoreInitializer from '@/components/StoreInitializer';

import type { Viewport } from 'next'


const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Dashboard',
  description: 'Yorozuya Management System',
  icons: {
    icon: [
      { url: '/favicon-16x16.png?v=1', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png?v=1', sizes: '32x32', type: 'image/png' },
      { url: '/android-chrome-192x192.png?v=1', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png?v=1', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png?v=1', sizes: '180x180', type: 'image/png' },
    ],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: false,
}

interface RootLayoutProps {
  children: React.ReactNode
}


export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className="h-full overflow-hidden" suppressHydrationWarning>
      <body className={`h-full ${inter.className}`}>
        <UserDataProvider>
          <SSEProvider>
            <StoreInitializer />
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <GlobalNotification />
              {children}
            </ThemeProvider>
            <MiniChatContainer />
          </SSEProvider>
        </UserDataProvider>
        <Toaster richColors expand={false} position="top-right" />
      </body>
    </html>
  )
}