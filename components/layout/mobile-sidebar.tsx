'use client'

import Link from "next/link"
import { Menu } from "lucide-react"
import { navItems } from "./Sidebar"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "../ui/dropdown-menu"
import { Button } from "../ui/button"
import { useUserData } from "@/contexts/UserDataContext"

interface MobileSidebarProps {
  onNavigate: () => void
}

export function MobileSidebar({ onNavigate }: MobileSidebarProps) {
  const { subscription } = useUserData();
  const isPremium = subscription?.plan_name === 'Admin';
  
  // Filter navigasi berdasarkan hak akses pengguna
  const filteredNavItems = navItems.filter(item => {
    // Tampilkan jika showAlways=true atau jika proOnly=true dan pengguna premium
    return item.showAlways || (item.proOnly && isPremium);
  });
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" className="rounded-full">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle mobile menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 ml-2">
        <DropdownMenuLabel>Menu</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {filteredNavItems.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link
              href={item.href}
              className="flex items-center gap-2"
              onClick={onNavigate}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
