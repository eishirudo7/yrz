import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getShopeeSDK } from '@/lib/shopee-sdk'
import { db } from '@/db'
import { shopeeTokens } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * POST /api/ads/gms
 * Creates a GMS product campaign.
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { shop_id, start_date, end_date, daily_budget, roas_target } = body

        if (!shop_id || !start_date || !daily_budget) {
            return NextResponse.json({
                error: 'shop_id, start_date, and daily_budget are required'
            }, { status: 400 })
        }

        const shopData = await db.select({
            shop_id: shopeeTokens.shopId
        })
            .from(shopeeTokens)
            .where(
                and(
                    eq(shopeeTokens.shopId, parseInt(shop_id)),
                    eq(shopeeTokens.userId, user.id)
                )
            )
            .limit(1)

        const shop = shopData[0]

        if (!shop) {
            return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
        }

        const sdk = getShopeeSDK(shop.shop_id)
        const referenceId = `gms-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        const result = await sdk.ads.createGmsProductCampaign({
            reference_id: referenceId,
            start_date,
            end_date: end_date || undefined,
            daily_budget,
            roas_target: roas_target || undefined
        })

        return NextResponse.json({
            success: true,
            campaign_id: result.response?.campaign_id
        })
    } catch (error) {
        console.error('Create GMS error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}

/**
 * PUT /api/ads/gms
 * Edits a GMS product campaign.
 */
export async function PUT(request: NextRequest) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { shop_id, campaign_id, edit_action, daily_budget, start_date, end_date, roas_target } = body

        if (!shop_id || !campaign_id || !edit_action) {
            return NextResponse.json({
                error: 'shop_id, campaign_id, and edit_action are required'
            }, { status: 400 })
        }

        const shopData = await db.select({
            shop_id: shopeeTokens.shopId
        })
            .from(shopeeTokens)
            .where(
                and(
                    eq(shopeeTokens.shopId, parseInt(shop_id)),
                    eq(shopeeTokens.userId, user.id)
                )
            )
            .limit(1)

        const shop = shopData[0]

        if (!shop) {
            return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
        }

        const sdk = getShopeeSDK(shop.shop_id)

        const result = await sdk.ads.editGmsProductCampaign({
            campaign_id,
            edit_action,
            daily_budget,
            start_date,
            end_date,
            roas_target
        })

        return NextResponse.json({
            success: true,
            campaign_id: result.response?.campaign_id
        })
    } catch (error) {
        console.error('Edit GMS error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
