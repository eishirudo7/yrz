import { NextResponse } from 'next/server';
import { generateDeauthUrl } from '@/app/services/shopeeService';

export async function GET() {
  try {
    const deauthUrl = await generateDeauthUrl();
    return NextResponse.json({ deauthUrl });
  } catch (error) {
    console.error('Gagal menghasilkan URL deautentikasi:', error);
    return NextResponse.json({ error: 'Gagal menghasilkan URL deautentikasi' }, { status: 500 });
  }
} 

export const dynamic = 'force-dynamic'
export const revalidate = 0