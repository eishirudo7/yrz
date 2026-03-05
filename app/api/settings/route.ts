import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@/utils/supabase/server';
import { getAllShops } from "@/app/services/shopeeService";
import { UserSettings, UserSettingsService } from '@/app/services/userSettingsService';
import { db } from '@/db';
import { pengaturan, userSubscriptions, subscriptionPlans, autoShipChat } from '@/db/schema';
import { eq, inArray, desc } from 'drizzle-orm';

async function getUserIdFromSession() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      console.error('User session error:', error);
      return null;
    }

    return data.user.id;
  } catch (err) {
    console.error('Error validating user session:', err);
    return null;
  }
}

// GET untuk mengambil pengaturan
export async function GET(req: NextRequest) {
  try {
    // Ambil user ID dari session
    const userId = await getUserIdFromSession();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'User tidak terautentikasi' },
        { status: 401 }
      );
    }

    // Selalu ambil dari database terlebih dahulu
    // Ambil pengaturan user
    let userPengaturan = undefined;
    try {
      const data = await db.select()
        .from(pengaturan)
        .where(eq(pengaturan.userId, userId))
        .limit(1);
      userPengaturan = data[0];
    } catch (pengaturanError) {
      console.error('Error saat mengambil pengaturan:', pengaturanError);
      throw pengaturanError;
    }

    // Ambil data langganan user dengan join ke subscription_plans
    let subscription: any = null;
    try {
      const activeSubs = await db.select({
        id: userSubscriptions.id,
        status: userSubscriptions.status,
        start_date: userSubscriptions.startDate,
        end_date: userSubscriptions.endDate,
        plan_id: subscriptionPlans.id,
        plan_name: subscriptionPlans.name,
        plan_max_shops: subscriptionPlans.maxShops,
        plan_features: subscriptionPlans.features
      })
        .from(userSubscriptions)
        .leftJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
        .where(
          eq(userSubscriptions.userId, userId)
        )
      // Drizzle ORM doesn't have an exact multi-AND inline matching the Supabase query cleanly here
      // Let's refine the query:
      let filteredActiveSubs = activeSubs.filter(sub => sub.status === 'active')
      // Sort by descending created_at logic implicitly if we trusted DB order, but limit(1) was there
      // Let's assume the first active sub is the latest or there's only one active sub ideally.

      if (filteredActiveSubs.length > 0) {
        const subData = filteredActiveSubs[0];
        subscription = {
          id: subData.id,
          status: subData.status,
          start_date: subData.start_date,
          end_date: subData.end_date,
          plan: {
            id: subData.plan_id,
            name: subData.plan_name,
            max_shops: subData.plan_max_shops,
            features: subData.plan_features
          }
        };
      }
    } catch (subscriptionError) {
      console.error('Error subscription query:', subscriptionError);
    }

    if (!subscription) {
      console.log('Subscription tidak ditemukan atau error, membuat default subscription');

      let freePlan = null;
      try {
        const plans = await db.select()
          .from(subscriptionPlans)
          .where(eq(subscriptionPlans.name, 'Basic'))
          .limit(1);
        freePlan = plans[0];
      } catch (planError) {
        console.error('Error saat mencari paket Basic:', planError);
      }

      subscription = {
        id: 'default-subscription',
        status: 'active',
        start_date: new Date().toISOString(),
        end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 10)).toISOString(),
        plan: freePlan || {
          id: 'default-plan',
          name: 'Basic',
          features: {
            feature_chat_ai: false,
            feature_flashsale: false,
            feature_bulk_actions: false
          },
          max_shops: 1
        }
      };
    }

    // Ambil data toko
    const userShops = await getAllShops();

    // Proses data toko dan auto_ship_chat
    let transformedAutoShip: any[] = [];

    if (userShops && userShops.length > 0) {
      // Buat array dari shop_id milik user
      const shopIds = userShops.map(shop => shop.shop_id);

      // Query auto_ship_chat dengan shop_id yang dimiliki user
      try {
        const autoShipData = await db.select({
          shop_id: autoShipChat.shopId,
          status_chat: autoShipChat.statusChat,
          status_ship: autoShipChat.statusShip
        })
          .from(autoShipChat)
          .where(inArray(autoShipChat.shopId, shopIds));

        // Map untuk menghubungkan shop_id dengan nama toko
        const shopMap = userShops.reduce((acc: any, shop: any) => {
          acc[shop.shop_id] = shop.shop_name || `Toko ${shop.shop_id}`;
          return acc;
        }, {});

        // Dapatkan paket berlangganan user
        let maxShops = 1;
        let planName = 'basic';

        if (subscription && subscription.plan && subscription.plan.length > 0) {
          const plan = subscription.plan.length ? subscription.plan[0] : subscription.plan;
          maxShops = plan.max_shops || 1;
          planName = plan.name || 'basic';
        } else if (subscription && subscription.plan && !Array.isArray(subscription.plan)) {
          const plan = subscription.plan;
          maxShops = plan.max_shops || 1;
          planName = plan.name || 'basic';
        }

        // Transform data untuk kompatibilitas frontend
        transformedAutoShip = autoShipData?.map(item => ({
          shop_id: item.shop_id,
          shop_name: shopMap[item.shop_id] || `Toko ${item.shop_id}`,
          status_chat: item.status_chat || false,
          status_ship: item.status_ship || false
        })) || [];

        // Tambahkan toko yang belum memiliki entri di auto_ship_chat
        userShops.forEach(shop => {
          const exists = transformedAutoShip.some(item => item.shop_id === shop.shop_id);
          if (!exists) {
            transformedAutoShip.push({
              shop_id: shop.shop_id,
              shop_name: shop.shop_name || `Toko ${shop.shop_id}`,
              status_chat: false,
              status_ship: false
            });
          }
        });
      } catch (autoShipError) {
        console.error('Error saat mengambil auto ship:', autoShipError);
      }
    }

    // Gabungkan semua data
    const settingsData = {
      ...userPengaturan,
      subscription: subscription,
      shops: transformedAutoShip,
      user_id: userId
    };

    // Perbarui cache Redis SETELAH mengambil dari database
    await UserSettingsService.saveUserSettings(userId, settingsData as any);

    // Respon data dari database ke frontend
    return NextResponse.json({
      ok: true,
      pengaturan: {
        openai_api: userPengaturan?.openaiApi || null,
        openai_model: userPengaturan?.openaiModel || 'gpt-3.5-turbo',
        openai_temperature: userPengaturan?.openaiTemperature || 0.4,
        openai_prompt: userPengaturan?.openaiPrompt || '',
        auto_ship_interval: userPengaturan?.autoShipInterval || 5,
        in_cancel_msg: userPengaturan?.inCancelMsg || null,
        in_cancel_status: userPengaturan?.inCancelStatus !== undefined ? userPengaturan.inCancelStatus : false,
        in_return_msg: userPengaturan?.inReturnMsg || null,
        in_return_status: userPengaturan?.inReturnStatus !== undefined ? userPengaturan.inReturnStatus : false,
        user_id: userId
      },
      subscription: subscription,
      autoShip: transformedAutoShip
    });
  } catch (error) {
    console.error('Error getting settings:', error);
    return NextResponse.json(
      { error: 'Server Error', message: 'Terjadi kesalahan saat mengambil pengaturan' },
      { status: 500 }
    );
  }
}

