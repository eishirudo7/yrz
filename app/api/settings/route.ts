import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

import { redis } from '@/app/services/redis';

export async function GET() {
  try {
    // Langsung ambil dari database
    const [{ data: settings, error: settingsError }, { data: autoShip, error: autoShipError }] = await Promise.all([
      supabase.from('pengaturan').select('*'),
      supabase.from('auto_ship_chat').select(`*, shopee_tokens!inner(shop_name)`)
    ]);

    if (settingsError) throw settingsError;
    if (autoShipError) throw autoShipError;

    const transformedAutoShip = autoShip?.map(item => ({
      ...item,
      shop_name: item.shopee_tokens.shop_name,
      shopee_tokens: undefined
    })) || [];

    // Update Redis setelah dapat data baru
    try {
      await redis.set('pengaturan', JSON.stringify(Array.isArray(settings) ? settings : [settings]));
      await redis.set('auto_ship', JSON.stringify(transformedAutoShip));
    } catch (redisError) {
      console.error('Error updating Redis cache:', redisError);
      // Lanjutkan eksekusi karena kita masih punya data dari database
    }

    return NextResponse.json({ 
      pengaturan: Array.isArray(settings) ? settings : [settings], 
      autoShip: transformedAutoShip 
    });
  } catch (error) {
    console.error('❌ Error saat mengambil data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { updatedSettings, updatedAutoShip } = await request.json();
    
    // Validasi tipe data
    if (!Array.isArray(updatedAutoShip)) {
      return NextResponse.json({ error: 'Format data auto ship tidak valid' }, { status: 400 });
    }

    // Periksa apakah updatedSettings dan updatedAutoShip ada
    if (!updatedSettings || !updatedAutoShip) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    // Sanitasi dan validasi updatedSettings
    const sanitizedSettings = {  // Hapus array wrapper
      id: 1,
      openai_api: updatedSettings.openai_api || null,
      openai_model: updatedSettings.openai_model || null,
      openai_temperature: typeof updatedSettings.openai_temperature === 'number' ? updatedSettings.openai_temperature : null,
      openai_prompt: updatedSettings.openai_prompt || null,
      auto_ship: typeof updatedSettings.auto_ship === 'boolean' ? updatedSettings.auto_ship : true,
      auto_ship_interval: typeof updatedSettings.auto_ship_interval === 'number' ? updatedSettings.auto_ship_interval : 5
    };

    // Update settings dengan upsert
    const { error: settingsError } = await supabase
      .from('pengaturan')
      .upsert(sanitizedSettings)
      .eq('id', 1);

    if (settingsError) {
      console.error('Error saving settings:', settingsError);
      throw settingsError;
    }

    // Update auto_ship_chat
    for (const item of updatedAutoShip) {
      const { error: autoShipError } = await supabase
        .from('auto_ship_chat')
        .update({
          status_chat: item.status_chat,
          status_ship: item.status_ship
        })
        .eq('shop_id', item.shop_id);

      if (autoShipError) {
        console.error('Kesalahan saat memperbarui auto_ship_chat:', autoShipError);
        throw autoShipError;
      }
    }

    // Simpan ke Redis dengan JSON.stringify yang benar
    try {
      await redis.set('pengaturan', JSON.stringify([sanitizedSettings])); // Simpan sebagai array untuk konsistensi
      await redis.set('auto_ship', JSON.stringify(updatedAutoShip));
    } catch (redisError) {
      console.error('Error saving to Redis:', redisError);
      // Lanjutkan eksekusi karena data sudah tersimpan di database
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Pengaturan berhasil disimpan',
      data: {
        settings: sanitizedSettings,
        autoShip: updatedAutoShip
      }
    });

  } catch (error) {
    console.error('Kesalahan internal server:', error);
    if (error instanceof Error) {
      return NextResponse.json({ 
        error: 'Kesalahan Internal Server', 
        details: error.message 
      }, { status: 500 });
    } else {
      return NextResponse.json({ 
        error: 'Kesalahan Internal Server', 
        details: 'Terjadi kesalahan yang tidak diketahui' 
      }, { status: 500 });
    }
  }
}
