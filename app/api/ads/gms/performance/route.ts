import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getShopeeSDK } from '@/lib/shopee-sdk'

/**
 * GET /api/ads/gms/performance
 * Fetches GMS campaign and item performance.
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
        const campaignId = searchParams.get('campaign_id')
        const startDate = searchParams.get('start_date')
        const endDate = searchParams.get('end_date')
        const level = searchParams.get('level') || 'campaign'
        const offset = parseInt(searchParams.get('offset') || '0')
        const limit = parseInt(searchParams.get('limit') || '50')

        if (!shopId || !startDate || !endDate) {
            return NextResponse.json({
                error: 'shop_id, start_date, and end_date are required'
            }, { status: 400 })
        }

        const { data: shop, error: shopError } = await supabase
            .from('shopee_tokens')
            .select('shop_id')
            .eq('shop_id', parseInt(shopId))
            .eq('user_id', user.id)
            .single()

        if (shopError || !shop) {
            return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
        }

        const sdk = getShopeeSDK(shop.shop_id)

        let performanceData

        if (level === 'item') {
            const result = await sdk.ads.getGmsItemPerformance({
                campaign_id: campaignId ? parseInt(campaignId) : undefined,
                start_date: startDate,
                end_date: endDate,
                offset,
                limit
            })
            performanceData = result.response
        } else {
            const result = await sdk.ads.getGmsCampaignPerformance({
                campaign_id: campaignId ? parseInt(campaignId) : undefined,
                start_date: startDate,
                end_date: endDate
            })
            performanceData = result.response
        }

        return NextResponse.json({
            performance: performanceData,
            level,
            shop_id: shop.shop_id
        })
    } catch (error) {
        console.error('GMS performance error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
