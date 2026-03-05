import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getShopeeSDK } from '@/lib/shopee-sdk'
import { db } from '@/db'
import { shopeeTokens } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * GET /api/ads/performance
 * 
 * Fetches ads performance data (shop or campaign level).
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const shopId = searchParams.get('shop_id')
        const level = searchParams.get('level') || 'shop'
        const granularity = searchParams.get('granularity') || 'daily'
        const startDate = searchParams.get('start_date')
        const endDate = searchParams.get('end_date')
        const performanceDate = searchParams.get('performance_date')
        const campaignIds = searchParams.get('campaign_ids')

        if (!shopId) {
            return NextResponse.json({ error: 'shop_id is required' }, { status: 400 })
        }

        // Verify shop belongs to user
        const shopData = await db.select({
            shop_id: shopeeTokens.shopId,
            shop_name: shopeeTokens.shopName
        })
            .from(shopeeTokens)
            .where(
                and(
                    eq(shopeeTokens.shopId, parseInt(shopId)),
                    eq(shopeeTokens.userId, user.id)
                )
            )
            .limit(1)

        const shop = shopData[0]

        if (!shop) {
            return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
        }

        const sdk = getShopeeSDK(shop.shop_id)

        let performanceData

        if (level === 'shop') {
            if (granularity === 'hourly') {
                if (!performanceDate) {
                    return NextResponse.json({ error: 'performance_date required for hourly data' }, { status: 400 })
                }
                const result = await sdk.ads.getAllCpcAdsHourlyPerformance({
                    performance_date: performanceDate
                })
                performanceData = result.response || []
            } else {
                if (!startDate || !endDate) {
                    return NextResponse.json({ error: 'start_date and end_date required' }, { status: 400 })
                }
                const result = await sdk.ads.getAllCpcAdsDailyPerformance({
                    start_date: startDate,
                    end_date: endDate
                })
                performanceData = result.response || []
            }
        } else if (level === 'campaign') {
            if (!campaignIds) {
                return NextResponse.json({ error: 'campaign_ids required for campaign level' }, { status: 400 })
            }

            if (granularity === 'hourly') {
                if (!performanceDate) {
                    return NextResponse.json({ error: 'performance_date required for hourly data' }, { status: 400 })
                }
                const result = await sdk.ads.getProductCampaignHourlyPerformance({
                    performance_date: performanceDate,
                    campaign_id_list: campaignIds
                })
                performanceData = result.response || []
            } else {
                if (!startDate || !endDate) {
                    return NextResponse.json({ error: 'start_date and end_date required' }, { status: 400 })
                }
                const result = await sdk.ads.getProductCampaignDailyPerformance({
                    start_date: startDate,
                    end_date: endDate,
                    campaign_id_list: campaignIds
                })
                performanceData = result.response || []
            }
        } else {
            return NextResponse.json({ error: 'Invalid level. Use "shop" or "campaign"' }, { status: 400 })
        }

        return NextResponse.json({
            performance: performanceData,
            level,
            granularity,
            shop_id: shop.shop_id,
            shop_name: shop.shop_name
        })
    } catch (error) {
        console.error('Performance API error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
