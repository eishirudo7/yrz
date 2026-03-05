import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/db';
import { items } from '@/db/schema';
import { inArray } from 'drizzle-orm';

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const shopIdsParam = searchParams.get('shopIds');

        if (!shopIdsParam) {
            return NextResponse.json({ success: true, data: [] });
        }

        const shopIds = shopIdsParam.split(',').map(Number).filter(id => !isNaN(id));

        // Validate if user has access to these shops
        // We already fetch shops from server side, but keeping queries simple here

        if (shopIds.length === 0) {
            return NextResponse.json({ success: true, data: [] });
        }

        // Fetch items belonging to those shops
        const dbItems = await db.select()
            .from(items)
            .where(inArray(items.shopId, shopIds));

        // Map the camelCase Drizzle output back to the snake_case expected by the frontend
        const mappedItems = dbItems.map(item => ({
            item_id: item.itemId,
            shop_id: item.shopId,
            category_id: item.categoryId,
            item_name: item.itemName,
            description: item.description,
            item_sku: item.itemSku,
            create_time: item.createTime,
            update_time: item.updateTime,
            weight: item.weight,
            image: item.image,
            logistic_info: item.logisticInfo,
            pre_order: item.preOrder,
            condition: item.condition,
            item_status: item.itemStatus,
            has_model: item.hasModel,
            brand: item.brand,
            item_dangerous: item.itemDangerous,
            description_type: item.descriptionType,
            size_chart_id: item.sizeChartId,
            promotion_image: item.promotionImage,
            deboost: item.deboost === true ? "TRUE" : "FALSE", // Frontend might expect string based on insert logic
            authorised_brand_id: item.authorisedBrandId,
            created_at: item.createdAt,
            updated_at: item.updatedAt
        }));

        return NextResponse.json({
            success: true,
            data: mappedItems
        });
    } catch (error) {
        console.error('Error in /api/data/items:', error);
        return NextResponse.json({
            success: false,
            message: 'Failed to fetch items',
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
