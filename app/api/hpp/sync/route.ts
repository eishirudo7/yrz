import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getModelList } from '@/app/services/shopee/products';
import { db } from '@/db';
import { hppMaster } from '@/db/schema';

/**
 * POST /api/hpp/sync
 * Sync SKU variations from Shopee API into hpp_master table.
 * 
 * Input: { skus: [{ sku: string, shop_id: number, item_id: number }] }
 * 
 * For each SKU: calls getModelList → extracts unique tier1 variations → upserts into hpp_master.
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ success: false, message: 'Tidak terautentikasi' }, { status: 401 });
        }

        const body = await req.json();
        const { skus } = body as { skus: { sku: string, shop_id: number, item_id: number }[] };

        if (!skus || !Array.isArray(skus) || skus.length === 0) {
            return NextResponse.json({ success: false, message: 'Parameter skus diperlukan' }, { status: 400 });
        }

        let totalInserted = 0;
        const errors: string[] = [];

        // Process each SKU
        for (const { sku, shop_id, item_id } of skus) {
            try {
                // Call Shopee API to get all models/variations for this item
                const result = await getModelList(shop_id, item_id);

                if (!result.success || !result.data?.model) {
                    errors.push(`Gagal ambil model untuk SKU ${sku} (item_id: ${item_id}): ${result.message || 'Tidak ada data model'}`);
                    continue;
                }

                const models = result.data.model;

                // Extract unique tier1 variations from model names
                const tier1Set = new Set<string>();
                for (const model of models) {
                    if (model.model_name) {
                        // model_name format: "TIER1,TIER2" e.g. "KEBAYA+ROK (BURGUNDY),XL"
                        const tier1 = model.model_name.split(',')[0].trim();
                        if (tier1) {
                            tier1Set.add(tier1);
                        }
                    }
                }

                if (tier1Set.size === 0) {
                    continue;
                }

                // Upsert each unique tier1 into hpp_master
                const rows = Array.from(tier1Set).map(tier1 => ({
                    userId: user.id,
                    itemSku: sku,
                    tier1Variation: tier1,
                }));

                try {
                    await db.insert(hppMaster).values(rows).onConflictDoNothing({
                        target: [hppMaster.userId, hppMaster.itemSku, hppMaster.tier1Variation]
                    });
                    totalInserted += tier1Set.size;
                } catch (upsertError) {
                    // Fallback: insert one by one, skipping duplicates
                    for (const row of rows) {
                        try {
                            await db.insert(hppMaster).values(row).onConflictDoNothing({
                                target: [hppMaster.userId, hppMaster.itemSku, hppMaster.tier1Variation]
                            });
                            totalInserted++;
                        } catch (insertError) {
                            // Ignore duplicate errors silently
                        }
                    }
                }
            } catch (err) {
                errors.push(`Error processing SKU ${sku}: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
        }

        return NextResponse.json({
            success: true,
            inserted: totalInserted,
            errors: errors.length > 0 ? errors : undefined,
            message: `${totalInserted} variasi berhasil disinkronkan${errors.length > 0 ? `, ${errors.length} error` : ''}`,
        });
    } catch (error) {
        console.error('Error in hpp sync:', error);
        return NextResponse.json({
            success: false,
            message: error instanceof Error ? error.message : 'Terjadi kesalahan',
        }, { status: 500 });
    }
}
