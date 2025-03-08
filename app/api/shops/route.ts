// pages/api/shops/route.ts
import { NextResponse } from 'next/server';

import { getAllShops } from '@/app/services/shopeeService';

type Shop = {
  shop_id: number;
  shop_name: string;
};

export async function GET() {
  try {
    const shops = await getAllShops();
    
    if (shops && shops.length > 0) {
      const simplifiedShops = shops.map((shop: any) => ({
        shop_id: shop.shop_id,
        shop_name: shop.shop_name,
        is_active: shop.is_active,
        access_token: shop.access_token
      }));

      return NextResponse.json({
        status: 'success',
        message: 'Daftar toko berhasil diambil',
        data: simplifiedShops
      }, { status: 200 });
    }

    return NextResponse.json({
      status: 'error',
      message: 'Data toko tidak ditemukan',
      data: []
    }, { status: 404 });

  } catch (error) {
    console.error('Gagal mendapatkan daftar toko:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Terjadi kesalahan saat mengambil daftar toko',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}