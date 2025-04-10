'use client'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useEffect, useState } from "react"
import useSWR from "swr"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { SettingsForm } from './SettingsForm'
import { TemperatureSlider } from "./TemperatureSlider"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"

import { PromptDialog } from './PromptDialog'

async function checkOpenAIKey(apiKey: string) {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    console.log('OpenAI API Response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API Error:', errorData);
    }

    return response.ok;
  } catch (error) {
    console.error('OpenAI API Check Error:', error);
    return false;
  }
}

// Fungsi fetcher untuk SWR
const fetcher = async (url: string) => {
  const response = await fetch(url, {
    cache: 'no-store'
  });
  const data = await response.json();
  
  if (!data.ok) throw new Error('Gagal mengambil data pengaturan');
  return data;
};

export default function PengaturanPage() {
  const { data, error, isLoading } = useSWR('/api/settings', fetcher, {
    revalidateOnFocus: false, // Mencegah refetch saat focus kembali ke halaman
    dedupingInterval: 60000, // Mencegah request berulang dalam waktu 1 menit
  });
  
  const [isValidApiKey, setIsValidApiKey] = useState<boolean>(false);
  
  useEffect(() => {
    // Cek API key jika tersedia
    const checkApiKey = async () => {
      if (data?.pengaturan?.openai_api) {
        const isValid = await checkOpenAIKey(data.pengaturan.openai_api);
        setIsValidApiKey(isValid);
      }
    };
    
    if (data) {
      checkApiKey();
    }
  }, [data]);
  
  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Pengaturan</h1>
        <div className="space-y-4">
          <Card className="mb-4">
            <CardHeader>
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            </CardContent>
          </Card>
          <Card className="mb-4">
            <CardHeader>
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Pengaturan</h1>
        <Card className="mb-4 border-red-500">
          <CardHeader>
            <CardTitle className="text-red-500">Error</CardTitle>
            <CardDescription>
              Gagal memuat pengaturan. Silakan coba lagi nanti.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>{error.message}</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => window.location.reload()}>Coba Lagi</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  // Data sudah tersedia
  const { pengaturan, autoShip, subscription } = data || {};
  const settings = Array.isArray(pengaturan) ? pengaturan[0] : pengaturan;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Pengaturan</h1>
      <SettingsForm>
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Pengaturan OpenAI</CardTitle>
            <CardDescription>Konfigurasi untuk API OpenAI</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="openai_api">API Key OpenAI</Label>
                <div className="flex gap-2 items-center">
                  <Input 
                    id="openai_api" 
                    name="openai_api"
                    defaultValue={settings?.openai_api || ''}
                  />
                  {settings?.openai_api && (
                    <div 
                      className={`w-3 h-3 rounded-full ${
                        isValidApiKey ? "bg-green-500" : "bg-red-500"
                      }`}
                      title={isValidApiKey ? "API Key valid" : "API Key tidak valid"}
                    />
                  )}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="openai_model">Model OpenAI</Label>
                <Select defaultValue={settings?.openai_model} name="openai_model">
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="gpt-4-32k">GPT-4 32k</SelectItem>
                    <SelectItem value="gpt-4o-mini">GPT-4O Mini</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <TemperatureSlider defaultValue={settings?.openai_temperature || 0.4} />
              </div>
              <div className="grid gap-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="openai_prompt">Prompt</Label>
                  <PromptDialog defaultValue={settings?.openai_prompt || ''} />
                </div>
                <Textarea 
                  id="openai_prompt" 
                  name="openai_prompt"
                  defaultValue={settings?.openai_prompt || ''}
                  rows={5}
                  className="resize-none"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Pengaturan Auto Chat</CardTitle>
            <CardDescription>Konfigurasi pesan otomatis untuk berbagai status order</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="in_cancel_status" 
                    name="in_cancel_status"
                    defaultChecked={settings?.in_cancel_status}
                  />
                  <Label htmlFor="in_cancel_status">Aktifkan Pesan Cancel Order</Label>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="in_cancel_msg">Pesan Cancel Order</Label>
                  <Textarea 
                    id="in_cancel_msg" 
                    name="in_cancel_msg"
                    defaultValue={settings?.in_cancel_msg || ''}
                    placeholder="Masukkan pesan untuk pembatalan pesanan"
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="in_return_status" 
                    name="in_return_status"
                    defaultChecked={settings?.in_return_status}
                  />
                  <Label htmlFor="in_return_status">Aktifkan Pesan Return Order</Label>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="in_return_msg">Pesan Return Order</Label>
                  <Textarea 
                    id="in_return_msg" 
                    name="in_return_msg"
                    defaultValue={settings?.in_return_msg || ''}
                    placeholder="Masukkan pesan untuk pengembalian pesanan"
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Pengaturan Auto Ship per Toko</CardTitle>
            <CardDescription>Konfigurasi auto ship untuk setiap toko</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="auto_ship_interval">Interval Auto Ship (detik)</Label>
                <Input
                  id="auto_ship_interval"
                  name="auto_ship_interval"
                  type="number"
                  defaultValue={settings?.auto_ship_interval || 5}
                  min={1}
                />
                <p className="text-sm text-muted-foreground">
                  Auto ship diaktifkan per toko di tabel Status Auto Ship per Toko. Interval dalam detik (1-10 detik)
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Toko</TableHead>
                    <TableHead>Status Chat</TableHead>
                    <TableHead>Status Ship</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {autoShip?.map((shop: any) => (
                    <TableRow key={shop.shop_id} data-shop-id={shop.shop_id}>
                      <TableCell data-shop-name>{shop.shop_name}</TableCell>
                      <TableCell>
                        <Switch 
                          name="status_chat"
                          defaultChecked={shop.status_chat} 
                        />
                      </TableCell>
                      <TableCell>
                        <Switch 
                          name="status_ship"
                          defaultChecked={shop.status_ship} 
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Informasi Paket Langganan</CardTitle>
            <CardDescription>Detail paket langganan saat ini</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Paket</p>
                  <p className="text-lg font-semibold">{subscription?.plan?.name || 'Basic'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Jumlah Toko</p>
                  <p className="text-lg font-semibold">{autoShip?.length || 0} / {subscription?.plan?.max_shops || 1}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <p className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    {subscription?.status || 'active'}
                  </p>
                </div>
                {subscription?.end_date && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Berlaku Hingga</p>
                    <p className="text-lg font-semibold">{new Date(subscription.end_date).toLocaleDateString('id-ID')}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <CardFooter>
          <Button type="submit">Simpan Pengaturan</Button>
        </CardFooter>
      </SettingsForm>
    </div>
  );
}
