'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RefreshCw, Search, Check, X, Calculator, ChevronDown, ChevronRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'

interface HppItem {
  id: number
  item_sku: string
  tier1_variation: string
  cost_price: number | null
  created_at: string
  updated_at: string
}

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
  const [hppData, setHppData] = useState<HppItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [activeTab, setActiveTab] = useState('all')

  // Checkbox & bulk
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkCostPrice, setBulkCostPrice] = useState<string>('')
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  // Track original cost_price at fetch time for stable tab filtering
  const [originalPrices, setOriginalPrices] = useState<{ [id: number]: number | null }>({})

  // Expanded SKU groups (default = all collapsed)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Kalkulator
  const [receivedAmount, setReceivedAmount] = useState<string>('')
  const [costAmount, setCostAmount] = useState<string>('')
  const [adminFee, setAdminFee] = useState<string>('12')
  const [escrowFee, setEscrowFee] = useState<string>('')
  const [calculatedMargin, setCalculatedMargin] = useState<string>('')
  const [netProfit, setNetProfit] = useState<string>('')

  const calculateMargin = () => {
    if (!receivedAmount || !costAmount) return
    const received = parseFloat(receivedAmount)
    const cost = parseFloat(costAmount)
    const escrow = parseFloat(escrowFee) || 0
    if (cost <= 0 || received <= 0) return
    setNetProfit((escrow - cost).toFixed(0))
    const margin = ((escrow - cost) / escrow) * 100
    setCalculatedMargin(margin < 0 ? '0.00' : margin.toFixed(2))
  }

  const calculateEscrow = (price: string, adminPercent: string) => {
    if (!price || !adminPercent) { setEscrowFee(''); return }
    const p = parseFloat(price), a = parseFloat(adminPercent)
    if (isNaN(p) || isNaN(a) || p <= 0 || a <= 0) { setEscrowFee(''); return }
    setEscrowFee((p - p * (a / 100)).toFixed(0))
  }

  useEffect(() => {
    const t = setTimeout(calculateMargin, 300)
    return () => clearTimeout(t)
  }, [receivedAmount, costAmount, escrowFee])

  useEffect(() => { calculateEscrow(receivedAmount, adminFee) }, [receivedAmount, adminFee])

  // === Data Fetching ===
  const fetchHppData = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await createClient().auth.getUser()
      if (!user) { toast.error('Anda harus login'); return }

      let query = createClient()
        .from('hpp_master')
        .select('*')
        .eq('user_id', user.id)
        .order('item_sku', { ascending: true })
        .order('tier1_variation', { ascending: true })

      if (searchTerm) {
        query = query.or(`item_sku.ilike.%${searchTerm}%,tier1_variation.ilike.%${searchTerm}%`)
      }

      const { data, error } = await query.limit(500)
      if (error) throw error

      setHppData(data || [])
      // Snapshot original prices for stable tab filtering
      const priceMap: { [id: number]: number | null } = {}
        ; (data || []).forEach(d => { priceMap[d.id] = d.cost_price })
      setOriginalPrices(priceMap)
      setSelectedIds(new Set())
      setDirtyIds(new Set())
    } catch (error) {
      console.error('Error fetching HPP data:', error)
      toast.error('Gagal mengambil data HPP')
    } finally {
      setLoading(false)
    }
  }

  // === Computed Data ===
  const filteredData = useMemo(() => {
    let data = hppData
    if (activeTab === 'filled') data = data.filter(h => {
      const orig = originalPrices[h.id]
      return orig !== null && orig !== undefined && orig > 0
    })
    else if (activeTab === 'empty') data = data.filter(h => {
      const orig = originalPrices[h.id]
      return orig === null || orig === undefined || orig === 0
    })
    return data
  }, [hppData, activeTab, originalPrices])

  const groupedData = useMemo(() => {
    const groups: { [sku: string]: HppItem[] } = {}
    filteredData.forEach(item => {
      const sku = item.item_sku.toUpperCase()
      if (!groups[sku]) groups[sku] = []
      groups[sku].push(item)
    })
    return groups
  }, [filteredData])

  const stats = useMemo(() => ({
    total: hppData.length,
    filled: hppData.filter(h => h.cost_price !== null && h.cost_price > 0).length,
    empty: hppData.filter(h => h.cost_price === null || h.cost_price === 0).length,
  }), [hppData])

  // === Sync ===
  const syncSkus = async () => {
    setSyncing(true)
    try {
      const { data: { user } } = await createClient().auth.getUser()
      if (!user) { toast.error('Anda harus login'); return }

      // Get user's shop IDs first
      const { data: userShops, error: shopError } = await createClient()
        .from('shopee_tokens')
        .select('shop_id')
        .eq('user_id', user.id)

      if (shopError || !userShops || userShops.length === 0) {
        toast.error('Tidak ada toko terhubung')
        setSyncing(false)
        return
      }

      const userShopIds = userShops.map(s => s.shop_id)

      // Get orders only from user's shops
      const { data: userOrders, error: ordError } = await createClient()
        .from('orders')
        .select('order_sn, shop_id')
        .in('shop_id', userShopIds)
        .limit(2000)

      if (ordError || !userOrders || userOrders.length === 0) {
        toast.info('Tidak ada pesanan ditemukan')
        setSyncing(false)
        return
      }

      const userOrderSns = userOrders.map(o => o.order_sn)
      const orderShopMap: { [k: string]: number } = {}
      userOrders.forEach(o => { orderShopMap[o.order_sn] = o.shop_id })

      // Get order_items only from user's orders
      const { data: orderItems, error: oiError } = await createClient()
        .from('order_items')
        .select('item_sku, model_sku, model_name, item_id, order_sn')
        .in('order_sn', userOrderSns.slice(0, 1000))

      if (oiError || !orderItems) { toast.error('Gagal mengambil data pesanan'); setSyncing(false); return }

      const skuMap = new Map<string, { sku: string, shop_id: number, item_id: number }>()
      orderItems.forEach(oi => {
        const sku = (oi.item_sku && oi.item_sku.trim() !== '' && oi.item_sku !== 'EMPTY') ? oi.item_sku : oi.model_sku
        if (!sku || !oi.item_id) return
        const shopId = orderShopMap[oi.order_sn]
        if (!shopId) return
        if (!skuMap.has(sku.toUpperCase())) {
          skuMap.set(sku.toUpperCase(), { sku, shop_id: shopId, item_id: oi.item_id })
        }
      })

      if (skuMap.size === 0) { toast.info('Tidak ada SKU baru'); setSyncing(false); return }

      const allSkus = Array.from(skuMap.values())
      let totalInserted = 0

      for (let i = 0; i < allSkus.length; i += 10) {
        const batch = allSkus.slice(i, i + 10)
        const res = await fetch('/api/hpp/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skus: batch })
        })
        if (res.ok) { const r = await res.json(); totalInserted += r.inserted || 0 }
      }

      toast.success(`${totalInserted} variasi disinkronkan`)
      fetchHppData()
    } catch (error) {
      console.error('Error syncing:', error)
      toast.error('Gagal sinkronisasi')
    } finally {
      setSyncing(false)
    }
  }

  // Save all dirty items to DB
  const saveAllChanges = async () => {
    if (dirtyIds.size === 0) return
    setSaving(true)
    try {
      const { data: { user } } = await createClient().auth.getUser()
      if (!user) return

      const dirtyItems = hppData.filter(h => dirtyIds.has(h.id))
      let successCount = 0

      for (const item of dirtyItems) {
        const { error } = await createClient()
          .from('hpp_master')
          .update({ cost_price: item.cost_price, updated_at: new Date().toISOString() })
          .eq('id', item.id).eq('user_id', user.id)
        if (!error) successCount++
      }

      toast.success(`${successCount} HPP berhasil disimpan`)
      setDirtyIds(new Set())
      onSettingsChange?.()
    } catch (error) {
      console.error('Error saving:', error)
      toast.error('Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const bulkUpdateCostPrice = async () => {
    if (selectedIds.size === 0 || !bulkCostPrice) return
    try {
      const { data: { user } } = await createClient().auth.getUser()
      if (!user) return
      const costPrice = parseFloat(bulkCostPrice)
      if (isNaN(costPrice) || costPrice < 0) { toast.error('Masukkan harga yang valid'); return }

      const ids = Array.from(selectedIds)
      const { error } = await createClient()
        .from('hpp_master')
        .update({ cost_price: costPrice, updated_at: new Date().toISOString() })
        .in('id', ids).eq('user_id', user.id)
      if (error) throw error

      toast.success(`${ids.length} variasi diperbarui`)
      setHppData(prev => prev.map(h => selectedIds.has(h.id) ? { ...h, cost_price: costPrice } : h))
      setSelectedIds(new Set())
      setBulkCostPrice('')
      onSettingsChange?.()
    } catch (error) {
      console.error('Error bulk updating:', error)
      toast.error('Gagal memperbarui')
    }
  }

  // === Selection ===
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.size === filteredData.length ? new Set() : new Set(filteredData.map(h => h.id)))
  }

  const selectSkuGroup = (sku: string) => {
    const items = filteredData.filter(h => h.item_sku.toUpperCase() === sku)
    const allSelected = items.every(h => selectedIds.has(h.id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      items.forEach(h => { allSelected ? next.delete(h.id) : next.add(h.id) })
      return next
    })
  }

  const toggleCollapse = (sku: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(sku) ? next.delete(sku) : next.add(sku)
      return next
    })
  }

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    onOpenChange?.(isOpen)
    if (!isOpen && onSettingsChange) setTimeout(() => onSettingsChange(), 300)
  }

  useEffect(() => { if (open) fetchHppData() }, [open, searchTerm])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon"
          className="h-6 w-6 bg-teal-100/50 dark:bg-teal-900/50 border-teal-200 dark:border-teal-800"
          title="Pengaturan HPP">
          <Calculator className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[850px] max-h-[90vh] overflow-hidden flex flex-col w-[95vw] p-0">
        {/* Header */}
        <div className="px-4 sm:px-6 pt-5 pb-3 border-b bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">HPP Master</DialogTitle>
            <DialogDescription className="text-xs">
              Kelola harga pokok penjualan per variasi produk
            </DialogDescription>
          </DialogHeader>

          {/* Stats Bar */}
          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="text-xs text-muted-foreground">{stats.total} total</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-muted-foreground">{stats.filled} terisi</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs text-muted-foreground">{stats.empty} kosong</span>
            </div>
          </div>

          {/* Tabs + Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
              <TabsList className="h-8 p-0.5">
                <TabsTrigger value="all" className="text-xs h-7 px-3">Semua</TabsTrigger>
                <TabsTrigger value="filled" className="text-xs h-7 px-3">Terisi</TabsTrigger>
                <TabsTrigger value="empty" className="text-xs h-7 px-3">Kosong</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Cari SKU atau variasi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Kalkulator - Collapsible */}
        <div className="px-4 sm:px-6 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Calculator className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-[10px] font-medium text-muted-foreground shrink-0">Kalkulator:</span>
            <Input type="number" placeholder="Harga Jual" value={receivedAmount}
              onChange={(e) => setReceivedAmount(e.target.value)} className="h-6 text-[11px] w-20 sm:w-24" min="0" />
            <Input type="number" placeholder="Modal" value={costAmount}
              onChange={(e) => setCostAmount(e.target.value)} className="h-6 text-[11px] w-20 sm:w-24" min="0" />
            <Input type="number" placeholder="Admin%" value={adminFee}
              onChange={(e) => { const v = e.target.value; if (!v || (parseFloat(v) >= 0 && parseFloat(v) <= 100)) setAdminFee(v) }}
              className="h-6 text-[11px] w-14" min="0" max="100" />
            <span className="text-[10px] text-muted-foreground">→</span>
            <Badge variant="outline" className="text-[10px] font-mono h-5">
              {escrowFee ? `Escrow: Rp ${parseInt(escrowFee).toLocaleString('id-ID')}` : 'Escrow: -'}
            </Badge>
            <Badge variant={calculatedMargin && parseFloat(calculatedMargin) > 0 ? "default" : "secondary"} className="text-[10px] font-mono h-5">
              {calculatedMargin ? `${calculatedMargin}%` : 'Margin: -'}
            </Badge>
            <Badge variant={netProfit && parseInt(netProfit) > 0 ? "default" : "destructive"} className="text-[10px] font-mono h-5">
              {netProfit ? `Rp ${parseInt(netProfit).toLocaleString('id-ID')}` : 'Laba: -'}
            </Badge>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="px-4 sm:px-6 py-2 bg-blue-50 dark:bg-blue-950/50 border-b border-blue-200 dark:border-blue-800 flex items-center gap-2 animate-in slide-in-from-top-1">
            <Badge variant="secondary" className="text-xs font-medium shrink-0">
              {selectedIds.size} dipilih
            </Badge>
            <div className="flex items-center gap-1.5 flex-1">
              <span className="text-xs text-muted-foreground shrink-0">HPP:</span>
              <Input
                type="number" placeholder="Masukkan harga modal..."
                value={bulkCostPrice} onChange={(e) => setBulkCostPrice(e.target.value)}
                className="h-7 text-xs w-36" min="0"
                onKeyDown={(e) => e.key === 'Enter' && bulkUpdateCostPrice()}
              />
              <Button size="sm" className="h-7 text-xs gap-1" onClick={bulkUpdateCostPrice} disabled={!bulkCostPrice}>
                <Check className="h-3 w-3" /> Terapkan
              </Button>
            </div>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
              onClick={() => { setSelectedIds(new Set()); setBulkCostPrice('') }}>
              <X className="h-3 w-3" /> Batal
            </Button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-[250px] max-h-[calc(90vh-320px)]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="mt-2 text-xs text-muted-foreground">Memuat data...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm font-medium">
                {searchTerm ? `Tidak ada hasil untuk "${searchTerm}"` : 'Belum ada data HPP'}
              </p>
              <p className="text-xs mt-1">
                {searchTerm ? 'Coba kata kunci lain' : 'Klik "Sinkronkan SKU" untuk memulai'}
              </p>
            </div>
          ) : (
            <div className="p-2 sm:p-3 space-y-2">
              {Object.entries(groupedData).map(([skuGroup, items]) => {
                const isCollapsed = !expandedGroups.has(skuGroup)
                const allGroupSelected = items.every(h => selectedIds.has(h.id))
                const someGroupSelected = items.some(h => selectedIds.has(h.id))
                const filledCount = items.filter(h => h.cost_price !== null && h.cost_price > 0).length
                const isComplete = filledCount === items.length
                const progressPct = Math.round((filledCount / items.length) * 100)

                return (
                  <div key={skuGroup} className="rounded-lg border bg-card overflow-hidden shadow-sm">
                    {/* SKU Card Header */}
                    <div
                      className="flex items-center gap-3 px-3 sm:px-4 py-2.5 cursor-pointer select-none transition-colors bg-slate-50/80 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                    >
                      <Checkbox
                        checked={allGroupSelected}
                        onCheckedChange={() => selectSkuGroup(skuGroup)}
                        className="shrink-0"
                        {...(someGroupSelected && !allGroupSelected ? { 'data-state': 'indeterminate' as any } : {})}
                      />

                      <button
                        onClick={() => toggleCollapse(skuGroup)}
                        className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                      >
                        {isCollapsed
                          ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        }
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-sm truncate">{items[0].item_sku}</span>
                          <span className="text-[10px] text-muted-foreground">{items.length} variasi</span>
                        </div>
                      </button>

                      {/* Right side: Status Badge + Progress */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        <Badge
                          variant={isComplete ? "default" : "outline"}
                          className={`text-[10px] px-2 py-0 h-5 ${isComplete
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800 hover:bg-emerald-100'
                            : filledCount > 0
                              ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
                              : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                            }`}
                        >
                          {isComplete ? '✓ Lengkap' : `${filledCount}/${items.length}`}
                        </Badge>

                        {/* Mini progress ring */}
                        <div className="relative w-7 h-7 shrink-0">
                          <svg className="w-7 h-7 -rotate-90" viewBox="0 0 28 28">
                            <circle cx="14" cy="14" r="11" fill="none" strokeWidth="2.5"
                              className="stroke-slate-200 dark:stroke-slate-700" />
                            <circle cx="14" cy="14" r="11" fill="none" strokeWidth="2.5"
                              strokeLinecap="round"
                              className={isComplete ? 'stroke-emerald-500' : filledCount > 0 ? 'stroke-amber-500' : 'stroke-slate-300 dark:stroke-slate-600'}
                              strokeDasharray={`${progressPct * 0.691} 69.1`} />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-muted-foreground">
                            {progressPct}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Variation Rows */}
                    {!isCollapsed && (
                      <div className="divide-y divide-border/50">
                        {items.map((hpp, idx) => (
                          <div
                            key={hpp.id}
                            className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 transition-colors ${selectedIds.has(hpp.id)
                              ? 'bg-blue-50/70 dark:bg-blue-950/20'
                              : idx % 2 === 0
                                ? 'bg-white dark:bg-background'
                                : 'bg-muted/20'
                              } hover:bg-muted/40`}
                          >
                            <Checkbox
                              checked={selectedIds.has(hpp.id)}
                              onCheckedChange={() => toggleSelect(hpp.id)}
                              className="shrink-0 ml-1"
                            />

                            {/* Variation name */}
                            <div className="flex-1 min-w-0 flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${hpp.cost_price !== null && hpp.cost_price > 0 ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                                }`} />
                              <span className={`text-xs truncate ${hpp.cost_price !== null && hpp.cost_price > 0
                                ? 'text-foreground'
                                : 'text-muted-foreground'
                                }`}>
                                {hpp.tier1_variation}
                              </span>
                            </div>

                            {/* Cost Input */}
                            <div className="w-28 sm:w-36 shrink-0">
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">Rp</span>
                                <Input
                                  type="number"
                                  min="0"
                                  step="1000"
                                  value={hpp.cost_price ?? ''}
                                  onChange={(e) => {
                                    const newData = [...hppData]
                                    const i = newData.findIndex(h => h.id === hpp.id)
                                    if (i !== -1) {
                                      newData[i] = { ...newData[i], cost_price: e.target.value === '' ? null : parseFloat(e.target.value) }
                                      setHppData(newData)
                                      setDirtyIds(prev => new Set(prev).add(hpp.id))
                                    }
                                  }}
                                  className={`h-7 text-xs pl-7 pr-2 text-right font-mono border ${dirtyIds.has(hpp.id)
                                    ? 'border-blue-400 dark:border-blue-600 ring-1 ring-blue-200 dark:ring-blue-800'
                                    : ''
                                    }`}
                                  placeholder="0"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-4 sm:px-6 py-3 border-t bg-muted/20 flex-row justify-between items-center">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedIds.size > 0 && selectedIds.size === filteredData.length}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-xs text-muted-foreground">Pilih semua</span>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={syncSkus} disabled={syncing} variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Memproses...' : 'Sinkronkan SKU'}
            </Button>
            {dirtyIds.size > 0 && (
              <Button onClick={saveAllChanges} disabled={saving} size="sm" className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Simpan ({dirtyIds.size})
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}