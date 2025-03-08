'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react" // Pastikan lucide-react sudah terinstall

// Tambahkan tipe data untuk memperjelas struktur
interface AutoShipData {
  shop_id: string;
  shop_name: string;  // Tambahkan shop_name
  status_chat: boolean;
  status_ship: boolean;
}

interface Settings {
  openai_api: string | null;
  openai_model: string | null;
  openai_temperature: number | null;
  openai_prompt: string | null;
  auto_ship: boolean;
  auto_ship_interval: number;
}

export function SettingsForm({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [alert, setAlert] = useState<{
    type: 'success' | 'error',
    message: string
  } | null>(null)
  
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setAlert(null) // Reset alert

    const formData = new FormData(e.currentTarget)
    
    // Pastikan semua nilai dikonversi dengan benar
    const updatedSettings: Settings = {
      openai_api: formData.get('openai_api')?.toString() || null,
      openai_model: formData.get('openai_model')?.toString() || null,
      openai_temperature: formData.get('openai_temperature') ? 
        parseFloat(formData.get('openai_temperature') as string) : null,
      openai_prompt: formData.get('openai_prompt')?.toString() || null,
      auto_ship: formData.get('auto_ship') === 'on',
      auto_ship_interval: formData.get('auto_ship_interval') ? 
        parseInt(formData.get('auto_ship_interval') as string) : 5
    }

    // Ambil data auto ship dari form dengan cara yang lebih aman
    const autoShipElements = document.querySelectorAll<HTMLElement>('[data-shop-id]')
    const updatedAutoShip: AutoShipData[] = Array.from(autoShipElements).map((element) => {
      const shopId = element.getAttribute('data-shop-id')
      const shopName = element.querySelector('[data-shop-name]')?.textContent || ''
      const statusChat = element.querySelector<HTMLInputElement>('[name="status_chat"]')
      const statusShip = element.querySelector<HTMLInputElement>('[name="status_ship"]')

      return {
        shop_id: shopId || '',
        shop_name: shopName,
        status_chat: statusChat?.checked || false,
        status_ship: statusShip?.checked || false
      }
    })

    try {
      console.log('Sending data:', { updatedSettings, updatedAutoShip }) // Debug log

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          updatedSettings,
          updatedAutoShip
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setAlert({
          type: 'error',
          message: data.details || 'Gagal menyimpan pengaturan'
        })
        throw new Error(data.details || 'Gagal menyimpan pengaturan')
      }
      
      setAlert({
        type: 'success',
        message: 'Pengaturan berhasil disimpan'
      })

      router.refresh()
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setIsLoading(false)
      // Hilangkan alert setelah 3 detik
      setTimeout(() => setAlert(null), 3000)
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {(alert || isLoading) && (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center backdrop-blur-[2px] z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm font-medium">Sedang menyimpan...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {alert?.type === 'success' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                <span className="text-sm font-medium">
                  {alert?.message}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      {children}
    </form>
  )
}
