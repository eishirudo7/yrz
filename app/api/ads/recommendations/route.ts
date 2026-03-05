import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getShopeeSDK } from '@/lib/shopee-sdk'
import { db } from '@/db'
import { shopeeTokens } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * GET /api/ads/recommendations
 * Fetches recommended items for advertising.
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

        if (!shopId) {
            return NextResponse.json({ error: 'shop_id is required' }, { status: 400 })
        }

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

        const result = await sdk.ads.getRecommendedItemList()

        return NextResponse.json({
            items: result.response || [],
            shop_id: shop.shop_id,
            shop_name: shop.shop_name
        })
    } catch (error) {
        console.error('Recommendations API error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
