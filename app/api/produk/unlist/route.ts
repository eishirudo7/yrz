import { NextRequest, NextResponse } from 'next/server';
import { unlistItems } from '@/app/services/shopeeService';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Parse body request
    const body = await request.json();
    const { shopId, items } = body;

    // Validasi shop_id
    if (!shopId || typeof shopId !== 'number') {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Shop ID tidak valid' 
        },
        { status: 400 }
      );
    }

    // Validasi items
    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Daftar item tidak valid' 
        },
        { status: 400 }
      );
    }

    if (items.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Daftar item tidak boleh kosong' 
        },
        { status: 400 }
      );
    }

    if (items.length > 50) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Maksimal 50 item dapat diproses dalam satu waktu' 
        },
        { status: 400 }
      );
    }

    // Validasi format setiap item
    for (const item of items) {
      if (!item.item_id || typeof item.unlist !== 'boolean') {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Format item tidak valid. Setiap item harus memiliki item_id dan unlist (true untuk nonaktif, false untuk aktif)' 
          },
          { status: 400 }
        );
      }
    }

    // Proses toggle status items
    const result = await unlistItems(shopId, items);

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          message: result.message || 'Gagal memproses perubahan status item',
          error: result.error,
          request_id: result.request_id 
        },
        { status: 500 }
      );
    }

    // Update status di database Supabase
    try {
      // Update untuk setiap item berdasarkan unlist status masing-masing
      for (const item of items) {
        const { data: supabaseData, error: supabaseError } = await supabase
          .from('items')
          .update({
            item_status: item.unlist ? 'UNLIST' : 'NORMAL',
            updated_at: new Date().toISOString()
          })
          .eq('item_id', item.item_id)
          .eq('shop_id', shopId);

        if (supabaseError) {
          console.error('Error updating Supabase:', supabaseError);
          throw supabaseError;
        }
      }

      // Tambahkan return success tanpa warning jika tidak ada error
      return NextResponse.json({
        success: true,
        data: result.data,
        request_id: result.request_id,
        warning: result.warning || null
      });

    } catch (dbError) {
      console.error('Error updating database:', dbError);
      // Return dengan warning jika terjadi error
      return NextResponse.json({
        success: true,
        data: result.data,
        request_id: result.request_id,
        warning: {
          message: 'Gagal mengupdate status di database lokal',
          ...result.warning
        }
      });
    }

  } catch (error) {
    console.error('Error dalam route toggle-status:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Terjadi kesalahan internal server' 
      },
      { status: 500 }
    );
  }
}
