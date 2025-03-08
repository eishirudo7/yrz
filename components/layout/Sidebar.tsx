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
  RotateCcw
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
import { useSession } from "next-auth/react"

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
  { href: '/pengaturan', icon: Settings, label: 'Pengaturan' },
]
export function Sidebar() {
  const pathname = usePathname()
  const { status } = useSession()

  const isActive = (path: string) => pathname === path

  if (status !== "authenticated") {
    return null
  }

  return (
    <TooltipProvider>
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
                    className={`rounded-lg ${isActive(item.href) ? 'bg-muted' : ''}`}
                    aria-label={item.label}
                  >
                    <item.icon className="size-5" />
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