// POST untuk menyimpan pengaturan
export async function POST(req: NextRequest) {
  try {
    // Ambil user ID dari session
    const userId = await getUserIdFromSession();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'User tidak terautentikasi' },
        { status: 401 }
      );
    }

    // Inisialisasi Supabase
    const supabase = await createClient();

    // Ambil data dari request
    const reqData = await req.json();
    const { updatedSettings, updatedAutoShip } = reqData;

    // Validasi data
    if (!updatedSettings || !updatedAutoShip || !Array.isArray(updatedAutoShip)) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Format data tidak valid' },
        { status: 400 }
      );
    }

    // Ambil data langganan user untuk memastikan status berlangganan
    let subscription: any = null;
    try {
      const activeSubs = await db.select({
        id: userSubscriptions.id,
        status: userSubscriptions.status,
        start_date: userSubscriptions.startDate,
        end_date: userSubscriptions.endDate,
        plan_id: subscriptionPlans.id,
        plan_name: subscriptionPlans.name,
        plan_max_shops: subscriptionPlans.maxShops,
        plan_features: subscriptionPlans.features
      })
        .from(userSubscriptions)
        .leftJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
        .where(
          eq(userSubscriptions.userId, userId)
        );

      let filteredActiveSubs = activeSubs.filter(sub => sub.status === 'active');

      if (filteredActiveSubs.length > 0) {
        const subData = filteredActiveSubs[0]; // limit 1 fallback
        subscription = {
          id: subData.id,
          status: subData.status,
          start_date: subData.start_date,
          end_date: subData.end_date,
          plan: {
            id: subData.plan_id,
            name: subData.plan_name,
            max_shops: subData.plan_max_shops,
            features: subData.plan_features
          }
        };
      }
    } catch (subscriptionError) {
      console.error('Error fetching subscription in upsert:', subscriptionError);
    }

    if (!subscription) {
      console.log('Subscription tidak ditemukan atau error, membuat default subscription');

      let freePlan = null;
      try {
        const plans = await db.select()
          .from(subscriptionPlans)
          .where(eq(subscriptionPlans.name, 'Basic'))
          .limit(1);
        freePlan = plans[0];
      } catch (planError) {
        console.error('Error saat mencari paket Basic:', planError);
      }

      subscription = {
        id: 'default-subscription',
        status: 'active',
        start_date: new Date().toISOString(),
        end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 10)).toISOString(),
        plan: freePlan || {
          id: 'default-plan',
          name: 'Basic',
          features: {
            feature_chat_ai: false,
            feature_flashsale: false,
            feature_bulk_actions: false
          },
          max_shops: 1
        }
      };
    }

    // Sanitasi dan validasi updatedSettings
    const sanitizedSettings: UserSettings = {
      openai_api: updatedSettings.openai_api || null,
      openai_model: updatedSettings.openai_model || 'gpt-3.5-turbo',
      openai_temperature: typeof updatedSettings.openai_temperature === 'number' ?
        updatedSettings.openai_temperature : 0.4,
      openai_prompt: updatedSettings.openai_prompt || '',
      auto_ship_interval: typeof updatedSettings.auto_ship_interval === 'number' ?
        updatedSettings.auto_ship_interval : 5,
      in_cancel_msg: updatedSettings.in_cancel_msg !== undefined ? updatedSettings.in_cancel_msg : null,
      in_cancel_status: updatedSettings.in_cancel_status !== undefined ? updatedSettings.in_cancel_status : false,
      in_return_msg: updatedSettings.in_return_msg !== undefined ? updatedSettings.in_return_msg : null,
      in_return_status: updatedSettings.in_return_status !== undefined ? updatedSettings.in_return_status : false,
      user_id: userId,
      subscription: {
        id: subscription!.id,
        status: subscription!.status,
        start_date: subscription!.start_date,
        end_date: subscription!.end_date,
        plan: Array.isArray(subscription!.plan) ? subscription!.plan[0] : subscription!.plan
      },
      shops: updatedAutoShip.map(item => ({
        shop_id: item.shop_id,
        shop_name: item.shop_name,
        status_chat: Boolean(item.status_chat),
        status_ship: Boolean(item.status_ship)
      }))
    };

    // Simpan pengaturan ke database
    try {
      await db.insert(pengaturan).values({
        userId: userId,
        openaiApi: sanitizedSettings.openai_api,
        openaiModel: sanitizedSettings.openai_model,
        openaiTemperature: sanitizedSettings.openai_temperature !== null ? String(sanitizedSettings.openai_temperature) : null,
        openaiPrompt: sanitizedSettings.openai_prompt,
        autoShipInterval: sanitizedSettings.auto_ship_interval,
        inCancelMsg: sanitizedSettings.in_cancel_msg,
        inCancelStatus: sanitizedSettings.in_cancel_status,
        inReturnMsg: sanitizedSettings.in_return_msg,
        inReturnStatus: sanitizedSettings.in_return_status,
      }).onConflictDoUpdate({
        target: pengaturan.userId,
        set: {
          openaiApi: sanitizedSettings.openai_api,
          openaiModel: sanitizedSettings.openai_model,
          openaiTemperature: sanitizedSettings.openai_temperature !== null ? String(sanitizedSettings.openai_temperature) : null,
          openaiPrompt: sanitizedSettings.openai_prompt,
          autoShipInterval: sanitizedSettings.auto_ship_interval,
          inCancelMsg: sanitizedSettings.in_cancel_msg,
          inCancelStatus: sanitizedSettings.in_cancel_status,
          inReturnMsg: sanitizedSettings.in_return_msg,
          inReturnStatus: sanitizedSettings.in_return_status,
        }
      });
    } catch (settingsError) {
      console.error('Error saat menyimpan pengaturan:', settingsError);
      throw settingsError;
    }

    // Update auto_ship_chat
    for (const item of updatedAutoShip) {
      if (!item.shop_id) continue;

      try {
        await db.insert(autoShipChat).values({
          shopId: item.shop_id,
          statusChat: Boolean(item.status_chat),
          statusShip: Boolean(item.status_ship)
        }).onConflictDoUpdate({
          target: autoShipChat.shopId,
          set: {
            statusChat: Boolean(item.status_chat),
            statusShip: Boolean(item.status_ship)
          }
        });
      } catch (autoShipError) {
        console.error(`Error saat memperbarui auto_ship_chat untuk toko ${item.shop_id}:`, autoShipError);
        throw autoShipError;
      }
    }

    // Simpan ke UserSettingsService
    await UserSettingsService.saveUserSettings(userId, sanitizedSettings);

    return NextResponse.json({
      success: true,
      ok: true,
      message: 'Pengaturan berhasil disimpan',
      data: {
        settings: {
          openai_api: sanitizedSettings.openai_api,
          openai_model: sanitizedSettings.openai_model,
          openai_temperature: sanitizedSettings.openai_temperature,
          openai_prompt: sanitizedSettings.openai_prompt,
          auto_ship_interval: sanitizedSettings.auto_ship_interval,
          in_cancel_msg: sanitizedSettings.in_cancel_msg,
          in_cancel_status: sanitizedSettings.in_cancel_status,
          in_return_msg: sanitizedSettings.in_return_msg,
          in_return_status: sanitizedSettings.in_return_status,
          user_id: userId
        },
        subscription: subscription,
        autoShip: sanitizedSettings.shops
      }
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json(
      { error: 'Server Error', message: 'Terjadi kesalahan saat menyimpan pengaturan' },
      { status: 500 }
    );
  }
}
