import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/db';
import { eq, or, ilike, inArray, and } from 'drizzle-orm';
import { hppMaster } from '@/db/schema'; // Ensure this exists

export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const searchTerm = searchParams.get('q');

        // Fetch from db
        let query = db.select().from(hppMaster).where(eq(hppMaster.userId, user.id));

        if (searchTerm) {
            query = db.select().from(hppMaster).where(
                and(
                    eq(hppMaster.userId, user.id),
                    or(
                        ilike(hppMaster.itemSku, `%${searchTerm}%`),
                        ilike(hppMaster.tier1Variation, `%${searchTerm}%`)
                    )
                )
            );
        }

        // Drizzle currently limits simple .orderBy with complex conditionals unless using dynamic queries,
        // so let's just fetch all and sort in memory if needed, or rely on the frontend which does its own sorting/grouping anyway.
        const hppData = await query;

        // Drizzle returns camelCase but frontend expects snake_case for some fields, map them
        const formattedData = hppData.map(item => ({
            id: item.id,
            user_id: item.userId,
            item_sku: item.itemSku,
            tier1_variation: item.tier1Variation,
            cost_price: item.costPrice ? parseFloat(item.costPrice.toString()) : null,
            canonical_sku: item.canonicalSku,
            created_at: item.createdAt,
            updated_at: item.updatedAt
        }));

        // Sort by item_sku then tier1_variation to match original Supabase behavior
        formattedData.sort((a, b) => {
            const skuA = a.item_sku || '';
            const skuB = b.item_sku || '';
            if (skuA < skuB) return -1;
            if (skuA > skuB) return 1;
            const t1A = a.tier1_variation || '';
            const t1B = b.tier1_variation || '';
            if (t1A < t1B) return -1;
            if (t1A > t1B) return 1;
            return 0;
        });

        return NextResponse.json({ success: true, data: formattedData });
    } catch (error: any) {
        console.error('Error fetching HPP data:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const items = body.items as { id: number, cost_price?: number | null, canonical_sku?: string | null }[];

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ success: false, message: 'Invalid payload' }, { status: 400 });
        }

        // Process updates
        // For bulk updates where many items get the same value, we could optimize,
        // but Drizzle doesn't have a native bulk UPDATE with different values per row easily without raw SQL.
        // For now, we perform individual updates in a transaction or sequentially.
        await db.transaction(async (tx) => {
            for (const item of items) {
                const updateData: any = { updatedAt: new Date() };
                if (item.cost_price !== undefined) updateData.costPrice = item.cost_price ? item.cost_price.toString() : null;
                if (item.canonical_sku !== undefined) updateData.canonicalSku = item.canonical_sku;

                await tx.update(hppMaster)
                    .set(updateData)
                    .where(and(eq(hppMaster.id, item.id), eq(hppMaster.userId, user.id)));
            }
        });

        return NextResponse.json({ success: true, message: `${items.length} items updated` });
    } catch (error: any) {
        console.error('Error updating HPP data:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const items = body.items as { sku: string, tier1: string, cost_price: number }[];

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ success: false, message: 'Invalid payload' }, { status: 400 });
        }

        let saved = 0;
        await db.transaction(async (tx) => {
            for (const item of items) {
                const values = {
                    userId: user.id,
                    itemSku: item.sku,
                    tier1Variation: item.tier1 || '',
                    costPrice: item.cost_price.toString(),
                    updatedAt: new Date()
                };

                await tx.insert(hppMaster)
                    .values(values)
                    .onConflictDoUpdate({
                        target: [hppMaster.userId, hppMaster.itemSku, hppMaster.tier1Variation],
                        set: {
                            costPrice: values.costPrice,
                            updatedAt: values.updatedAt
                        }
                    });
                saved++;
            }
        });

        return NextResponse.json({ success: true, saved, message: `${saved} items saved` });
    } catch (error: any) {
        console.error('Error saving HPP data:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
