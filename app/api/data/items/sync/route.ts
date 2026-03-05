import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { items as itemsSchema, itemModels as itemModelsSchema, itemVariations as itemVariationsSchema } from "@/db/schema/supporting";
import { eq } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { shopId, items } = await req.json();

        if (!shopId || !items || !Array.isArray(items)) {
            return NextResponse.json({ success: false, message: 'Invalid data format' }, { status: 400 });
        }

        try {
            // We will perform upsert operations using Drizzle's ON CONFLICT DO UPDATE
            for (const item of items) {

                const itemValues = {
                    itemId: item.item_id,
                    shopId: shopId,
                    categoryId: item.category_id,
                    itemName: item.item_name,
                    description: item.description,
                    itemSku: item.item_sku,
                    createTime: item.create_time,
                    updateTime: item.update_time,
                    weight: item.weight != null ? String(item.weight) : null,
                    image: item.image,
                    logisticInfo: item.logistic_info,
                    preOrder: item.pre_order,
                    condition: item.condition,
                    itemStatus: item.item_status,
                    hasModel: item.has_model,
                    brand: item.brand,
                    itemDangerous: item.item_dangerous,
                    descriptionType: item.description_type,
                    sizeChartId: item.size_chart_id,
                    promotionImage: item.promotion_image,
                    deboost: item.deboost === 'FALSE' ? false : true,
                    authorisedBrandId: item.authorised_brand_id
                };

                await db.insert(itemsSchema).values(itemValues).onConflictDoUpdate({
                    target: itemsSchema.itemId,
                    set: itemValues
                });

                // Insert/Update Models
                if (item.models && item.models.length > 0) {
                    for (const model of item.models) {
                        const modelValues = {
                            itemId: item.item_id,
                            modelId: model.model_id,
                            modelName: model.model_name || '',
                            currentPrice: model.price_info?.current_price ? String(model.price_info.current_price) : '0',
                            originalPrice: model.price_info?.original_price ? String(model.price_info.original_price) : '0',
                            stockInfo: model.stock_info || {},
                            modelStatus: model.model_status || ''
                        };

                        await db.insert(itemModelsSchema).values(modelValues).onConflictDoUpdate({
                            // item_models has a unique composite constraint
                            target: [itemModelsSchema.itemId, itemModelsSchema.modelId],
                            set: modelValues
                        });
                    }
                }

                // Insert/Update Variations
                if (item.variations && Object.keys(item.variations).length > 0 && Array.isArray(item.variations.tier_variation)) {
                    for (const variation of item.variations.tier_variation) {
                        const variationOptionList = variation.option_list.map((opt: any) => ({
                            option: opt.option,
                            image: opt.image
                        }));

                        const variationValues = {
                            itemId: item.item_id,
                            variationId: 1, // Drizzle ORM fallback for generic variation_id logic handling if required
                            variationName: variation.name || '',
                            variationOption: variationOptionList
                        };

                        await db.insert(itemVariationsSchema).values(variationValues).onConflictDoUpdate({
                            target: [itemVariationsSchema.itemId, itemVariationsSchema.variationId],
                            set: variationValues
                        });
                    }
                }
            }

            return NextResponse.json({ success: true, message: 'Sync complete' });
        } catch (dbError) {
            console.error('Error executing Drizzle DB batch sync:', dbError);
            return NextResponse.json({ success: false, message: 'Failed to sync to database' }, { status: 500 });
        }
    } catch (error) {
        console.error('Error fetching API sync route:', error);
        return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
    }
}
