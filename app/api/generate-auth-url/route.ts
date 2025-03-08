import { NextResponse } from 'next/server';
import { generateAuthUrl } from '@/app/services/shopeeService';

export async function GET() {
  try {
    const authUrl = await generateAuthUrl();
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Gagal menghasilkan URL otentikasi:', error);
    return NextResponse.json({ error: 'Gagal menghasilkan URL otentikasi' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic'
export const revalidate = 0