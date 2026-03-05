import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { db } from '@/db'
import { items } from '@/db/schema'
import { inArray } from 'drizzle-orm'

export async function POST(request: Request) {
    try {
        const { item_ids } = await request.json()

        if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
            return NextResponse.json({ products: {} })
        }

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Query from 'items' table (migrasi uses 'items' instead of 'products')
        let fetchedItems: any[] = [];
        try {
            fetchedItems = await db.select({
                item_id: items.itemId,
                item_name: items.itemName,
                item_sku: items.itemSku,
                image: items.image
            })
                .from(items)
                .where(inArray(items.itemId, item_ids));
        } catch (error) {
            console.error('Failed to fetch items by item_ids rendering empty:', error)
            return NextResponse.json({ products: {} })
        }

        // Return as a map: { item_id: { image_url, item_sku, item_name, current_price } }
        const productMap: Record<number, { image_url: string | null; item_sku: string | null; item_name: string | null; current_price: number | null }> = {}
        for (const p of fetchedItems || []) {
            // image is JSONB - extract first image URL from image_url_list
            let imageUrl: string | null = null
            if (p.image) {
                const imageData = typeof p.image === 'string' ? JSON.parse(p.image) : p.image
                if (imageData?.image_url_list?.length > 0) {
                    imageUrl = imageData.image_url_list[0]
                }
            }

            productMap[p.item_id] = {
                image_url: imageUrl,
                item_sku: p.item_sku,
                item_name: p.item_name,
                current_price: null, // price is in item_models table, not critical for thumbnails
            }
        }

        return NextResponse.json({ products: productMap })
    } catch (error) {
        console.error('Products by item_ids API error:', error)
        return NextResponse.json({ products: {} })
    }
}
