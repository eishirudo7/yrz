import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/app/services/redis";
import { createClient } from '@/utils/supabase/server';
import { getAllShops } from "@/app/services/shopeeService";

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

    // Ambil data dari Supabase
    const supabase = await createClient();
    
    // Ambil pengaturan user
    const { data: pengaturan, error: pengaturanError } = await supabase
      .from('pengaturan')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (pengaturanError && pengaturanError.code !== 'PGRST116') { // PGRST116 = tidak ditemukan
      console.error('Error saat mengambil pengaturan:', pengaturanError);
      throw pengaturanError;
    }

    // Ambil data langganan user dari tabel user_subscriptions dan subscription_plans
    const { data: subscription, error: subscriptionError } = await supabase
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
    
    if (subscriptionError && subscriptionError.code !== 'PGRST116') {
      console.error('Error saat mengambil data langganan:', subscriptionError);
      // Lanjutkan meskipun error, treat sebagai free user
    }

    // Mengambil semua toko milik user dari shopee_tokens
    const userShops = await getAllShops();
    
    // Ambil data auto_ship_chat untuk toko-toko milik user
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
        // Lanjutkan dengan data kosong daripada throw error
      } else {
        // Map untuk menghubungkan shop_id dengan nama toko
        const shopMap = userShops.reduce((acc, shop) => {
          acc[shop.shop_id] = shop.shop_name || `Toko ${shop.shop_id}`;
          return acc;
        }, {});
        
        // Dapatkan paket berlangganan user, gunakan 'free' jika tidak ada
        let maxShops = 1;
        let planName = 'free';
        
        if (subscription && subscription.plan && subscription.plan.length > 0) {
          const plan = subscription.plan[0];
          maxShops = plan.max_shops || 1;
          planName = plan.name || 'free';
        }
        
        // Transform data untuk kompatibilitas frontend
        transformedAutoShip = autoShip?.map(item => ({
          shop_id: item.shop_id,
          shop_name: shopMap[item.shop_id] || `Toko ${item.shop_id}`,
          status_chat: item.status_chat || false,
          status_ship: item.status_ship || false,
          premium_plan: planName
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
              premium_plan: planName
            });
          }
        });
      }
    }

    // Simpan ke Redis sebagai cache
    try {
      // Simpan dengan format user_id sebagai prefix
      const redisKey = `user_settings:${userId}`;
      const settingsData = {
        ...pengaturan,
        subscription: subscription,
        shops: transformedAutoShip
      };
      
      await redis.set(redisKey, JSON.stringify(settingsData));
    } catch (cacheError) {
      console.error('Error saat menyimpan ke cache:', cacheError);
      // Lanjutkan eksekusi meskipun cache gagal
    }
    
    // Format respons untuk kompatibilitas dengan frontend
    return NextResponse.json({
      ok: true,
      pengaturan: pengaturan || {
        openai_api: null,
        openai_model: 'gpt-3.5-turbo',
        openai_temperature: 0.4,
        openai_prompt: '',
        auto_ship: true,
        auto_ship_interval: 5,
        in_cancel_msg: null,
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
    const { data: subscription, error: subscriptionError } = await supabase
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
    
    // Dapatkan paket berlangganan user, gunakan 'free' jika tidak ada
    let maxShops = 1;
    let planName = 'free';
    
    if (subscription && subscription.plan && subscription.plan.length > 0) {
      const plan = subscription.plan[0];
      maxShops = plan.max_shops || 1;
      planName = plan.name || 'free';
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
      in_cancel_msg: updatedSettings.in_cancel_msg || null,
      user_id: userId
    };

    // Simpan pengaturan ke database
    const { error: settingsError } = await supabase
      .from('pengaturan')
      .upsert(sanitizedSettings)
      .eq('user_id', userId);

    if (settingsError) {
      console.error('Error saat menyimpan pengaturan:', settingsError);
      throw settingsError;
    }

    // Mengambil semua toko milik user dari shopee_tokens
    const userShops = await getAllShops();
    
    // Pastikan jumlah toko tidak melebihi batas paket berlangganan
    const totalShops = userShops.length;
    if (totalShops > maxShops) {
      console.warn(`Jumlah toko (${totalShops}) melebihi batas paket berlangganan (${maxShops})`);
    }

    // Update auto_ship_chat
    for (const item of updatedAutoShip) {
      if (!item.shop_id) continue;

      // Periksa apakah shop_id ini adalah milik user
      const isUserShop = userShops.some(shop => shop.shop_id === item.shop_id);
      if (!isUserShop) {
        console.warn(`Shop ID ${item.shop_id} bukan milik user ${userId}`);
        continue;
      }

      const autoShipData = {
        shop_id: item.shop_id,
        status_chat: Boolean(item.status_chat),
        status_ship: Boolean(item.status_ship),
        premium_plan: planName // Gunakan paket berlangganan user saat ini
      };

      const { error: autoShipError } = await supabase
        .from('auto_ship_chat')
        .upsert(autoShipData)
        .eq('shop_id', item.shop_id);

      if (autoShipError) {
        console.error(`Error saat memperbarui auto_ship_chat untuk toko ${item.shop_id}:`, autoShipError);
        throw autoShipError;
      }
    }

    // Update Redis cache
    try {
      const redisKey = `user_settings:${userId}`;
      const settingsData = {
        ...sanitizedSettings,
        subscription: subscription,
        shops: updatedAutoShip.map(item => ({
          ...item,
          premium_plan: planName // Pastikan semua shop menggunakan paket yang sama
        }))
      };
      
      await redis.set(redisKey, JSON.stringify(settingsData));
    } catch (cacheError) {
      console.error('Error saat memperbarui cache:', cacheError);
      // Lanjutkan karena data utama sudah tersimpan di database
    }
    
    return NextResponse.json({ 
      success: true,
      ok: true,
      message: 'Pengaturan berhasil disimpan',
      data: {
        settings: sanitizedSettings,
        subscription: subscription,
        autoShip: updatedAutoShip.map(item => ({
          ...item,
          premium_plan: planName // Pastikan semua shop menggunakan paket yang sama
        }))
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
