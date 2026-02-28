'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useUserData } from '@/contexts/UserDataContext'
import {
    BarChart3,
    Wallet,
    RefreshCw,
    Loader2,
    TrendingUp,
    Target,
    MousePointerClick,
    DollarSign,
    Eye,
    ShoppingBag,
    Store,
    AlertCircle,
    Plus,
    Settings,
    Zap,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    Play,
    Pause,
    Square,
    Check,
    X,
    Pencil,
    Calendar
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from '@/components/ui/alert'

// Types
interface ShopBalance {
    shop_id: number
    shop_name: string
    region: string
    balance: number
    auto_top_up: boolean
    campaign_surge: boolean
    facil_rate: number | null
    error: string | null
}

interface Campaign {
    campaign_id: number
    common_info?: {
        ad_type: string
        ad_name: string
        campaign_status: string
        bidding_method: string
        campaign_placement: string
        campaign_budget: number
        campaign_duration: {
            start_time: number
            end_time: number
        }
        item_id_list: number[]
    }
    auto_bidding_info?: {
        roas_target: number
    }
    manual_bidding_info?: {
        enhanced_cpc: boolean
        selected_keywords: Array<{
            keyword: string
            status: string
            match_type: string
            bid_price_per_click: number
        }>
    }
    auto_product_ads_info?: Array<{
        product_name: string
        status: string
        item_id: number
    }>
}

interface CampaignPerformanceAgg {
    campaign_id: number
    impression: number
    clicks: number
    ctr: number
    expense: number
    cpc: number
    broad_gmv: number
    broad_roas: number
    broad_order: number
}

interface PerformanceData {
    date?: string
    hour?: number
    impression: number
    clicks: number
    ctr: number
    expense: number
    direct_gmv: number
    broad_gmv: number
    direct_roas: number
    broad_roas: number
    direct_order: number
    broad_order: number
}

interface ShopPerformance {
    shop_id: number
    shop_name: string
    impression: number
    clicks: number
    ctr: number
    expense: number
    broad_gmv: number
    broad_roas: number
    broad_order: number
    error?: string
}

interface AggregatedPerformance {
    impression: number
    clicks: number
    ctr: number
    expense: number
    gmv: number
    roas: number
    orders: number
}

interface RecommendedItem {
    item_id: number
    item_status_list: string[]
    sku_tag_list: string[]
    ongoing_ad_type_list: string[]
}

interface Shop {
    id: string
    shop_id: number
    shop_name: string
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    ongoing: { label: 'Ongoing', variant: 'default' },
    scheduled: { label: 'Scheduled', variant: 'secondary' },
    ended: { label: 'Ended', variant: 'outline' },
    paused: { label: 'Paused', variant: 'secondary' },
    deleted: { label: 'Deleted', variant: 'destructive' },
    closed: { label: 'Closed', variant: 'destructive' },
}

export default function AdsPage() {
    const { subscription, isLoading: isLoadingUser } = useUserData()
    const isAdmin = !isLoadingUser && subscription?.plan_name === 'Admin'

    const [shops, setShops] = useState<Shop[]>([])
    const [selectedShopId, setSelectedShopId] = useState<string>('')
    const [balanceData, setBalanceData] = useState<ShopBalance[]>([])
    const [totalBalance, setTotalBalance] = useState<number>(0)
    const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([]) // All campaigns from API
    const [performance, setPerformance] = useState<PerformanceData[]>([])
    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
    const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
    const [editBudget, setEditBudget] = useState<string>('')
    const [isEditing, setIsEditing] = useState(false)

    // Popover edit state
    const [popoverEditValue, setPopoverEditValue] = useState<string>('')
    const [openPopover, setOpenPopover] = useState<string | null>(null) // e.g. 'budget-123' or 'roas-456'
    const [actionLoading, setActionLoading] = useState<{ id: number; action: string } | null>(null)

    // Bulk edit state
    const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<number>>(new Set())
    const [bulkBudgetValue, setBulkBudgetValue] = useState<string>('')
    const [isBulkEditing, setIsBulkEditing] = useState(false)

    const [isLoadingBalance, setIsLoadingBalance] = useState(true)
    const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false)
    const [isLoadingPerformance, setIsLoadingPerformance] = useState(false)
    const [isLoadingDashboard, setIsLoadingDashboard] = useState(true)
    const [campaignPerformanceMap, setCampaignPerformanceMap] = useState<Record<number, CampaignPerformanceAgg>>({})
    const [isLoadingCampaignPerf, setIsLoadingCampaignPerf] = useState(false)

    // Product data map for campaign thumbnails
    const [productMap, setProductMap] = useState<Record<number, { image_url: string | null; item_sku: string | null; item_name: string | null; current_price: number | null }>>({})

    // All-shops aggregated performance
    const [shopPerformances, setShopPerformances] = useState<ShopPerformance[]>([])
    const [aggregatedPerformance, setAggregatedPerformance] = useState<AggregatedPerformance>({
        impression: 0, clicks: 0, ctr: 0, expense: 0, gmv: 0, roas: 0, orders: 0
    })
    const [performanceDate, setPerformanceDate] = useState('')

    // Filters
    const [statusFilter, setStatusFilter] = useState('ongoing')
    // Date range for performance (ISO format YYYY-MM-DD)
    const todayISO = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local timezone
    const [perfStartDate, setPerfStartDate] = useState(todayISO)
    const [perfEndDate, setPerfEndDate] = useState(todayISO)
    const perfStartDateRef = useRef(perfStartDate)
    const perfEndDateRef = useRef(perfEndDate)
    perfStartDateRef.current = perfStartDate
    perfEndDateRef.current = perfEndDate
    const [campaignPage, setCampaignPage] = useState(0)

    // Error state
    const [error, setError] = useState<string | null>(null)

    // Per-shop retry loading
    const [retryingShopId, setRetryingShopId] = useState<number | null>(null)

    // Fetch shops list (only on initial load)
    const fetchShops = useCallback(async () => {
        try {
            const response = await fetch('/api/shops')
            if (response.ok) {
                const data = await response.json()
                const shopList = data.data || data.shops || []
                setShops(shopList)
                // Set first shop as selected only if none selected
                if (shopList?.length > 0) {
                    setSelectedShopId(prev => prev || shopList[0].shop_id.toString())
                }
            }
        } catch (err) {
            console.error('Failed to fetch shops:', err)
        }
    }, []) // No dependencies - only run on initial load

    // Fetch balance data
    const fetchBalance = useCallback(async () => {
        setIsLoadingBalance(true)
        setError(null)
        try {
            const response = await fetch('/api/ads/balance')
            if (response.ok) {
                const data = await response.json()
                setBalanceData(data.shops || [])
                setTotalBalance(data.totalBalance || 0)
            } else {
                const errData = await response.json()
                setError(errData.error || 'Failed to fetch balance')
            }
        } catch (err) {
            setError('Failed to fetch balance data')
            console.error(err)
        } finally {
            setIsLoadingBalance(false)
        }
    }, [])

    // Fetch dashboard data (all shops aggregated performance for today)
    const fetchDashboard = useCallback(async () => {
        setIsLoadingDashboard(true)
        try {
            const params = new URLSearchParams({
                start_date: isoToShopee(perfStartDateRef.current),
                end_date: isoToShopee(perfEndDateRef.current)
            })
            const response = await fetch(`/api/ads/performance/all-shops?${params}`)
            if (response.ok) {
                const data = await response.json()
                setShopPerformances(data.shops || [])
                setAggregatedPerformance(data.aggregated || {
                    impression: 0, clicks: 0, ctr: 0, expense: 0, gmv: 0, roas: 0, orders: 0
                })
                setPerformanceDate(data.date || '')
            }
        } catch (err) {
            console.error('Failed to fetch dashboard data:', err)
        } finally {
            setIsLoadingDashboard(false)
        }
    }, [])

    // Retry performance for a single failed shop (no full page reload)
    const retryShopPerformance = useCallback(async (shopId: number, shopName: string) => {
        setRetryingShopId(shopId)
        try {
            const isoToShopee = (iso: string) => {
                const [y, m, d] = iso.split('-')
                return `${d}-${m}-${y}`
            }
            const startDate = isoToShopee(perfStartDateRef.current)
            const endDate = isoToShopee(perfEndDateRef.current)
            const params = new URLSearchParams({
                shop_id: shopId.toString(),
                level: 'shop',
                granularity: 'daily',
                start_date: startDate,
                end_date: endDate
            })
            const response = await fetch(`/api/ads/performance?${params}`)
            if (response.ok) {
                const data = await response.json()
                const perfData = data.performance || []
                // Aggregate daily data
                const agg = perfData.reduce((acc: any, d: any) => ({
                    impression: acc.impression + (d.impression || 0),
                    clicks: acc.clicks + (d.clicks || 0),
                    expense: acc.expense + (d.expense || 0),
                    broad_gmv: acc.broad_gmv + (d.broad_gmv || 0),
                    broad_order: acc.broad_order + (d.broad_order || 0),
                }), { impression: 0, clicks: 0, expense: 0, broad_gmv: 0, broad_order: 0 })

                const updatedShop = {
                    shop_id: shopId,
                    shop_name: shopName,
                    impression: agg.impression,
                    clicks: agg.clicks,
                    ctr: agg.impression > 0 ? agg.clicks / agg.impression : 0,
                    expense: agg.expense,
                    direct_gmv: 0,
                    broad_gmv: agg.broad_gmv,
                    direct_roas: 0,
                    broad_roas: agg.expense > 0 ? agg.broad_gmv / agg.expense : 0,
                    direct_order: 0,
                    broad_order: agg.broad_order,
                    // No error = success
                }

                // Update only this shop in shopPerformances
                setShopPerformances(prev => {
                    const updated = prev.map(s => s.shop_id === shopId ? updatedShop : s)
                    // Recalculate aggregated
                    const totals = updated.reduce((acc, s) => ({
                        impression: acc.impression + s.impression,
                        clicks: acc.clicks + s.clicks,
                        expense: acc.expense + s.expense,
                        gmv: acc.gmv + s.broad_gmv,
                        orders: acc.orders + s.broad_order
                    }), { impression: 0, clicks: 0, expense: 0, gmv: 0, orders: 0 })
                    setAggregatedPerformance({
                        ...totals,
                        ctr: totals.impression > 0 ? totals.clicks / totals.impression : 0,
                        roas: totals.expense > 0 ? totals.gmv / totals.expense : 0
                    })
                    return updated
                })
            } else {
                const errData = await response.json()
                toast.error(errData.error || `Gagal retry untuk ${shopName}`)
            }
        } catch (err) {
            console.error(`Failed to retry performance for shop ${shopId}:`, err)
            toast.error(`Gagal retry untuk ${shopName}`)
        } finally {
            setRetryingShopId(null)
        }
    }, [])

    // Fetch product images for campaign items
    const fetchProductImages = useCallback(async (campaignList: Campaign[]) => {
        const allItemIds = campaignList.flatMap(c => c.common_info?.item_id_list || [])
        const uniqueIds = [...new Set(allItemIds)]
        if (uniqueIds.length === 0) return
        try {
            const res = await fetch('/api/products/by-item-ids', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item_ids: uniqueIds })
            })
            if (res.ok) {
                const data = await res.json()
                setProductMap(prev => ({ ...prev, ...data.products }))
            }
        } catch (err) {
            console.error('Failed to fetch product images:', err)
        }
    }, [])

    // Fetch ALL campaigns for selected shop (no pagination from API)
    const fetchCampaigns = useCallback(async () => {
        if (!selectedShopId) return
        setIsLoadingCampaigns(true)
        try {
            const params = new URLSearchParams({
                shop_id: selectedShopId,
                ad_type: 'all',
                offset: '0',
                limit: '500' // Fetch all campaigns at once
            })
            const response = await fetch(`/api/ads/campaigns?${params}`)
            if (response.ok) {
                const data = await response.json()
                const campaignList = data.campaigns || []
                // Store all campaigns, sorting/filtering/pagination done via useMemo
                setAllCampaigns(campaignList)
                // Also fetch performance for these campaigns
                fetchCampaignPerformance(campaignList)
                // Fetch product thumbnails
                fetchProductImages(campaignList)
            }
        } catch (err) {
            console.error('Failed to fetch campaigns:', err)
        } finally {
            setIsLoadingCampaigns(false)
        }
    }, [selectedShopId]) // Only depend on shop change

    // Filtered and sorted campaigns (newest first, then paginated)
    const campaigns = useMemo(() => {
        // Filter by status
        let filtered = statusFilter === 'all'
            ? allCampaigns
            : allCampaigns.filter(c => c.common_info?.campaign_status === statusFilter)

        // Sort by start_time descending (newest first)
        filtered = [...filtered].sort((a, b) => {
            const aTime = a.common_info?.campaign_duration?.start_time || 0
            const bTime = b.common_info?.campaign_duration?.start_time || 0
            return bTime - aTime // Descending
        })

        return filtered
    }, [allCampaigns, statusFilter])

    // Paginated campaigns for display (50 per page)
    const paginatedCampaigns = useMemo(() => {
        const start = campaignPage * 50
        return campaigns.slice(start, start + 50)
    }, [campaigns, campaignPage])

    // Calculate if there are more pages
    const totalPages = Math.ceil(campaigns.length / 50)
    const hasMorePages = campaignPage < totalPages - 1

    // Convert ISO date (YYYY-MM-DD) to Shopee API format (DD-MM-YYYY)
    const isoToShopee = (iso: string) => {
        const [y, m, d] = iso.split('-')
        return `${d}-${m}-${y}`
    }

    // Fetch campaign-level performance (ongoing only, batched in chunks of 100)
    const fetchCampaignPerformance = useCallback(async (campaignList: Campaign[]) => {
        if (!selectedShopId || campaignList.length === 0) return

        // Only fetch performance for ongoing campaigns
        const ongoingCampaigns = campaignList.filter(c => c.common_info?.campaign_status === 'ongoing')
        if (ongoingCampaigns.length === 0) return

        setIsLoadingCampaignPerf(true)
        try {
            const BATCH_SIZE = 100
            const map: Record<number, CampaignPerformanceAgg> = {}

            // Batch campaign IDs in chunks of 100 (Shopee API limit)
            for (let i = 0; i < ongoingCampaigns.length; i += BATCH_SIZE) {
                const batch = ongoingCampaigns.slice(i, i + BATCH_SIZE)
                const campaignIds = batch.map(c => c.campaign_id).join(',')

                const params = new URLSearchParams({
                    shop_id: selectedShopId,
                    level: 'campaign',
                    granularity: 'daily',
                    start_date: isoToShopee(perfStartDateRef.current),
                    end_date: isoToShopee(perfEndDateRef.current),
                    campaign_ids: campaignIds
                })
                const response = await fetch(`/api/ads/performance?${params}`)
                if (response.ok) {
                    const data = await response.json()
                    const rawPerf = data.performance
                    const campaignListData = rawPerf?.campaign_list || []
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    campaignListData.forEach((camp: any) => {
                        const cid = camp.campaign_id
                        if (!cid) return
                        map[cid] = { campaign_id: cid, impression: 0, clicks: 0, ctr: 0, expense: 0, cpc: 0, broad_gmv: 0, broad_roas: 0, broad_order: 0 }
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const metrics = camp.metrics_list || []
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        metrics.forEach((m: any) => {
                            map[cid].impression += m.impression || 0
                            map[cid].clicks += m.clicks || 0
                            map[cid].expense += m.expense || 0
                            map[cid].broad_gmv += m.broad_gmv || 0
                            map[cid].broad_order += m.broad_order || 0
                        })
                        const agg = map[cid]
                        agg.ctr = agg.impression > 0 ? agg.clicks / agg.impression : 0
                        agg.cpc = agg.clicks > 0 ? agg.expense / agg.clicks : 0
                        agg.broad_roas = agg.expense > 0 ? agg.broad_gmv / agg.expense : 0
                    })
                }
            }

            setCampaignPerformanceMap(map)
        } catch (err) {
            console.error('Failed to fetch campaign performance:', err)
        } finally {
            setIsLoadingCampaignPerf(false)
        }
    }, [selectedShopId])

    // Fetch performance
    const fetchPerformance = useCallback(async () => {
        if (!selectedShopId) return
        setIsLoadingPerformance(true)
        try {
            const params = new URLSearchParams({
                shop_id: selectedShopId,
                level: 'shop',
                granularity: 'daily',
                start_date: isoToShopee(perfStartDateRef.current),
                end_date: isoToShopee(perfEndDateRef.current)
            })
            const response = await fetch(`/api/ads/performance?${params}`)
            if (response.ok) {
                const data = await response.json()
                setPerformance(data.performance || [])
            }
        } catch (err) {
            console.error('Failed to fetch performance:', err)
        } finally {
            setIsLoadingPerformance(false)
        }
    }, [selectedShopId])

    // Edit campaign handler
    const handleEditCampaign = async (action: string) => {
        if (!editingCampaign || !selectedShopId) return
        // Min budget check for budget actions
        if (action === 'change_budget' && editBudget) {
            const budgetVal = parseFloat(editBudget)
            if (budgetVal < 25000) {
                setEditBudget('25000')
                toast.warning('Minimum budget is 25,000')
                return
            }
        }
        setIsEditing(true)
        try {
            const response = await fetch('/api/ads/campaigns', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shop_id: parseInt(selectedShopId),
                    campaign_id: editingCampaign.campaign_id,
                    campaign_type: editingCampaign.common_info?.ad_type || 'auto',
                    edit_action: action,
                    budget: editBudget ? parseFloat(editBudget) : undefined
                })
            })
            if (response.ok) {
                setEditingCampaign(null)
                fetchCampaigns()
            } else {
                const errData = await response.json()
                setError(errData.error || 'Failed to edit campaign')
            }
        } catch (err) {
            setError('Failed to edit campaign')
            console.error(err)
        } finally {
            setIsEditing(false)
        }
    }

    // Quick action for inline table edits
    const quickCampaignAction = async (campaign: Campaign, action: string, value?: number) => {
        if (!selectedShopId) return
        // Min budget check
        if (action === 'change_budget' && value !== undefined && value < 25000) {
            setPopoverEditValue('25000')
            toast.warning('Minimum budget is 25,000')
            return
        }
        setActionLoading({ id: campaign.campaign_id, action })
        try {
            const body: Record<string, unknown> = {
                shop_id: parseInt(selectedShopId),
                campaign_id: campaign.campaign_id,
                campaign_type: campaign.common_info?.ad_type || 'auto',
                edit_action: action
            }
            if (action === 'change_budget' && value !== undefined) {
                body.budget = value
            }
            if (action === 'change_roas_target' && value !== undefined) {
                body.roas_target = value
            }

            const response = await fetch('/api/ads/campaigns', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })
            if (response.ok) {
                // Update local state instead of refetching
                setAllCampaigns(prev => prev.map(c => {
                    if (c.campaign_id !== campaign.campaign_id) return c
                    const updated: Campaign = JSON.parse(JSON.stringify(c))
                    if (!updated.common_info) return updated
                    if (action === 'change_budget' && value !== undefined) {
                        updated.common_info.campaign_budget = value
                    }
                    if (action === 'change_roas_target' && value !== undefined && updated.auto_bidding_info) {
                        updated.auto_bidding_info.roas_target = value
                    }
                    if (action === 'pause') updated.common_info.campaign_status = 'paused'
                    if (action === 'resume') updated.common_info.campaign_status = 'ongoing'
                    if (action === 'stop') updated.common_info.campaign_status = 'ended'
                    return updated
                }))
                const actionLabels: Record<string, string> = {
                    pause: 'Campaign paused',
                    resume: 'Campaign resumed',
                    stop: 'Campaign stopped',
                    change_budget: `Budget updated to ${formatCurrency(value!)}`,
                    change_roas_target: `ROAS target updated to ${value}x`,
                }
                toast.success(actionLabels[action] || 'Campaign updated')
                setOpenPopover(null) // Close any open popover
            } else {
                const errData = await response.json()
                toast.error(errData.error || 'Failed to update campaign')
            }
        } catch (err) {
            toast.error('Failed to update campaign')
            console.error(err)
        } finally {
            setActionLoading(null)
        }
    }

    // Bulk budget edit
    const bulkEditBudget = async () => {
        if (!selectedShopId || selectedCampaignIds.size === 0) return
        const budget = parseFloat(bulkBudgetValue)
        if (isNaN(budget) || budget <= 0) {
            toast.error('Please enter a valid budget amount')
            return
        }
        if (budget < 25000) {
            setBulkBudgetValue('25000')
            toast.warning('Minimum budget is 25,000')
            return
        }
        setIsBulkEditing(true)
        let success = 0
        let failed = 0
        for (const campaignId of selectedCampaignIds) {
            const campaign = allCampaigns.find(c => c.campaign_id === campaignId)
            if (!campaign) { failed++; continue }
            try {
                const body = {
                    shop_id: parseInt(selectedShopId),
                    campaign_id: campaign.campaign_id,
                    campaign_type: campaign.common_info?.ad_type || 'auto',
                    edit_action: 'change_budget',
                    budget
                }
                const response = await fetch('/api/ads/campaigns', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                })
                if (response.ok) {
                    success++
                } else {
                    failed++
                }
            } catch {
                failed++
            }
        }
        // Update local state for all successful ones
        if (success > 0) {
            setAllCampaigns(prev => prev.map(c => {
                if (!selectedCampaignIds.has(c.campaign_id)) return c
                const updated: Campaign = JSON.parse(JSON.stringify(c))
                if (updated.common_info) updated.common_info.campaign_budget = budget
                return updated
            }))
        }
        setIsBulkEditing(false)
        setSelectedCampaignIds(new Set())
        setBulkBudgetValue('')
        if (failed === 0) {
            toast.success(`Budget updated for ${success} campaign${success > 1 ? 's' : ''}`)
        } else {
            toast.warning(`${success} updated, ${failed} failed`)
        }
    }

    // Toggle campaign selection
    const toggleCampaignSelection = (id: number) => {
        setSelectedCampaignIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleSelectAll = () => {
        if (selectedCampaignIds.size === paginatedCampaigns.length) {
            setSelectedCampaignIds(new Set())
        } else {
            setSelectedCampaignIds(new Set(paginatedCampaigns.map(c => c.campaign_id)))
        }
    }

    // Initial fetch
    useEffect(() => {
        fetchShops()
        fetchBalance()
        fetchDashboard()
    }, [fetchShops, fetchBalance, fetchDashboard])

    // Fetch campaigns when shop changes (campaigns tab only)
    useEffect(() => {
        if (selectedShopId) {
            fetchCampaigns()
        }
    }, [selectedShopId, fetchCampaigns])



    // Calculate stats from performance data
    const stats = {
        totalImpressions: performance.reduce((sum, p) => sum + p.impression, 0),
        totalClicks: performance.reduce((sum, p) => sum + p.clicks, 0),
        totalExpense: performance.reduce((sum, p) => sum + p.expense, 0),
        totalGmv: performance.reduce((sum, p) => sum + p.broad_gmv, 0),
        avgRoas: performance.length > 0
            ? performance.reduce((sum, p) => sum + (p.broad_roas || 0), 0) / performance.length
            : 0,
        avgCtr: performance.length > 0
            ? performance.reduce((sum, p) => sum + (p.ctr || 0), 0) / performance.length
            : 0
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(amount)
    }

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('id-ID').format(Math.round(num))
    }

    // Loading state for user data
    if (isLoadingUser) {
        return (
            <div className="w-full p-4 sm:p-6 flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    // Admin-only access check
    if (!isAdmin) {
        return (
            <div className="w-full p-4 sm:p-6 flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-3">
                    <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <AlertCircle className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h2 className="text-lg font-semibold">Akses Terbatas</h2>
                    <p className="text-sm text-muted-foreground max-w-sm">
                        Halaman Ads hanya dapat diakses oleh pengguna dengan paket Admin.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full p-4 sm:p-6">
            <Tabs defaultValue="dashboard" className="space-y-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3 rounded-lg border bg-card/60 backdrop-blur-sm px-3 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                        <TabsList className="h-7">
                            <TabsTrigger value="dashboard" className="text-xs px-3 h-7">Dashboard</TabsTrigger>
                            <TabsTrigger value="campaigns" className="text-xs px-3 h-7">Campaigns</TabsTrigger>
                        </TabsList>
                        <div className="flex items-center gap-1.5 md:hidden">
                            <Select value={selectedShopId} onValueChange={(v) => { setSelectedShopId(v); setSelectedCampaignIds(new Set()); setBulkBudgetValue('') }}>
                                <SelectTrigger className="w-[120px] !h-7 py-1 text-xs">
                                    <Store className="mr-1 h-3 w-3 shrink-0 text-muted-foreground" />
                                    <span className="truncate"><SelectValue placeholder="Select shop" /></span>
                                </SelectTrigger>
                                <SelectContent>
                                    {shops.map(shop => (
                                        <SelectItem key={shop.shop_id} value={shop.shop_id.toString()}>
                                            {shop.shop_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { fetchBalance(); fetchCampaigns(); fetchPerformance(); fetchDashboard() }}
                                disabled={isLoadingBalance}
                                className="h-7 w-7"
                            >
                                {isLoadingBalance ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-3.5 w-3.5" />
                                )}
                            </Button>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                        {/* Date Range — inline compact */}
                        <div className="flex items-center gap-1 rounded-md border bg-background/80 px-2 h-7 shrink-0">
                            <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                            <input
                                type="date"
                                value={perfStartDate}
                                onChange={(e) => setPerfStartDate(e.target.value)}
                                className="bg-transparent text-xs border-none outline-none w-[100px] cursor-pointer"
                            />
                            <span className="text-muted-foreground text-[10px]">→</span>
                            <input
                                type="date"
                                value={perfEndDate}
                                onChange={(e) => setPerfEndDate(e.target.value)}
                                className="bg-transparent text-xs border-none outline-none w-[100px] cursor-pointer"
                            />
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                            {[{ label: 'Today', days: 0 }, { label: 'Yday', days: 1, singleDay: true }, { label: '7D', days: 7 }, { label: '30D', days: 30 }].map(p => {
                                const isActive = (() => {
                                    const end = new Date()
                                    const start = new Date()
                                    if (p.singleDay) {
                                        start.setDate(start.getDate() - p.days)
                                        return perfStartDate === start.toLocaleDateString('en-CA') && perfEndDate === start.toLocaleDateString('en-CA')
                                    }
                                    start.setDate(start.getDate() - p.days)
                                    return perfStartDate === start.toLocaleDateString('en-CA') && perfEndDate === end.toLocaleDateString('en-CA')
                                })()
                                return (
                                    <button
                                        key={p.label}
                                        onClick={() => {
                                            const end = new Date()
                                            const start = new Date()
                                            if (p.singleDay) {
                                                start.setDate(start.getDate() - p.days)
                                                setPerfStartDate(start.toLocaleDateString('en-CA'))
                                                setPerfEndDate(start.toLocaleDateString('en-CA'))
                                            } else {
                                                start.setDate(start.getDate() - p.days)
                                                setPerfStartDate(start.toLocaleDateString('en-CA'))
                                                setPerfEndDate(end.toLocaleDateString('en-CA'))
                                            }
                                        }}
                                        className={`text-[11px] px-1.5 py-1 rounded-md transition-colors font-medium ${isActive
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                            }`}
                                    >
                                        {p.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                    <div className="hidden md:flex items-center gap-1.5">
                        <Select value={selectedShopId} onValueChange={(v) => { setSelectedShopId(v); setSelectedCampaignIds(new Set()); setBulkBudgetValue('') }}>
                            <SelectTrigger className="w-[160px] !h-7 py-1 text-xs">
                                <Store className="mr-1 h-3 w-3 shrink-0 text-muted-foreground" />
                                <span className="truncate"><SelectValue placeholder="Select shop" /></span>
                            </SelectTrigger>
                            <SelectContent>
                                {shops.map(shop => (
                                    <SelectItem key={shop.shop_id} value={shop.shop_id.toString()}>
                                        {shop.shop_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <div className="w-px h-5 bg-border" />

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { fetchBalance(); fetchCampaigns(); fetchPerformance(); fetchDashboard() }}
                            disabled={isLoadingBalance}
                            className="h-7 w-7"
                        >
                            {isLoadingBalance ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <RefreshCw className="h-3.5 w-3.5" />
                            )}
                        </Button>
                    </div>
                </div>

                {/* Dashboard Tab */}
                <TabsContent value="dashboard" className="space-y-4">
                    {/* Aggregated Performance — compact metrics strip */}
                    <div className="rounded-lg border bg-card/50 backdrop-blur-sm">
                        <div className="flex items-center gap-2 px-4 py-2 border-b">
                            <BarChart3 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Performance Overview</span>
                            <span className="text-xs text-muted-foreground">· {shopPerformances.length} shops</span>
                        </div>
                        {isLoadingDashboard ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 md:divide-x">
                                {[
                                    { label: 'Ad Spend', value: formatCurrency(aggregatedPerformance.expense), color: 'text-violet-600 dark:text-violet-400', icon: DollarSign },
                                    { label: 'Revenue (GMV)', value: formatCurrency(aggregatedPerformance.gmv), color: 'text-emerald-600 dark:text-emerald-400', icon: TrendingUp },
                                    { label: 'Orders', value: formatNumber(aggregatedPerformance.orders), color: 'text-orange-600 dark:text-orange-400', icon: ShoppingBag },
                                    { label: 'ROAS', value: `${aggregatedPerformance.roas.toFixed(2)}x`, color: aggregatedPerformance.roas >= 3 ? 'text-emerald-600 dark:text-emerald-400' : aggregatedPerformance.roas >= 1 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400', icon: Target },
                                    { label: 'Balance', value: formatCurrency(totalBalance), color: 'text-blue-600 dark:text-blue-400', icon: Wallet },
                                    { label: 'Impressions', value: formatNumber(aggregatedPerformance.impression), color: '', icon: Eye },
                                    { label: 'Clicks', value: formatNumber(aggregatedPerformance.clicks), color: '', icon: MousePointerClick },
                                    { label: 'CTR', value: `${(aggregatedPerformance.ctr * 100).toFixed(2)}%`, color: '', icon: BarChart3 },
                                ].map((m, i) => (
                                    <div key={i} className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                                            <m.icon className="h-3 w-3" />
                                            {m.label}
                                        </div>
                                        <div className={`text-base md:text-lg font-semibold tabular-nums ${m.color}`}>{m.value}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Shop Performance Breakdown */}
                    <div className="rounded-lg border bg-card/50 backdrop-blur-sm">
                        <div className="flex items-center gap-2 px-4 py-2 border-b">
                            <Store className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Shop Performance</span>
                        </div>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="text-xs">Shop</TableHead>
                                        <TableHead className="text-xs text-right">Balance</TableHead>
                                        <TableHead className="text-xs text-right hidden sm:table-cell">Spend</TableHead>
                                        <TableHead className="text-xs text-right hidden sm:table-cell">GMV</TableHead>
                                        <TableHead className="text-xs text-right">ROAS</TableHead>
                                        <TableHead className="text-xs text-right hidden md:table-cell">Impr.</TableHead>
                                        <TableHead className="text-xs text-right hidden md:table-cell">Clicks</TableHead>
                                        <TableHead className="text-xs text-right hidden md:table-cell">CTR</TableHead>
                                        <TableHead className="text-xs text-right hidden sm:table-cell">Orders</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(isLoadingDashboard || isLoadingBalance) ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="text-center py-8">
                                                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                                            </TableCell>
                                        </TableRow>
                                    ) : shopPerformances.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="text-center py-8 text-sm text-muted-foreground">
                                                No shops connected
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        shopPerformances.map(shop => {
                                            const balance = balanceData.find(b => b.shop_id === shop.shop_id)
                                            return (
                                                <TableRow key={shop.shop_id} className="hover:bg-muted/50">
                                                    <TableCell className="text-sm">
                                                        <div className="flex items-center gap-1.5">
                                                            <Store className="h-3 w-3 text-muted-foreground shrink-0" />
                                                            <span className="font-medium truncate max-w-[120px] sm:max-w-[180px]" title={shop.shop_name}>{shop.shop_name}</span>
                                                            {shop.error && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-5 px-1.5 text-[10px] text-destructive hover:text-destructive"
                                                                    onClick={(e) => { e.stopPropagation(); retryShopPerformance(shop.shop_id, shop.shop_name) }}
                                                                    disabled={retryingShopId === shop.shop_id}
                                                                >
                                                                    {retryingShopId === shop.shop_id ? (
                                                                        <Loader2 className="h-2.5 w-2.5 animate-spin mr-0.5" />
                                                                    ) : (
                                                                        <RefreshCw className="h-2.5 w-2.5 mr-0.5" />
                                                                    )}
                                                                    Retry
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm font-medium text-blue-600 dark:text-blue-400">
                                                        {balance ? formatCurrency(balance.balance) : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm font-medium text-violet-600 dark:text-violet-400 hidden sm:table-cell">{formatCurrency(shop.expense)}</TableCell>
                                                    <TableCell className="text-right text-sm font-medium text-emerald-600 dark:text-emerald-400 hidden sm:table-cell">{formatCurrency(shop.broad_gmv)}</TableCell>
                                                    <TableCell className="text-right text-sm">
                                                        <Badge
                                                            variant={shop.broad_roas >= 1 ? 'default' : 'secondary'}
                                                            className={`text-[10px] px-1.5 py-0 ${shop.broad_roas >= 2 ? 'bg-emerald-500' : shop.broad_roas >= 1 ? 'bg-amber-500' : ''}`}
                                                        >
                                                            {shop.broad_roas.toFixed(2)}x
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm tabular-nums hidden md:table-cell">{formatNumber(shop.impression)}</TableCell>
                                                    <TableCell className="text-right text-sm tabular-nums hidden md:table-cell">{formatNumber(shop.clicks)}</TableCell>
                                                    <TableCell className="text-right text-sm tabular-nums hidden md:table-cell">{(shop.ctr * 100).toFixed(2)}%</TableCell>
                                                    <TableCell className="text-right text-sm tabular-nums hidden sm:table-cell">{formatNumber(shop.broad_order)}</TableCell>
                                                </TableRow>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </TabsContent>

                {/* Campaigns Tab */}
                <TabsContent value="campaigns" className="space-y-4">
                    {/* Compact Shop Performance Strip */}
                    {(() => {
                        const shopPerf = shopPerformances.find(s => s.shop_id === parseInt(selectedShopId))
                        const shopBal = balanceData.find(b => b.shop_id === parseInt(selectedShopId))
                        if (!selectedShopId) return null
                        return (
                            <div className="rounded-lg border bg-card/50 backdrop-blur-sm px-3 md:px-5 py-3">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <span className="text-sm font-medium truncate">
                                            {shops.find(s => s.shop_id === parseInt(selectedShopId))?.shop_name || 'Shop'}
                                        </span>
                                        {shopBal && (
                                            <Badge variant="outline" className="text-xs shrink-0 font-normal text-blue-600 border-blue-200 bg-blue-50/50">
                                                <Wallet className="h-3 w-3 mr-1" />
                                                {formatCurrency(shopBal.balance)}
                                            </Badge>
                                        )}
                                    </div>
                                    {isLoadingDashboard ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    ) : shopPerf ? (
                                        <div className="flex items-center gap-3 md:gap-4 text-xs flex-wrap">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-muted-foreground">Spend</span>
                                                <span className="font-semibold text-violet-600">{formatCurrency(shopPerf.expense)}</span>
                                            </div>
                                            <div className="w-px h-3.5 bg-border" />
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-muted-foreground">GMV</span>
                                                <span className="font-semibold text-emerald-600">{formatCurrency(shopPerf.broad_gmv)}</span>
                                            </div>
                                            <div className="w-px h-3.5 bg-border" />
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-muted-foreground">ROAS</span>
                                                <span className={`font-semibold ${shopPerf.broad_roas >= 2 ? 'text-emerald-600' : shopPerf.broad_roas >= 1 ? 'text-amber-600' : 'text-red-500'}`}>
                                                    {shopPerf.broad_roas.toFixed(2)}x
                                                </span>
                                            </div>
                                            <div className="w-px h-3.5 bg-border" />
                                            <div className="hidden md:flex items-center gap-1.5">
                                                <Eye className="h-3 w-3 text-muted-foreground" />
                                                <span className="font-medium">{formatNumber(shopPerf.impression)}</span>
                                            </div>
                                            <div className="hidden md:flex items-center gap-1.5">
                                                <MousePointerClick className="h-3 w-3 text-muted-foreground" />
                                                <span className="font-medium">{formatNumber(shopPerf.clicks)}</span>
                                            </div>
                                            <div className="hidden md:flex items-center gap-1.5">
                                                <span className="text-muted-foreground">CTR</span>
                                                <span className="font-medium">{(shopPerf.ctr * 100).toFixed(2)}%</span>
                                            </div>
                                            <div className="w-px h-3.5 bg-border" />
                                            <div className="flex items-center gap-1.5">
                                                <ShoppingBag className="h-3 w-3 text-muted-foreground" />
                                                <span className="font-medium">{formatNumber(shopPerf.broad_order)}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">No performance data</span>
                                    )}
                                </div>
                            </div>
                        )
                    })()}

                    <div className="rounded-lg border bg-card/50 backdrop-blur-sm">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between px-3 md:px-4 py-2 border-b gap-2">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    className="h-3.5 w-3.5 rounded border-muted-foreground/50 accent-primary cursor-pointer"
                                    checked={paginatedCampaigns.length > 0 && selectedCampaignIds.size === paginatedCampaigns.length}
                                    onChange={toggleSelectAll}
                                    title="Select all"
                                />
                                <Zap className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Campaigns</span>
                                <span className="text-xs text-muted-foreground">· {campaigns.length}</span>
                                {selectedCampaignIds.size > 0 && (
                                    <span className="text-xs text-primary font-medium">({selectedCampaignIds.size} selected)</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedCampaignIds.size > 0 && (
                                    <>
                                        <span className="text-xs text-muted-foreground">Budget:</span>
                                        <Input
                                            type="number"
                                            value={bulkBudgetValue}
                                            onChange={(e) => setBulkBudgetValue(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter' && bulkBudgetValue && !isBulkEditing) bulkEditBudget() }}
                                            className="h-7 w-40 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            placeholder="Budget amount"
                                        />
                                        <Button
                                            size="sm"
                                            className="h-7 text-xs px-3"
                                            onClick={bulkEditBudget}
                                            disabled={isBulkEditing || !bulkBudgetValue}
                                        >
                                            {isBulkEditing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                            {isBulkEditing ? 'Applying...' : 'Apply'}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 hover:bg-destructive/10"
                                            onClick={() => { setSelectedCampaignIds(new Set()); setBulkBudgetValue('') }}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                        <div className="w-px h-5 bg-border" />
                                    </>
                                )}
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className={`w-[120px] h-7 text-xs ${selectedCampaignIds.size > 0 ? 'hidden md:flex' : ''}`}>
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        <SelectItem value="ongoing">Ongoing</SelectItem>
                                        <SelectItem value="paused">Paused</SelectItem>
                                        <SelectItem value="scheduled">Scheduled</SelectItem>
                                        <SelectItem value="ended">Ended</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {isLoadingCampaigns ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : paginatedCampaigns.length === 0 ? (
                            <div className="text-center py-12 text-sm text-muted-foreground">No campaigns found</div>
                        ) : (
                            <div className="divide-y">
                                {paginatedCampaigns.map(campaign => {
                                    const currentStatus = campaign.common_info?.campaign_status || ''
                                    const statusConf = statusConfig[currentStatus]
                                    const isStatusLoading = actionLoading?.id === campaign.campaign_id && ['pause', 'resume', 'stop'].includes(actionLoading.action)
                                    const isBudgetLoading = actionLoading?.id === campaign.campaign_id && actionLoading.action === 'change_budget'
                                    const isRoasLoading = actionLoading?.id === campaign.campaign_id && actionLoading.action === 'change_roas_target'
                                    const isAnyLoading = actionLoading?.id === campaign.campaign_id

                                    const perf = campaignPerformanceMap[campaign.campaign_id]
                                    const adName = campaign.common_info?.ad_name || '-'
                                    const itemId = campaign.common_info?.item_id_list?.[0]
                                    const product = itemId ? productMap[itemId] : null

                                    return (
                                        <div key={campaign.campaign_id} className={`flex flex-col md:flex-row md:items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 hover:bg-muted/30 transition-colors group ${selectedCampaignIds.has(campaign.campaign_id) ? 'bg-primary/5' : ''}`}>
                                            {/* Top row: checkbox + thumbnail + name + status */}
                                            <div className="flex items-center gap-2 md:gap-3 min-w-0 md:flex-1">
                                                {/* Checkbox */}
                                                <input
                                                    type="checkbox"
                                                    className="h-3.5 w-3.5 shrink-0 rounded border-muted-foreground/50 accent-primary cursor-pointer"
                                                    checked={selectedCampaignIds.has(campaign.campaign_id)}
                                                    onChange={() => toggleCampaignSelection(campaign.campaign_id)}
                                                />
                                                {/* Product Thumbnail */}
                                                <div className="shrink-0">
                                                    {product?.image_url ? (
                                                        <img
                                                            src={product.image_url}
                                                            alt=""
                                                            className="h-10 w-10 rounded-md object-cover border"
                                                        />
                                                    ) : (
                                                        <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                                                            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Name + Status */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium truncate" title={adName}>{adName}</span>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Badge
                                                                    variant={statusConf?.variant || 'secondary'}
                                                                    className="cursor-pointer hover:opacity-80 shrink-0 text-[10px] px-1.5 py-0"
                                                                >
                                                                    {isStatusLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin mr-0.5" /> : null}
                                                                    {statusConf?.label || currentStatus}
                                                                </Badge>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-36 p-1.5">
                                                                <div className="flex flex-col gap-0.5">
                                                                    {currentStatus === 'paused' && (
                                                                        <Button variant="ghost" size="sm" className="justify-start h-7 text-xs" onClick={() => quickCampaignAction(campaign, 'resume')} disabled={isAnyLoading}>
                                                                            <Play className="h-3 w-3 mr-1.5 text-green-600" /> Resume
                                                                        </Button>
                                                                    )}
                                                                    {currentStatus === 'ongoing' && (
                                                                        <Button variant="ghost" size="sm" className="justify-start h-7 text-xs" onClick={() => quickCampaignAction(campaign, 'pause')} disabled={isAnyLoading}>
                                                                            <Pause className="h-3 w-3 mr-1.5 text-yellow-600" /> Pause
                                                                        </Button>
                                                                    )}
                                                                    {(currentStatus === 'ongoing' || currentStatus === 'paused') && (
                                                                        <Button variant="ghost" size="sm" className="justify-start h-7 text-xs text-red-600 hover:text-red-600" onClick={() => quickCampaignAction(campaign, 'stop')} disabled={isAnyLoading}>
                                                                            <Square className="h-3 w-3 mr-1.5" /> Stop
                                                                        </Button>
                                                                    )}
                                                                    {(currentStatus === 'ended' || currentStatus === 'closed') && (
                                                                        <span className="text-[10px] text-muted-foreground px-2 py-1">No actions</span>
                                                                    )}
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                    {product?.item_sku && (
                                                        <span className="text-[11px] text-muted-foreground">SKU: {product.item_sku}</span>
                                                    )}
                                                </div>

                                                {/* Mobile: View Detail button */}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 shrink-0 md:hidden"
                                                    onClick={() => setSelectedCampaign(campaign)}
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>

                                            {/* Bottom row on mobile: Budget + ROAS + Key metrics */}
                                            <div className="flex items-center gap-2 md:gap-3 ml-[52px] md:ml-0 flex-wrap md:flex-nowrap md:shrink-0">
                                                {/* Budget */}
                                                <div className="shrink-0 text-right w-auto md:w-24">
                                                    <div className="flex items-center justify-end gap-0.5 group/budget">
                                                        <div>
                                                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Budget</div>
                                                            <div className="text-xs font-medium tabular-nums">{campaign.common_info?.campaign_budget ? formatCurrency(campaign.common_info.campaign_budget) : '∞'}</div>
                                                        </div>
                                                        <Button variant="ghost" size="icon" className="h-5 w-5 md:h-4 md:w-4 md:opacity-0 md:group-hover/budget:opacity-100 transition-opacity" onClick={() => { setPopoverEditValue(campaign.common_info?.campaign_budget?.toString() || ''); setOpenPopover(`budget-${campaign.campaign_id}`) }}>
                                                            <Pencil className="h-2.5 w-2.5" />
                                                        </Button>
                                                    </div>
                                                    <Dialog open={openPopover === `budget-${campaign.campaign_id}`} onOpenChange={(open) => { if (!open) setOpenPopover(null) }}>
                                                        <DialogContent className="sm:max-w-xs">
                                                            <DialogHeader>
                                                                <DialogTitle className="text-sm">Edit Budget</DialogTitle>
                                                                <DialogDescription className="text-xs">
                                                                    {campaign.common_info?.ad_name}
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <div className="space-y-3 py-2">
                                                                <Input
                                                                    type="number"
                                                                    value={popoverEditValue}
                                                                    onChange={(e) => setPopoverEditValue(e.target.value)}
                                                                    onKeyDown={(e) => { if (e.key === 'Enter' && popoverEditValue && !isBudgetLoading) quickCampaignAction(campaign, 'change_budget', parseFloat(popoverEditValue)) }}
                                                                    className="h-10 text-base [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                    placeholder="Budget amount"
                                                                    autoFocus
                                                                />
                                                            </div>
                                                            <DialogFooter>
                                                                <Button
                                                                    size="sm"
                                                                    className="w-full"
                                                                    onClick={() => quickCampaignAction(campaign, 'change_budget', parseFloat(popoverEditValue))}
                                                                    disabled={isBudgetLoading}
                                                                >
                                                                    {isBudgetLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                                                                    Save
                                                                </Button>
                                                            </DialogFooter>
                                                        </DialogContent>
                                                    </Dialog>
                                                </div>

                                                {/* ROAS Target */}
                                                <div className="shrink-0 text-right w-auto md:w-16">
                                                    <div className="flex items-center justify-end gap-0.5 group/roas">
                                                        <div>
                                                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">ROAS</div>
                                                            <div className="text-xs font-medium tabular-nums">{campaign.auto_bidding_info?.roas_target ? `${campaign.auto_bidding_info.roas_target}x` : campaign.auto_bidding_info ? 'Auto' : '—'}</div>
                                                        </div>
                                                        {campaign.auto_bidding_info && (
                                                            <Button variant="ghost" size="icon" className="h-5 w-5 md:h-4 md:w-4 md:opacity-0 md:group-hover/roas:opacity-100 transition-opacity" onClick={() => { setPopoverEditValue(campaign.auto_bidding_info?.roas_target?.toString() || ''); setOpenPopover(`roas-${campaign.campaign_id}`) }}>
                                                                <Pencil className="h-2.5 w-2.5" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <Dialog open={openPopover === `roas-${campaign.campaign_id}`} onOpenChange={(open) => { if (!open) setOpenPopover(null) }}>
                                                        <DialogContent className="sm:max-w-xs">
                                                            <DialogHeader>
                                                                <DialogTitle className="text-sm">Edit ROAS Target</DialogTitle>
                                                                <DialogDescription className="text-xs">
                                                                    {campaign.common_info?.ad_name}
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <div className="space-y-3 py-2">
                                                                <Input
                                                                    type="number"
                                                                    step="0.1"
                                                                    value={popoverEditValue}
                                                                    onChange={(e) => setPopoverEditValue(e.target.value)}
                                                                    onKeyDown={(e) => { if (e.key === 'Enter' && popoverEditValue && !isRoasLoading) quickCampaignAction(campaign, 'change_roas_target', parseFloat(popoverEditValue)) }}
                                                                    className="h-10 text-base [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                    placeholder="ROAS target"
                                                                    autoFocus
                                                                />
                                                            </div>
                                                            <DialogFooter>
                                                                <Button
                                                                    size="sm"
                                                                    className="w-full"
                                                                    onClick={() => quickCampaignAction(campaign, 'change_roas_target', parseFloat(popoverEditValue))}
                                                                    disabled={isRoasLoading}
                                                                >
                                                                    {isRoasLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                                                                    Save
                                                                </Button>
                                                            </DialogFooter>
                                                        </DialogContent>
                                                    </Dialog>
                                                </div>

                                                {/* Divider */}
                                                <div className="w-px h-6 bg-border shrink-0 hidden md:block" />

                                                {/* Performance Metrics - key metrics visible, secondary hidden on mobile */}
                                                <div className="flex items-center gap-3 md:gap-4 text-xs shrink-0 flex-wrap">
                                                    <div className="text-right w-auto md:w-[72px]">
                                                        <div className="text-[10px] text-muted-foreground">Spend</div>
                                                        <div className={`font-medium tabular-nums ${perf ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground'}`}>
                                                            {isLoadingCampaignPerf ? '—' : perf ? formatCurrency(perf.expense) : '—'}
                                                        </div>
                                                    </div>
                                                    <div className="text-right w-auto md:w-[72px] hidden sm:block">
                                                        <div className="text-[10px] text-muted-foreground">GMV</div>
                                                        <div className={`font-medium tabular-nums ${perf && perf.broad_gmv > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                                            {isLoadingCampaignPerf ? '—' : perf ? formatCurrency(perf.broad_gmv) : '—'}
                                                        </div>
                                                    </div>
                                                    <div className="text-right w-auto md:w-12">
                                                        <div className="text-[10px] text-muted-foreground">Orders</div>
                                                        <div className={`font-medium tabular-nums ${perf && perf.broad_order > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                                            {isLoadingCampaignPerf ? '—' : perf ? formatNumber(perf.broad_order) : '—'}
                                                        </div>
                                                    </div>
                                                    <div className="text-right w-auto md:w-12">
                                                        <div className="text-[10px] text-muted-foreground">ROAS</div>
                                                        <div className={`font-medium tabular-nums ${perf && perf.broad_roas >= 3 ? 'text-emerald-600 dark:text-emerald-400' : perf && perf.broad_roas > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                                                            {isLoadingCampaignPerf ? '—' : perf ? `${perf.broad_roas.toFixed(1)}x` : '—'}
                                                        </div>
                                                    </div>
                                                    <div className="w-px h-6 bg-border shrink-0 hidden md:block" />
                                                    <div className="text-right w-12 hidden md:block">
                                                        <div className="text-[10px] text-muted-foreground">Impr.</div>
                                                        <div className="font-medium tabular-nums">{perf ? formatNumber(perf.impression) : '—'}</div>
                                                    </div>
                                                    <div className="text-right w-12 hidden md:block">
                                                        <div className="text-[10px] text-muted-foreground">Clicks</div>
                                                        <div className="font-medium tabular-nums">{perf ? formatNumber(perf.clicks) : '—'}</div>
                                                    </div>
                                                    <div className="text-right w-11 hidden md:block">
                                                        <div className="text-[10px] text-muted-foreground">CTR</div>
                                                        <div className="font-medium tabular-nums">{perf ? `${(perf.ctr * 100).toFixed(1)}%` : '—'}</div>
                                                    </div>
                                                    <div className="text-right w-14 hidden md:block">
                                                        <div className="text-[10px] text-muted-foreground">CPC</div>
                                                        <div className="font-medium tabular-nums">{isLoadingCampaignPerf ? '—' : perf ? formatCurrency(perf.cpc) : '—'}</div>
                                                    </div>
                                                </div>

                                                {/* Desktop: View Detail */}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex"
                                                    onClick={() => setSelectedCampaign(campaign)}
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}


                        {/* Pagination */}
                        {campaigns.length > 50 && (
                            <div className="flex items-center justify-between px-4 py-2 border-t">
                                <span className="text-xs text-muted-foreground">
                                    {campaignPage * 50 + 1}–{Math.min((campaignPage + 1) * 50, campaigns.length)} of {campaigns.length}
                                </span>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCampaignPage(p => Math.max(0, p - 1))} disabled={campaignPage === 0}>
                                        <ChevronLeft className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCampaignPage(p => p + 1)} disabled={!hasMorePages}>
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </TabsContent>


                {/* Campaign Detail Dialog */}
                <Dialog open={!!selectedCampaign} onOpenChange={() => setSelectedCampaign(null)}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Campaign Details</DialogTitle>
                            <DialogDescription>
                                Campaign #{selectedCampaign?.campaign_id}
                            </DialogDescription>
                        </DialogHeader>
                        {selectedCampaign && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Name</p>
                                        <p className="font-medium">{selectedCampaign.common_info?.ad_name || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Type</p>
                                        <p className="font-medium capitalize">{selectedCampaign.common_info?.ad_type || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Status</p>
                                        <Badge>{selectedCampaign.common_info?.campaign_status || '-'}</Badge>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Budget</p>
                                        <p className="font-medium">
                                            {selectedCampaign.common_info?.campaign_budget
                                                ? formatCurrency(selectedCampaign.common_info.campaign_budget)
                                                : 'Unlimited'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Bidding Method</p>
                                        <p className="font-medium capitalize">{selectedCampaign.common_info?.bidding_method || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Placement</p>
                                        <p className="font-medium capitalize">{selectedCampaign.common_info?.campaign_placement || '-'}</p>
                                    </div>
                                </div>

                                {selectedCampaign.auto_bidding_info && (
                                    <div className="border-t pt-4">
                                        <h4 className="font-semibold mb-2">Auto Bidding</h4>
                                        <p className="text-sm">
                                            ROAS Target: <strong>{selectedCampaign.auto_bidding_info.roas_target}x</strong>
                                        </p>
                                    </div>
                                )}

                                {selectedCampaign.manual_bidding_info?.selected_keywords && (
                                    <div className="border-t pt-4">
                                        <h4 className="font-semibold mb-2">Keywords</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedCampaign.manual_bidding_info.selected_keywords.map((kw, idx) => (
                                                <Badge key={idx} variant="outline">
                                                    {kw.keyword} ({kw.match_type})
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end gap-2 pt-4 border-t">
                                    <Button variant="outline" onClick={() => setSelectedCampaign(null)}>
                                        Close
                                    </Button>
                                    <Button onClick={() => {
                                        setEditingCampaign(selectedCampaign)
                                        setEditBudget(selectedCampaign?.common_info?.campaign_budget?.toString() || '')
                                        setSelectedCampaign(null)
                                    }}>
                                        <Settings className="mr-2 h-4 w-4" />
                                        Edit Campaign
                                    </Button>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Edit Campaign Dialog */}
                <Dialog open={!!editingCampaign} onOpenChange={() => setEditingCampaign(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Campaign</DialogTitle>
                            <DialogDescription>
                                Campaign #{editingCampaign?.campaign_id} - {editingCampaign?.common_info?.ad_name || 'Unnamed'}
                            </DialogDescription>
                        </DialogHeader>
                        {editingCampaign && (
                            <div className="space-y-4 py-4">
                                <div className="grid gap-4">
                                    <div>
                                        <Label>Current Status</Label>
                                        <Badge className="mt-1">
                                            {editingCampaign.common_info?.campaign_status || '-'}
                                        </Badge>
                                    </div>
                                    <div>
                                        <Label htmlFor="budget">Budget</Label>
                                        <Input
                                            id="budget"
                                            type="number"
                                            value={editBudget}
                                            onChange={(e) => setEditBudget(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter' && editBudget && !isEditing) handleEditCampaign('change_budget') }}
                                            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            placeholder="Enter new budget"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Quick Actions</Label>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleEditCampaign('pause')}
                                            disabled={isEditing || editingCampaign.common_info?.campaign_status === 'paused'}
                                        >
                                            Pause
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleEditCampaign('resume')}
                                            disabled={isEditing || editingCampaign.common_info?.campaign_status === 'ongoing'}
                                        >
                                            Resume
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => handleEditCampaign('stop')}
                                            disabled={isEditing || editingCampaign.common_info?.campaign_status === 'closed'}
                                        >
                                            Stop
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditingCampaign(null)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={() => handleEditCampaign('change_budget')}
                                disabled={isEditing || !editBudget}
                            >
                                {isEditing ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : null}
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </Tabs>
        </div>
    )
}
