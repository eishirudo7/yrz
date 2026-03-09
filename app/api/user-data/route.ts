import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
    try {
        const supabase = await createClient();

        // 1. Get authenticated user
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json(
                { success: false, message: 'Tidak terautentikasi' },
                { status: 401 }
            );
        }

        // 2. Get user's active shops (shopee_tokens)
        const { data: shopData, error: shopError } = await supabase
            .from('shopee_tokens')
            .select('id, shop_id, shop_name, is_active')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (shopError) {
            console.error('Error fetching shopee_tokens:', shopError);
            return NextResponse.json(
                { success: false, message: 'Gagal mengambil data toko', error: shopError.message },
                { status: 500 }
            );
        }

        // 3. Get user's active subscription
        const { data: subscriptionData, error: subscriptionError } = await supabase
            .from('user_subscriptions')
            .select(`
        id, 
        plan_id, 
        status, 
        start_date, 
        end_date,
        subscription_plans (
          id,
          name,
          max_shops,
          features
        )
      `)
            .eq('user_id', user.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        let formattedSubscription = null;

        if (subscriptionData && !subscriptionError) {
            const isExpired = new Date(subscriptionData.end_date) < new Date();

            if (isExpired) {
                // Update status di database menjadi expired karena sudah melewati batas waktu
                console.log(`Langganan ${subscriptionData.id} kedaluwarsa. Mengubah status ke expired.`);
                await supabase
                    .from('user_subscriptions')
                    .update({ status: 'expired' })
                    .eq('id', subscriptionData.id);

                formattedSubscription = null;
            } else {
                const planData = Array.isArray(subscriptionData.subscription_plans)
                    ? subscriptionData.subscription_plans[0]
                    : subscriptionData.subscription_plans;

                if (planData) {
                    formattedSubscription = {
                        id: subscriptionData.id,
                        plan_id: subscriptionData.plan_id,
                        plan_name: planData.name,
                        status: subscriptionData.status,
                        start_date: subscriptionData.start_date,
                        end_date: subscriptionData.end_date,
                        max_shops: planData.max_shops,
                        features: planData.features || []
                    };
                }
            }
        } else if (subscriptionError && subscriptionError.code !== 'PGRST116') {
            // Ignore PGRST116 (No rows found), log other errors
            console.error('Error fetching subscription:', subscriptionError);
        }

        return NextResponse.json({
            success: true,
            userId: user.id,
            shops: shopData || [],
            subscription: formattedSubscription
        });

    } catch (error) {
        console.error('Unexpected error in /api/user-data:', error);
        return NextResponse.json(
            { success: false, message: 'Terjadi kesalahan internal', error: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        );
    }
}
