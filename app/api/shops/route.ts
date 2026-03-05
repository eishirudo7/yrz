// pages/api/shops/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/db';
import { shopeeTokens } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    // Inisialisasi Supabase client
    const supabase = await createClient();

    // Ambil user dari session
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({
        success: false,
        message: 'Pengguna tidak terautentikasi'
      }, { status: 401 });
    }

    // Ambil toko milik user dari internal database (PostgreSQL) menggunakan Drizzle
    const shops = await db
      .select({
        shop_id: shopeeTokens.shopId,
        shop_name: shopeeTokens.shopName,
      })
      .from(shopeeTokens)
      .where(
        and(
          eq(shopeeTokens.userId, user.id),
          eq(shopeeTokens.isActive, true)
        )
      );

    return NextResponse.json({
      success: true,
      data: shops || []
    });
  } catch (error) {
    console.error('Error fetching shops:', error);
    return NextResponse.json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data toko',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}