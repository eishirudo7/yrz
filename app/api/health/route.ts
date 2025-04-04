import { NextResponse } from 'next/server';
import { checkShopHealth, checkOpenAIKey } from '@/app/services/SafeTool';
import { createClient } from '@/utils/supabase/server';
import { redis } from "@/app/services/redis";

interface SettingsResponse {
  pengaturan: Array<{
    openai_api: string;
  }>;
}

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

async function getSettings(): Promise<SettingsResponse | null> {
  try {
    // Cek apakah ada user yang terautentikasi
    const userId = await getUserIdFromSession();
    if (!userId) {
      console.warn('Tidak ada user yang terautentikasi untuk mengambil pengaturan');
      return null;
    }
    
    // Coba dapatkan dari Redis cache terlebih dahulu
    try {
      const redisKey = `user_settings:${userId}`;
      const cachedSettings = await redis.get(redisKey);
      
      if (cachedSettings) {
        const parsedSettings = JSON.parse(cachedSettings);
        return {
          pengaturan: [{
            openai_api: parsedSettings.openai_api || null
          }]
        };
      }
    } catch (cacheError) {
      console.warn('Gagal mengambil data dari cache:', cacheError);
      // Lanjutkan dengan query database
    }

    // Jika tidak ada di cache, ambil dari database
    const supabase = await createClient();
    const { data: pengaturan, error } = await supabase
      .from('pengaturan')
      .select('openai_api')
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error saat mengambil pengaturan dari database:', error);
      throw error;
    }
    
    return {
      pengaturan: pengaturan || []
    };
  } catch (error) {
    console.error('Error getting settings:', error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Handle untuk pengecekan OpenAI API key
    if (body.apiKey) {
      const result = await checkOpenAIKey(body.apiKey);
    
      return NextResponse.json(result, {
        status: result.success ? 200 : 400,
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
          'Content-Type': 'application/json',
        },
      });
    }
    
    // Handle untuk pengecekan kesehatan toko dengan shopIds
    if (body.shopIds && Array.isArray(body.shopIds)) {
      console.log('Melakukan health check dengan shopIds:', body.shopIds);
      
      // Ambil semua data secara parallel dengan shopIds
      const [healthCheck, settings] = await Promise.all([
        checkShopHealth(body.shopIds),
        getSettings()
      ]);

      let openAICheck = {
        success: false,
        message: 'OpenAI API key tidak ditemukan'
      };

      if (settings?.pengaturan[0]?.openai_api) {
        openAICheck = await checkOpenAIKey(settings.pengaturan[0].openai_api);
      }

      return NextResponse.json({
        success: healthCheck.success && openAICheck.success,
        data: {
          shop_health: healthCheck.data,
          openai: {
            success: openAICheck.success,
            ...(openAICheck.success ? {} : { message: openAICheck.message })
          }
        },
        message: healthCheck.success && openAICheck.success 
          ? 'Semua layanan berjalan normal'
          : 'Beberapa layanan mengalami masalah'
      }, {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
          'Content-Type': 'application/json',
        },
      });
    }
    
    return NextResponse.json(
      { success: false, message: 'Tidak ada apiKey atau shopIds yang valid dalam request' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error in health check API:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Terjadi kesalahan internal server',
        data: {
          shop_health: null,
          openai: null
        }
      },
      { status: 500 }
    );
  }
} 
export const dynamic = 'force-dynamic';
export const revalidate = 0;