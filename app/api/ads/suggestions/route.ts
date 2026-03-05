import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getShopeeSDK } from '@/lib/shopee-sdk'
import { db } from '@/db'
import { shopeeTokens } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * GET /api/ads/suggestions
 * Fetches suggestions for campaign creation (ROI targets and budget).
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
        const itemId = searchParams.get('item_id')
        const suggestionType = searchParams.get('type') || 'all'

        const productSelection = searchParams.get('product_selection') || 'manual'
        const campaignPlacement = searchParams.get('campaign_placement') || 'all'
        const biddingMethod = searchParams.get('bidding_method') || 'auto'
        const roasTarget = searchParams.get('roas_target')

        if (!shopId || !itemId) {
            return NextResponse.json({
                error: 'shop_id and item_id are required'
            }, { status: 400 })
        }

        const shopData = await db.select({
            shop_id: shopeeTokens.shopId
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
        const referenceId = `sug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        const result: {
            roi_target?: {
                lower_bound?: { value: number; percentile: number };
                exact?: { value: number; percentile: number };
                upper_bound?: { value: number; percentile: number };
            };
            budget?: unknown;
        } = {}

        if (suggestionType === 'roi' || suggestionType === 'all') {
            try {
                const roiResult = await sdk.ads.getProductRecommendedRoiTarget({
                    reference_id: referenceId,
                    item_id: parseInt(itemId)
                })
                result.roi_target = roiResult.response
            } catch {
                result.roi_target = undefined
            }
        }

        if (suggestionType === 'budget' || suggestionType === 'all') {
            try {
                const budgetResult = await sdk.ads.getCreateProductAdBudgetSuggestion({
                    reference_id: referenceId,
                    product_selection: productSelection,
                    campaign_placement: campaignPlacement,
                    bidding_method: biddingMethod,
                    item_id: parseInt(itemId),
                    roas_target: roasTarget ? parseFloat(roasTarget) : undefined
                })
                result.budget = budgetResult.response
            } catch {
                result.budget = undefined
            }
        }

        return NextResponse.json({
            suggestions: result,
            item_id: parseInt(itemId),
            shop_id: shop.shop_id
        })
    } catch (error) {
        console.error('Suggestions API error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
