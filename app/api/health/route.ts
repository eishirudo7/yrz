import { NextResponse } from 'next/server';
import { checkShopHealth, checkOpenAIKey } from '@/app/services/SafeTool';



interface SettingsResponse {
  pengaturan: Array<{
    openai_api: string;
  }>;
}

async function getSettings(): Promise<SettingsResponse | null> {
  try {
    const response = await fetch('http://localhost:10000/api/settings');
    if (!response.ok) {
      throw new Error('Gagal mengambil pengaturan');
    }
    const data = await response.json();
    return {
      pengaturan: data.pengaturan.map((p: any) => ({
        openai_api: p.openai_api
      }))
    };
  } catch (error) {
    console.error('Error fetching settings:', error);
    return null;
  }
}

export async function GET() {
  try {
    // Ambil semua data secara parallel
    const [healthCheck, settings] = await Promise.all([
      checkShopHealth(),
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: 'API key tidak ditemukan dalam request' },
        { status: 400 }
      );
    }

    const result = await checkOpenAIKey(apiKey);
    
    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Error in OpenAI key check API:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Terjadi kesalahan internal server' 
      },
      { status: 500 }
    );
  }
} 
export const dynamic = 'force-dynamic';
export const revalidate = 0;