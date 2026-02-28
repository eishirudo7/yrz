import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getShopeeSDK } from '@/lib/shopee-sdk'

interface ShopPerformance {
    shop_id: number
    shop_name: string
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

/**
 * GET /api/ads/performance/all-shops
 * 
 * Fetches aggregated ads performance data from ALL connected shops.
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const dateParam = searchParams.get('date')
        const startDateParam = searchParams.get('start_date')
        const endDateParam = searchParams.get('end_date')

        const today = new Date()
        const formatDate = (d: Date) => {
            const day = d.getDate().toString().padStart(2, '0')
            const month = (d.getMonth() + 1).toString().padStart(2, '0')
            const year = d.getFullYear()
            return `${day}-${month}-${year}`
        }

        const useRange = startDateParam !== null
        const startDate = startDateParam || dateParam || formatDate(today)
        const endDate = endDateParam || startDate

        // Get all shops for this user
        const { data: shops, error: shopsError } = await supabase
            .from('shopee_tokens')
            .select('shop_id, shop_name')
            .eq('user_id', user.id)
            .eq('is_active', true)

        if (shopsError || !shops || shops.length === 0) {
            return NextResponse.json({
                shops: [],
                aggregated: {
                    impression: 0,
                    clicks: 0,
                    ctr: 0,
                    expense: 0,
                    gmv: 0,
                    roas: 0,
                    orders: 0
                },
                start_date: startDate,
                end_date: endDate
            })
        }

        // Fetch performance for each shop in parallel
        const performancePromises = shops.map(async (shop): Promise<ShopPerformance> => {
            try {
                const sdk = getShopeeSDK(shop.shop_id)

                if (useRange || startDate !== endDate) {
                    const result = await sdk.ads.getAllCpcAdsDailyPerformance({
                        start_date: startDate,
                        end_date: endDate
                    })

                    const dailyData = result.response || []

                    const aggregated = dailyData.reduce((acc: AggregatedPerformance, d: any) => ({
                        impression: acc.impression + (d.impression || 0),
                        clicks: acc.clicks + (d.clicks || 0),
                        ctr: 0,
                        expense: acc.expense + (d.expense || 0),
                        gmv: acc.gmv + (d.broad_gmv || 0),
                        roas: 0,
                        orders: acc.orders + (d.broad_order || 0)
                    }), { impression: 0, clicks: 0, ctr: 0, expense: 0, gmv: 0, roas: 0, orders: 0 })

                    aggregated.ctr = aggregated.impression > 0 ? aggregated.clicks / aggregated.impression : 0
                    aggregated.roas = aggregated.expense > 0 ? aggregated.gmv / aggregated.expense : 0

                    return {
                        shop_id: shop.shop_id,
                        shop_name: shop.shop_name,
                        impression: aggregated.impression,
                        clicks: aggregated.clicks,
                        ctr: aggregated.ctr,
                        expense: aggregated.expense,
                        direct_gmv: 0,
                        broad_gmv: aggregated.gmv,
                        direct_roas: 0,
                        broad_roas: aggregated.roas,
                        direct_order: 0,
                        broad_order: aggregated.orders
                    }
                } else {
                    const result = await sdk.ads.getAllCpcAdsHourlyPerformance({
                        performance_date: startDate
                    })

                    const hourlyData = result.response || []

                    const aggregated = hourlyData.reduce((acc: AggregatedPerformance, h: any) => ({
                        impression: acc.impression + (h.impression || 0),
                        clicks: acc.clicks + (h.clicks || 0),
                        ctr: 0,
                        expense: acc.expense + (h.expense || 0),
                        gmv: acc.gmv + (h.broad_gmv || 0),
                        roas: 0,
                        orders: acc.orders + (h.broad_order || 0)
                    }), { impression: 0, clicks: 0, ctr: 0, expense: 0, gmv: 0, roas: 0, orders: 0 })

                    aggregated.ctr = aggregated.impression > 0 ? aggregated.clicks / aggregated.impression : 0
                    aggregated.roas = aggregated.expense > 0 ? aggregated.gmv / aggregated.expense : 0

                    return {
                        shop_id: shop.shop_id,
                        shop_name: shop.shop_name,
                        impression: aggregated.impression,
                        clicks: aggregated.clicks,
                        ctr: aggregated.ctr,
                        expense: aggregated.expense,
                        direct_gmv: 0,
                        broad_gmv: aggregated.gmv,
                        direct_roas: 0,
                        broad_roas: aggregated.roas,
                        direct_order: 0,
                        broad_order: aggregated.orders
                    }
                }
            } catch (error) {
                console.error(`Failed to fetch performance for shop ${shop.shop_id}:`, error)
                return {
                    shop_id: shop.shop_id,
                    shop_name: shop.shop_name,
                    impression: 0,
                    clicks: 0,
                    ctr: 0,
                    expense: 0,
                    direct_gmv: 0,
                    broad_gmv: 0,
                    direct_roas: 0,
                    broad_roas: 0,
                    direct_order: 0,
                    broad_order: 0,
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            }
        })

        const shopPerformances = await Promise.all(performancePromises)

        // Calculate aggregated totals
        const totals = shopPerformances.reduce((acc, shop) => ({
            impression: acc.impression + shop.impression,
            clicks: acc.clicks + shop.clicks,
            expense: acc.expense + shop.expense,
            gmv: acc.gmv + shop.broad_gmv,
            orders: acc.orders + shop.broad_order
        }), { impression: 0, clicks: 0, expense: 0, gmv: 0, orders: 0 })

        const aggregated: AggregatedPerformance = {
            ...totals,
            ctr: totals.impression > 0 ? totals.clicks / totals.impression : 0,
            roas: totals.expense > 0 ? totals.gmv / totals.expense : 0
        }

        return NextResponse.json({
            shops: shopPerformances,
            aggregated,
            start_date: startDate,
            end_date: endDate,
            shop_count: shops.length
        })
    } catch (error) {
        console.error('All-shops performance API error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
