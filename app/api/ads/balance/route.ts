import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getShopeeSDK } from '@/lib/shopee-sdk'

/**
 * GET /api/ads/balance
 * 
 * Fetches ads balance and shop settings for all connected shops.
 * Uses SDK methods: getTotalBalance, getShopToggleInfo, getAdsFacilShopRate
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get optional shop_id filter
        const { searchParams } = new URL(request.url)
        const shopIdParam = searchParams.get('shop_id')

        // Get user's shops
        let query = supabase
            .from('shopee_tokens')
            .select('shop_id, shop_name')
            .eq('user_id', user.id)
            .eq('is_active', true)

        if (shopIdParam) {
            query = query.eq('shop_id', parseInt(shopIdParam))
        }

        const { data: shops, error: shopsError } = await query

        if (shopsError) {
            return NextResponse.json({ error: 'Failed to fetch shops' }, { status: 500 })
        }

        if (!shops || shops.length === 0) {
            return NextResponse.json({
                shops: [],
                totalBalance: 0,
                message: 'No active shops found'
            })
        }

        // Fetch balance data for each shop
        const balanceData = await Promise.all(
            shops.map(async (shop) => {
                try {
                    const sdk = getShopeeSDK(shop.shop_id)

                    // Fetch balance, toggle info, and facil rate in parallel
                    const [balanceResult, toggleResult, facilResult] = await Promise.allSettled([
                        sdk.ads.getTotalBalance(),
                        sdk.ads.getShopToggleInfo(),
                        sdk.ads.getAdsFacilShopRate()
                    ])

                    const balance = balanceResult.status === 'fulfilled'
                        ? balanceResult.value.response?.total_balance ?? 0
                        : 0

                    const toggleInfo = toggleResult.status === 'fulfilled'
                        ? toggleResult.value.response
                        : null

                    const facilRate = facilResult.status === 'fulfilled'
                        ? facilResult.value.response?.shop_rate
                        : null

                    return {
                        shop_id: shop.shop_id,
                        shop_name: shop.shop_name,
                        balance,
                        auto_top_up: toggleInfo?.auto_top_up ?? false,
                        campaign_surge: toggleInfo?.campaign_surge ?? false,
                        facil_rate: facilRate,
                        error: null
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

                    // Check if it's a permission error
                    if (errorMessage.includes('permission') || errorMessage.includes('ads')) {
                        return {
                            shop_id: shop.shop_id,
                            shop_name: shop.shop_name,
                            balance: 0,
                            auto_top_up: false,
                            campaign_surge: false,
                            facil_rate: null,
                            error: 'Ads API permission not enabled for this shop'
                        }
                    }

                    return {
                        shop_id: shop.shop_id,
                        shop_name: shop.shop_name,
                        balance: 0,
                        auto_top_up: false,
                        campaign_surge: false,
                        facil_rate: null,
                        error: errorMessage
                    }
                }
            })
        )

        // Calculate total balance
        const totalBalance = balanceData.reduce((sum, shop) => sum + (shop.balance || 0), 0)

        return NextResponse.json({
            shops: balanceData,
            totalBalance,
            timestamp: new Date().toISOString()
        })
    } catch (error) {
        console.error('Ads balance API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
