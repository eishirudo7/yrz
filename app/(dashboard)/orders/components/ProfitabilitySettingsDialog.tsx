'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RefreshCw, Search, Save, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter
} from "@/components/ui/dialog"
import { ScrollArea } from '@/components/ui/scroll-area'
import { Calculator } from 'lucide-react'

interface ProfitabilitySettingsDialogProps {
  defaultOpen?: boolean
  onSettingsChange?: () => void
  onOpenChange?: (open: boolean) => void
  onChange?: () => void
}

export default function ProfitabilitySettingsDialog({ 
  defaultOpen = false,
  onSettingsChange,
  onOpenChange
}: ProfitabilitySettingsDialogProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [skus, setSkus] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  
  const fetchSkus = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('sku_cost_margins')
        .select('*')
        .order('item_sku', { ascending: true })
      
      if (searchTerm) {
        query = query.ilike('item_sku', `%${searchTerm}%`)
      }
      
      if (activeTab === 'with-cost') {
        query = query.not('cost_price', 'is', null)
      } else if (activeTab === 'with-margin') {
        query = query.not('margin_percentage', 'is', null)
      } else if (activeTab === 'incomplete') {
        query = query.or('cost_price.is.null,margin_percentage.is.null')
      }
      
      const { data, error } = await query.limit(100) // Batasi untuk performa
      
      if (error) throw error
      setSkus(data || [])
    } catch (error) {
      console.error('Error fetching SKUs:', error)
      toast.error('Gagal mengambil data SKU')
    } finally {
      setLoading(false)
    }
  }
  
  const syncSkus = async () => {
    setSyncing(true)
    try {
      const { data, error } = await supabase.rpc('populate_sku_cost_margins')
      
      if (error) {
        if (error.message.includes('function') || error.message.includes('does not exist')) {
          // Fungsi belum dibuat di database, buat tabel dan fungsi
          await createSkuMarginsTable()
        } else {
          throw error
        }
      }
      
      toast.success(`SKUs berhasil disinkronkan`)
      fetchSkus()
    } catch (error) {
      console.error('Error syncing SKUs:', error)
      toast.error('Gagal sinkronisasi SKU')
    } finally {
      setSyncing(false)
    }
  }
  
  // Fungsi untuk membuat tabel jika belum ada
  const createSkuMarginsTable = async () => {
    try {
      // Buat tabel sku_cost_margins
      await supabase.rpc('create_sku_margins_table')
      return true
    } catch (error) {
      console.error('Error creating table:', error)
      // Jika RPC tidak ada, solusi alternatif
      toast.error('Tabel database belum ada. Silakan hubungi administrator untuk setup database.')
      
      // Alternatif: menggunakan rpc khusus untuk membuat tabel
      try {
        const { error: rpcError } = await supabase.rpc('setup_sku_margins_schema')
        if (rpcError) throw rpcError
        return true
      } catch (setupError) {
        console.error('Error setting up schema:', setupError)
        return false
      }
    }
  }
  
  const updateSkuData = async (id: number, updates: any) => {
    try {
      const { error } = await supabase
        .from('sku_cost_margins')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
      
      if (error) throw error
      
      toast.success('Data berhasil diperbarui')
      
      // Update local state
      setSkus(prev => 
        prev.map(sku => 
          sku.id === id ? { ...sku, ...updates } : sku
        )
      )
      
      // Notify parent component
      if (onSettingsChange) {
        onSettingsChange()
      }
    } catch (error) {
      console.error('Error updating SKU data:', error)
      toast.error('Gagal memperbarui data')
    }
  }
  
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (onOpenChange) {
      onOpenChange(isOpen);
    }
    
    // Jika dialog ditutup, panggil callback untuk pembaruan
    if (!isOpen && onSettingsChange) {
      // Beri waktu sedikit setelah dialog ditutup
      setTimeout(() => {
        onSettingsChange();
      }, 300);
    }
  };
  
  // Fetch data when dialog opens
  useEffect(() => {
    if (open) {
      fetchSkus()
    }
  }, [open, activeTab])
  
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="h-6 w-6 bg-teal-100/50 dark:bg-teal-900/50 border-teal-200 dark:border-teal-800"
          title="Pengaturan Profit"
        >
          <Calculator className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-hidden flex flex-col w-[95vw] p-2 sm:p-6">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-center text-xl">Pengaturan Profitabilitas Produk</DialogTitle>
          <DialogDescription className="text-center text-sm">
            Gunakan halaman ini untuk mengatur harga modal atau margin setiap produk untuk perhitungan profit yang lebih akurat.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-start justify-between gap-2 py-1">
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-4 h-9">
              <TabsTrigger value="all" className="text-xs py-1 px-0">Semua</TabsTrigger>
              <TabsTrigger value="with-cost" className="text-xs py-1 px-0">Modal</TabsTrigger>
              <TabsTrigger value="with-margin" className="text-xs py-1 px-0">Margin</TabsTrigger>
              <TabsTrigger value="incomplete" className="text-xs py-1 px-0">Belum</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex gap-2 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchSkus()}
                className="pl-9 w-full h-9"
              />
            </div>
            <Button onClick={fetchSkus} size="icon" variant="outline" className="h-9 w-9">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-x-hidden overflow-y-auto min-h-[200px] max-h-[calc(85vh-200px)]">
          {loading ? (
            <div className="text-center py-4">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-1 text-xs text-muted-foreground">Memuat data...</p>
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-10 px-2 py-2">#</TableHead>
                    <TableHead className="px-2 py-2">SKU</TableHead>
                    <TableHead className="w-28 px-2 py-2">Modal (Rp)</TableHead>
                    <TableHead className="w-28 px-2 py-2">Margin (%)</TableHead>
                    <TableHead className="w-14 px-2 py-2 text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {skus.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 px-2 text-sm">
                        {searchTerm 
                          ? `Tidak ada SKU yang cocok dengan pencarian "${searchTerm}"`
                          : 'Tidak ada data SKU. Klik tombol "Sinkronkan SKU" untuk mulai.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    skus.map((sku, index) => (
                      <TableRow key={sku.id}>
                        <TableCell className="px-2 py-1 text-center">{index + 1}</TableCell>
                        <TableCell className="font-mono text-xs px-2 py-1 truncate max-w-[100px]">{sku.item_sku}</TableCell>
                        <TableCell className="px-2 py-1">
                          <Input
                            type="number"
                            min="0"
                            step="100"
                            value={sku.cost_price || ''}
                            onChange={(e) => {
                              // Update local state immediately for responsive UI
                              const newSkus = [...skus]
                              newSkus[index].cost_price = e.target.value === '' ? null : parseFloat(e.target.value)
                              setSkus(newSkus)
                            }}
                            onBlur={(e) => {
                              const value = e.target.value === '' ? null : parseFloat(e.target.value)
                              updateSkuData(sku.id, { cost_price: value })
                            }}
                            className="w-full h-8 text-xs px-1 text-right"
                          />
                        </TableCell>
                        <TableCell className="px-2 py-1">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={sku.margin_percentage !== null && sku.margin_percentage !== undefined 
                              ? (typeof sku.tempMargin === 'string' ? sku.tempMargin : (sku.margin_percentage * 100).toFixed(2)) 
                              : ''}
                            onChange={(e) => {
                              // Update local state tanpa memformat
                              const newSkus = [...skus];
                              newSkus[index] = {
                                ...newSkus[index],
                                tempMargin: e.target.value, // Simpan nilai input mentah
                                margin_percentage: e.target.value === '' ? null : (parseFloat(e.target.value) / 100)
                              };
                              setSkus(newSkus);
                            }}
                            onBlur={(e) => {
                              // Format nilai saat field kehilangan fokus
                              const value = e.target.value === '' ? null : (parseFloat(e.target.value) / 100);
                              
                              // Update database
                              updateSkuData(sku.id, { margin_percentage: value });
                              
                              // Update tampilan dengan nilai yang diformat
                              const newSkus = [...skus];
                              if (value !== null) {
                                newSkus[index] = {
                                  ...newSkus[index],
                                  tempMargin: undefined, // Hapus nilai temporary
                                  margin_percentage: value
                                };
                              } else {
                                newSkus[index] = {
                                  ...newSkus[index],
                                  tempMargin: undefined,
                                  margin_percentage: null
                                };
                              }
                              setSkus(newSkus);
                            }}
                            className="w-full h-8 text-xs px-1 text-right"
                          />
                        </TableCell>
                        <TableCell className="text-xs text-center text-muted-foreground px-0 py-1">
                          {sku.is_using_cost 
                            ? (sku.cost_price ? 'Modal' : 'Perlu') 
                            : (sku.margin_percentage ? `${(sku.margin_percentage * 100).toFixed(1)}%` : 'Perlu')}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        
        <DialogFooter className="flex justify-center items-center pt-2 border-t mt-2">
          <Button
            onClick={syncSkus}
            disabled={syncing}
            variant="outline"
            className="text-sm h-9"
          >
            {syncing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sinkronkan SKU
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 