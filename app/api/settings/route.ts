import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@/utils/supabase/server';
import { getAllShops } from "@/app/services/shopeeService";
import { UserSettingsService } from '@/app/services/userSettingsService';

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
    const supabase = await createClient();
      
    // Ambil pengaturan user
    const { data: pengaturan, error: pengaturanError } = await supabase
      .from('pengaturan')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (pengaturanError && pengaturanError.code !== 'PGRST116') {
      console.error('Error saat mengambil pengaturan:', pengaturanError);
      throw pengaturanError;
    }

    // Ambil data langganan user
    let { data: subscription, error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .select(`
        id, 
        status, 
        start_date, 
        end_date,
        plan:subscription_plans(id, name, max_shops, features)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (subscriptionError || !subscription) {
      console.log('Subscription tidak ditemukan atau error, membuat default subscription');
      
      const { data: freePlan, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('name', 'Basic')
        .single();
      
      if (planError) {
        console.error('Error saat mencari paket Basic:', planError);
      }
      
      subscription = {
        id: 'default-subscription',
        status: 'active',
        start_date: new Date().toISOString(),
        end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 10)).toISOString(),
        plan: [{
          id: freePlan?.id || 'default-plan',
          name: 'Basic',
          max_shops: freePlan?.max_shops || 1,
          features: freePlan?.features || {}
        }]
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
      const { data: autoShip, error: autoShipError } = await supabase
        .from('auto_ship_chat')
        .select('*')
        .in('shop_id', shopIds);
      
      if (autoShipError) {
        console.error('Error saat mengambil auto ship:', autoShipError);
      } else {
        // Map untuk menghubungkan shop_id dengan nama toko
        const shopMap = userShops.reduce((acc, shop) => {
          acc[shop.shop_id] = shop.shop_name || `Toko ${shop.shop_id}`;
          return acc;
        }, {});
        
        // Dapatkan paket berlangganan user
        let maxShops = 1;
        let planName = 'basic';
        
        if (subscription && subscription.plan && subscription.plan.length > 0) {
          const plan = subscription.plan[0];
          maxShops = plan.max_shops || 1;
          planName = plan.name || 'basic';
        }
        
        // Transform data untuk kompatibilitas frontend
        transformedAutoShip = autoShip?.map(item => ({
          shop_id: item.shop_id,
          shop_name: shopMap[item.shop_id] || `Toko ${item.shop_id}`,
          status_chat: item.status_chat || false,
          status_ship: item.status_ship || false,
          premium_plan: planName.toLowerCase()
        })) || [];
        
        // Tambahkan toko yang belum memiliki entri di auto_ship_chat
        userShops.forEach(shop => {
          const exists = transformedAutoShip.some(item => item.shop_id === shop.shop_id);
          if (!exists) {
            transformedAutoShip.push({
              shop_id: shop.shop_id,
              shop_name: shop.shop_name || `Toko ${shop.shop_id}`,
              status_chat: false,
              status_ship: false,
              premium_plan: planName.toLowerCase()
            });
          }
        });
      }
    }
    
    // Gabungkan semua data
    const settingsData = {
      ...pengaturan,
      subscription: subscription,
      shops: transformedAutoShip,
      user_id: userId
    };
    
    // Perbarui cache Redis SETELAH mengambil dari database
    await UserSettingsService.saveUserSettings(userId, settingsData);
    
    // Respon data dari database ke frontend
    return NextResponse.json({
      ok: true,
      pengaturan: {
        openai_api: pengaturan?.openai_api || null,
        openai_model: pengaturan?.openai_model || 'gpt-3.5-turbo',
        openai_temperature: pengaturan?.openai_temperature || 0.4,
        openai_prompt: pengaturan?.openai_prompt || '',
        auto_ship: pengaturan?.auto_ship !== undefined ? pengaturan.auto_ship : true,
        auto_ship_interval: pengaturan?.auto_ship_interval || 5,
        in_cancel_msg: pengaturan?.in_cancel_msg || null,
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
    let { data: subscription, error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .select(`
        id, 
        status, 
        start_date, 
        end_date,
        plan:subscription_plans(id, name, max_shops, features)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (subscriptionError || !subscription) {
      console.log('Subscription tidak ditemukan atau error, membuat default subscription');
      
      const { data: freePlan, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('name', 'Basic')
        .single();
      
      if (planError) {
        console.error('Error saat mencari paket Basic:', planError);
      }
      
      subscription = {
        id: 'default-subscription',
        status: 'active',
        start_date: new Date().toISOString(),
        end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 10)).toISOString(),
        plan: [{
          id: freePlan?.id || 'default-plan',
          name: 'Basic',
          max_shops: freePlan?.max_shops || 1,
          features: freePlan?.features || {}
        }]
      };
    }

    // Dapatkan paket berlangganan user
    let maxShops = 1;
    let planName = 'basic';
    
    if (subscription && subscription.plan && subscription.plan.length > 0) {
      const plan = subscription.plan[0];
      maxShops = plan.max_shops || 1;
      planName = plan.name || 'basic';
    }

    // Sanitasi dan validasi updatedSettings
    const sanitizedSettings = {
      openai_api: updatedSettings.openai_api || null,
      openai_model: updatedSettings.openai_model || 'gpt-3.5-turbo',
      openai_temperature: typeof updatedSettings.openai_temperature === 'number' ? 
        updatedSettings.openai_temperature : 0.4,
      openai_prompt: updatedSettings.openai_prompt || '',
      auto_ship: typeof updatedSettings.auto_ship === 'boolean' ? 
        updatedSettings.auto_ship : true,
      auto_ship_interval: typeof updatedSettings.auto_ship_interval === 'number' ? 
        updatedSettings.auto_ship_interval : 5,
      in_cancel_msg: updatedSettings.in_cancel_msg !== undefined ? updatedSettings.in_cancel_msg : null,
      user_id: userId,
      subscription: subscription,
      shops: updatedAutoShip.map(item => ({
        shop_id: item.shop_id,
        shop_name: item.shop_name,
        status_chat: Boolean(item.status_chat),
        status_ship: Boolean(item.status_ship),
        premium_plan: subscription?.plan?.[0]?.name?.toLowerCase() || 'basic'
      }))
    };

    // Simpan pengaturan ke database
    const { error: settingsError } = await supabase
      .from('pengaturan')
      .upsert({
        openai_api: sanitizedSettings.openai_api,
        openai_model: sanitizedSettings.openai_model,
        openai_temperature: sanitizedSettings.openai_temperature,
        openai_prompt: sanitizedSettings.openai_prompt,
        auto_ship: sanitizedSettings.auto_ship,
        auto_ship_interval: sanitizedSettings.auto_ship_interval,
        in_cancel_msg: sanitizedSettings.in_cancel_msg,
        user_id: userId
      }, {
        onConflict: 'user_id'
      });

    if (settingsError) {
      console.error('Error saat menyimpan pengaturan:', settingsError);
      throw settingsError;
    }

    // Update auto_ship_chat
    for (const item of updatedAutoShip) {
      if (!item.shop_id) continue;

      const autoShipData = {
        shop_id: item.shop_id,
        status_chat: Boolean(item.status_chat),
        status_ship: Boolean(item.status_ship)
      };

      const { error: autoShipError } = await supabase
        .from('auto_ship_chat')
        .upsert(autoShipData, {
          onConflict: 'shop_id'
        });

      if (autoShipError) {
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
          auto_ship: sanitizedSettings.auto_ship,
          auto_ship_interval: sanitizedSettings.auto_ship_interval,
          in_cancel_msg: sanitizedSettings.in_cancel_msg,
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

// Mengexport fungsi getUserIdFromShopId jika diperlukan
export const getUserIdFromShopId = UserSettingsService.getUserIdFromShopId.bind(UserSettingsService);