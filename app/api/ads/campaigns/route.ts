import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getShopeeSDK } from '@/lib/shopee-sdk'
import { db } from '@/db'
import { shopeeTokens } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * GET /api/ads/campaigns
 * 
 * Fetches campaign list and settings.
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
        const adType = searchParams.get('ad_type') || 'all'
        const offset = parseInt(searchParams.get('offset') || '0')
        const limit = parseInt(searchParams.get('limit') || '50')

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

        // Get campaign list
        const campaignListResult = await sdk.ads.getProductLevelCampaignIdList({
            ad_type: adType,
            offset,
            limit
        })

        const campaignList = campaignListResult.response?.campaign_list || []
        const hasNextPage = campaignListResult.response?.has_next_page || false

        if (campaignList.length === 0) {
            return NextResponse.json({
                campaigns: [],
                hasNextPage: false,
                total: 0
            })
        }

        // Get detailed settings for campaigns in batches of 100
        const campaignsWithSettings = []
        const batchSize = 100

        for (let i = 0; i < campaignList.length; i += batchSize) {
            const batch = campaignList.slice(i, i + batchSize)
            const campaignIds = batch.map((c: any) => c.campaign_id).join(',')

            const settingsResult = await sdk.ads.getProductLevelCampaignSettingInfo({
                campaign_id_list: campaignIds,
                info_type_list: '1,2,3,4'
            })

            const batchCampaigns = settingsResult.response?.campaign_list?.map((campaign: any) => ({
                campaign_id: campaign.campaign_id,
                common_info: campaign.common_info,
                manual_bidding_info: campaign.manual_bidding_info,
                auto_bidding_info: campaign.auto_bidding_info,
                auto_product_ads_info: campaign.auto_product_ads_info
            })) || []

            campaignsWithSettings.push(...batchCampaigns)
        }

        return NextResponse.json({
            campaigns: campaignsWithSettings,
            hasNextPage,
            shop_id: shop.shop_id,
            shop_name: shop.shop_name
        })
    } catch (error) {
        console.error('Campaigns API error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}

/**
 * POST /api/ads/campaigns
 * 
 * Creates a new campaign (auto or manual).
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { shop_id, campaign_type, ...campaignData } = body

        if (!shop_id) {
            return NextResponse.json({ error: 'shop_id is required' }, { status: 400 })
        }

        // Verify shop belongs to user
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

        // Generate unique reference ID
        const referenceId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        let result
        if (campaign_type === 'auto') {
            result = await sdk.ads.createAutoProductAds({
                reference_id: referenceId,
                budget: campaignData.budget,
                start_date: campaignData.start_date,
                end_date: campaignData.end_date
            })
        } else if (campaign_type === 'manual') {
            result = await sdk.ads.createManualProductAds({
                reference_id: referenceId,
                budget: campaignData.budget,
                start_date: campaignData.start_date,
                end_date: campaignData.end_date,
                bidding_method: campaignData.bidding_method || 'auto',
                item_id: campaignData.item_id,
                roas_target: campaignData.roas_target,
                selected_keywords: campaignData.selected_keywords,
                discovery_ads_locations: campaignData.discovery_ads_locations,
                enhanced_cpc: campaignData.enhanced_cpc,
                smart_creative_setting: campaignData.smart_creative_setting
            })
        } else {
            return NextResponse.json({ error: 'Invalid campaign_type. Use "auto" or "manual"' }, { status: 400 })
        }

        return NextResponse.json({
            success: true,
            campaign_id: result.response?.campaign_id,
            reference_id: referenceId
        })
    } catch (error) {
        console.error('Create campaign error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}

/**
 * PUT /api/ads/campaigns
 * 
 * Edits an existing campaign.
 */
export async function PUT(request: NextRequest) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { shop_id, campaign_id, campaign_type, edit_action, ...updateData } = body

        if (!shop_id || !campaign_id || !edit_action) {
            return NextResponse.json({
                error: 'shop_id, campaign_id, and edit_action are required'
            }, { status: 400 })
        }

        // Verify shop belongs to user
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
        const referenceId = `edit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        let result
        if (campaign_type === 'auto') {
            result = await sdk.ads.editAutoProductAds({
                reference_id: referenceId,
                campaign_id,
                edit_action,
                budget: updateData.budget,
                start_date: updateData.start_date,
                end_date: updateData.end_date
            })
        } else if (campaign_type === 'manual') {
            result = await sdk.ads.editManualProductAds({
                reference_id: referenceId,
                campaign_id,
                edit_action,
                budget: updateData.budget,
                start_date: updateData.start_date,
                end_date: updateData.end_date,
                roas_target: updateData.roas_target,
                discovery_ads_locations: updateData.discovery_ads_locations,
                enhanced_cpc: updateData.enhanced_cpc,
                smart_creative_setting: updateData.smart_creative_setting
            })
        } else {
            return NextResponse.json({ error: 'Invalid campaign_type' }, { status: 400 })
        }

        return NextResponse.json({
            success: true,
            campaign_id: result.response?.campaign_id
        })
    } catch (error) {
        console.error('Edit campaign error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
