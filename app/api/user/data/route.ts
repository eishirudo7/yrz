import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { shopeeTokens } from "@/db/schema/shopeeTokens";
import { userSubscriptions, subscriptionPlans } from "@/db/schema/supporting";
import { eq, desc, and } from "drizzle-orm";

export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Ambil data toko
        const shops = await db
            .select({
                id: shopeeTokens.id,
                shop_id: shopeeTokens.shopId,
                shop_name: shopeeTokens.shopName,
                is_active: shopeeTokens.isActive,
            })
            .from(shopeeTokens)
            .where(
                and(
                    eq(shopeeTokens.userId, user.id),
                    eq(shopeeTokens.isActive, true)
                )
            )
            .orderBy(desc(shopeeTokens.createdAt));

        // Ambil data subscription
        const subscriptions = await db
            .select({
                id: userSubscriptions.id,
                plan_id: userSubscriptions.planId,
                status: userSubscriptions.status,
                start_date: userSubscriptions.startDate,
                end_date: userSubscriptions.endDate,
                plan: {
                    id: subscriptionPlans.id,
                    name: subscriptionPlans.name,
                    max_shops: subscriptionPlans.maxShops,
                    features: subscriptionPlans.features,
                },
            })
            .from(userSubscriptions)
            .leftJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
            .where(
                and(
                    eq(userSubscriptions.userId, user.id),
                    eq(userSubscriptions.status, 'active')
                )
            )
            .orderBy(desc(userSubscriptions.createdAt))
            .limit(1);

        const subscriptionData = subscriptions.length > 0 ? subscriptions[0] : null;

        let formattedSubscription = null;

        // Lazy Initialization: Jika tidak ada subscription aktif, buat otomatis
        if (!subscriptionData) {
            console.log(`[API /user/data] Tidak ada subscription untuk user ${user.id}. Membuat default (Free Plan)...`);

            try {
                // Cari plan 'Free' atau harga 0
                let freePlan = await db.query.subscriptionPlans.findFirst({
                    where: (plans, { ilike, or, eq }) => or(
                        ilike(plans.name, '%free%'),
                        ilike(plans.name, '%gratis%'),
                        eq(plans.price, '0')
                    ),
                });

                // Jika belum ada plan Free di database, buat dulu
                if (!freePlan) {
                    const [newPlan] = await db.insert(subscriptionPlans).values({
                        name: 'Free Plan',
                        description: 'Default free plan for new users',
                        price: '0',
                        maxShops: 1, // Default 1 toko
                        features: ['Basic Dashboard', '1 Shop Integration'],
                        isActive: true,
                    }).returning();

                    freePlan = newPlan;
                }

                if (freePlan) {
                    // Daftarkan user ke Free Plan ini
                    const [newSubscription] = await db.insert(userSubscriptions).values({
                        userId: user.id,
                        planId: freePlan.id,
                        status: 'active',
                        startDate: new Date(),
                    }).returning();

                    // Set formattedSubscription menggunakan data yang baru dibuat
                    formattedSubscription = {
                        id: newSubscription.id,
                        plan_id: newSubscription.planId,
                        plan_name: freePlan.name,
                        status: newSubscription.status,
                        start_date: newSubscription.startDate,
                        end_date: newSubscription.endDate,
                        max_shops: freePlan.maxShops,
                        features: freePlan.features || [],
                    };

                    console.log(`[API /user/data] Sukses membuat default subscription untuk user ${user.id}`);
                }
            } catch (err) {
                console.error('[API /user/data] Gagal membuat lazy subscription:', err);
            }
        } else if (subscriptionData.plan) {
            formattedSubscription = {
                id: subscriptionData.id,
                plan_id: subscriptionData.plan_id,
                plan_name: subscriptionData.plan.name,
                status: subscriptionData.status,
                start_date: subscriptionData.start_date,
                end_date: subscriptionData.end_date,
                max_shops: subscriptionData.plan.max_shops,
                features: subscriptionData.plan.features || [],
            };
        }

        return NextResponse.json({
            shops,
            subscription: formattedSubscription,
        });
    } catch (error) {
        console.error("Error fetching user data endpoint:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
