import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getShopeeSDK } from '@/lib/shopee-sdk'

/**
 * GET /api/ads/keywords
 * Fetches recommended keywords for an item.
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
        const inputKeyword = searchParams.get('input_keyword')

        if (!shopId || !itemId) {
            return NextResponse.json({ error: 'shop_id and item_id are required' }, { status: 400 })
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

        const result = await sdk.ads.getRecommendedKeywordList({
            item_id: parseInt(itemId),
            input_keyword: inputKeyword || undefined
        })

        return NextResponse.json({
            item_id: result.response?.item_id,
            keywords: result.response?.suggested_keywords || [],
            input_keyword: result.response?.input_keyword
        })
    } catch (error) {
        console.error('Keywords API error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}

/**
 * PUT /api/ads/keywords
 * Edits keywords for a manual product ad campaign.
 */
export async function PUT(request: NextRequest) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { shop_id, campaign_id, edit_action, selected_keywords } = body

        if (!shop_id || !campaign_id || !edit_action) {
            return NextResponse.json({
                error: 'shop_id, campaign_id, and edit_action are required'
            }, { status: 400 })
        }

        const { data: shop, error: shopError } = await supabase
            .from('shopee_tokens')
            .select('shop_id')
            .eq('shop_id', shop_id)
            .eq('user_id', user.id)
            .single()

        if (shopError || !shop) {
            return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
        }

        const sdk = getShopeeSDK(shop.shop_id)
        const referenceId = `kw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        const result = await sdk.ads.editManualProductAdKeywords({
            reference_id: referenceId,
            campaign_id,
            edit_action,
            selected_keywords
        })

        return NextResponse.json({
            success: true,
            campaign_id: result.response?.campaign_id
        })
    } catch (error) {
        console.error('Edit keywords error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
