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
  UserIcon
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
import { useMiniChat } from "@/contexts/MiniChatContext"
import { Badge } from "@/components/ui/badge"

export const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/webchat', icon: MessageSquare, label: 'Chat' },
  { href: '/orders', icon: ShoppingBag, label: 'Orders' },
  { href: '/ubah_pesanan', icon: ShoppingCart, label: 'Perubahan Pesanan' },
  { href: '/return', icon: RotateCcw, label: 'Return' },
  { href: '/produk', icon: Package, label: 'Produk' },
  { href: '/flashsale', icon: Zap, label: 'Flash Sale' },
  { href: '/ads', icon: Megaphone, label: 'Iklan' },
  { href: '/shops', icon: Store, label: 'Shops' },
  { href: '/keluhan', icon: AlertCircle, label: 'Keluhan' },
  { href: '/otp', icon: KeyRound, label: 'OTP' },
  { href: '/discounts', icon: Percent, label: 'Diskon' },
  { href: '/profile', icon: UserIcon, label: 'Profil & Langganan' },
  { href: '/pengaturan', icon: Settings, label: 'Pengaturan' },
]
export function Sidebar() {
  const pathname = usePathname()
  const { state } = useMiniChat()

  const isActive = (path: string) => pathname === path

  // Hitung jumlah akun yang memiliki pesan belum dibaca
  const totalUnread = state.conversations.filter(conv => conv.unread_count > 0).length

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
          {navItems.map((item) => (
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
