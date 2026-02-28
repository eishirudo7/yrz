import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getShopeeSDK } from '@/lib/shopee-sdk'

/**
 * GET /api/ads/gms/items
 * Lists items removed from GMS campaign.
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
        const offset = parseInt(searchParams.get('offset') || '0')
        const limit = parseInt(searchParams.get('limit') || '50')

        if (!shopId) {
            return NextResponse.json({ error: 'shop_id is required' }, { status: 400 })
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

        const result = await sdk.ads.listGmsUserDeletedItem({
            offset,
            limit
        })

        return NextResponse.json({
            items: result.response || [],
            offset,
            limit
        })
    } catch (error) {
        console.error('GMS deleted items error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}

/**
 * PUT /api/ads/gms/items
 * Add or remove items from GMS campaign.
 */
export async function PUT(request: NextRequest) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { shop_id, campaign_id, edit_action, item_id_list } = body

        if (!shop_id || !edit_action || !item_id_list || item_id_list.length === 0) {
            return NextResponse.json({
                error: 'shop_id, edit_action, and item_id_list are required'
            }, { status: 400 })
        }

        if (item_id_list.length > 30) {
            return NextResponse.json({
                error: 'Maximum 30 items per request'
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

        const result = await sdk.ads.editGmsItemProductCampaign({
            campaign_id,
            edit_action,
            item_id_list
        })

        return NextResponse.json({
            success: true,
            campaign_id: result.response?.campaign_id
        })
    } catch (error) {
        console.error('GMS items error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
