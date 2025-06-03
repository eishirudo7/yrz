'use client'

import React from "react"
import {
  LayoutDashboard,
  MessageSquare,
  ShoppingCart,
  Megaphone,
  Store,
  Settings,
  CodeXml,
  AlertCircle,
  KeyRound,
  Percent,
  ShoppingBag,
  Package,
  Zap,
  RotateCcw,
  UserIcon,
  Star,
  CalendarCheck
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import useStoreChat from "@/stores/useStoreChat"
import { useUserData } from "@/contexts/UserDataContext"
import { Badge } from "@/components/ui/badge"

export const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard', showAlways: true },
  { href: '/webchat', icon: MessageSquare, label: 'Chat', showAlways: true },
  { href: '/orders', icon: ShoppingBag, label: 'Orders', showAlways: true },
  { href: '/booking', icon: CalendarCheck, label: 'Booking Orders', showAlways: true },
  { href: '/ubah_pesanan', icon: ShoppingCart, label: 'Perubahan Pesanan', proOnly: true },
  { href: '/return', icon: RotateCcw, label: 'Return', showAlways: true },
  { href: '/produk', icon: Package, label: 'Produk', showAlways: true },
  { href: '/ulasan', icon: Star, label: 'Ulasan Produk', showAlways: true },
  { href: '/flashsale', icon: Zap, label: 'Flash Sale', showAlways: true },
  { href: '/ads', icon: Megaphone, label: 'Iklan', showAlways: true },
  { href: '/shops', icon: Store, label: 'Shops', showAlways: true },
  { href: '/keluhan', icon: AlertCircle, label: 'Keluhan', proOnly: true },
  { href: '/otp', icon: KeyRound, label: 'OTP', proOnly: true },
  { href: '/discounts', icon: Percent, label: 'Diskon', showAlways: true },
  { href: '/profile', icon: UserIcon, label: 'Profil & Langganan', showAlways: true },
  { href: '/pengaturan', icon: Settings, label: 'Pengaturan', proOnly: true },
]

export function Sidebar() {
  const pathname = usePathname()
  const { totalUnread } = useStoreChat()
  const { subscription, isLoading } = useUserData()

  const isActive = (path: string) => pathname === path
  const isProUser = !isLoading && subscription?.plan_name === 'Admin'

  // Filter menu items berdasarkan level langganan
  const filteredNavItems = navItems.filter(item => {
    // Selalu tampilkan item yang memiliki showAlways: true
    if (item.showAlways) return true
    
    // Tampilkan item khusus Pro jika user adalah Pro user
    if (item.proOnly) return isProUser
    
    // Secara default tampilkan menu jika tidak ada flag khusus
    return true
  })

  return (
    <TooltipProvider delayDuration={100}>
      <aside className="fixed top-0 left-0 z-20 h-full w-[56px] -translate-x-full border-r transition-transform md:translate-x-0">
        <div className="border-b p-2">
          <Link href="/">
            <Button variant="outline" size="icon" aria-label="Home">
              <CodeXml className="size-5" />
            </Button>
          </Link>
        </div>
        <nav className="grid gap-4 p-2 mt-8">
          {filteredNavItems.map((item) => (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link href={item.href}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`rounded-lg relative ${isActive(item.href) ? 'bg-muted' : ''}`}
                    aria-label={item.label}
                  >
                    <item.icon className="size-5" />
                    {item.href === '/webchat' && totalUnread > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-0.5 -right-0.5 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                      >
                        {totalUnread}
                      </Badge>
                    )}
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={5}>
                {item.label}
              </TooltipContent>
            </Tooltip>
          ))}
        </nav>
      </aside>
    </TooltipProvider>
  )
}
