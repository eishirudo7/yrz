import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/app/services/tokenManager';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shopId = searchParams.get('shop_id');

    if (!shopId) {
      return NextResponse.json(
        { error: 'shop_id diperlukan' },
        { status: 400 }
      );
    }

    const accessToken = await getValidAccessToken(parseInt(shopId));
    
    return NextResponse.json({
      success: true,
      data: { access_token: accessToken }
    });
  } catch (error) {
    console.error('Error mendapatkan access token:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Gagal mendapatkan access token',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 