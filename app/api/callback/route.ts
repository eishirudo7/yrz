import { NextRequest, NextResponse } from 'next/server';
import { getTokens } from '@/app/services/tokenManager';
import { unblockShopWebhook } from '@/app/services/shopeeService';

export async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get('code');
    const shopId = request.nextUrl.searchParams.get('shop_id');

    if (!code || !shopId) {
        return NextResponse.json({ error: 'Code or shop_id is missing' }, { status: 400 });
    }

    const tokens = await getTokens(code, Number(shopId));
    
    await unblockShopWebhook(Number(shopId));

    // Ambil host dari request headers
    const host = request.headers.get('host');
    // Tentukan protocol (https untuk production, http untuk development)
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    
    const baseUrl = `${protocol}://${host}`;
    const redirectUrl = new URL('/shops', baseUrl);
    console.log('Redirect URL:', redirectUrl.toString());
    return NextResponse.redirect(redirectUrl);
}