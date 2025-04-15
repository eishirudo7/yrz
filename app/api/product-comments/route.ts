import { NextRequest, NextResponse } from 'next/server';
import { getProductComment, replyProductComment } from '@/app/services/shopeeService';
import { createClient } from '@/utils/supabase/server';

export async function GET(req: NextRequest) {
  try {
    // Autentikasi pengguna terlebih dahulu
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({
        success: false,
        message: 'Tidak diautentikasi'
      }, { status: 401 });
    }

    // Ambil parameter dari query string
    const searchParams = req.nextUrl.searchParams;
    const shopId = parseInt(searchParams.get('shop_id') || '0');
    const itemId = searchParams.get('item_id') ? parseInt(searchParams.get('item_id') || '0') : undefined;
    const commentId = searchParams.get('comment_id') ? parseInt(searchParams.get('comment_id') || '0') : undefined;
    const cursor = searchParams.get('cursor') || undefined;
    const pageSize = searchParams.get('page_size') ? parseInt(searchParams.get('page_size') || '20') : undefined;

    // Validasi parameter yang diperlukan
    if (!shopId) {
      return NextResponse.json({
        success: false,
        message: 'shop_id diperlukan'
      }, { status: 400 });
    }

    // Panggil service untuk mendapatkan komentar produk
    const response = await getProductComment(shopId, {
      item_id: itemId,
      comment_id: commentId,
      cursor,
      page_size: pageSize
    });

    if (!response.success) {
      return NextResponse.json({
        success: false,
        message: response.message,
        error: response.error
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: response.data,
      request_id: response.request_id
    });

  } catch (error) {
    console.error('Error pada endpoint product-comments:', error);
    
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan internal'
    }, { status: 500 });
  }
}

/**
 * Endpoint untuk membalas komentar produk
 */
export async function POST(req: NextRequest) {
  try {
    // Autentikasi pengguna terlebih dahulu
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({
        success: false,
        message: 'Tidak diautentikasi'
      }, { status: 401 });
    }

    // Baca body request
    const requestData = await req.json();
    
    // Validasi body request
    if (!requestData.shop_id) {
      return NextResponse.json({
        success: false,
        message: 'shop_id diperlukan'
      }, { status: 400 });
    }

    if (!requestData.comment_list || !Array.isArray(requestData.comment_list) || requestData.comment_list.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'comment_list diperlukan dan harus berupa array yang tidak kosong'
      }, { status: 400 });
    }

    // Validasi format setiap item dalam comment_list
    for (const comment of requestData.comment_list) {
      if (!comment.comment_id || typeof comment.comment_id !== 'number') {
        return NextResponse.json({
          success: false,
          message: 'Setiap item dalam comment_list harus memiliki comment_id yang valid'
        }, { status: 400 });
      }

      if (!comment.comment || typeof comment.comment !== 'string' || comment.comment.trim() === '') {
        return NextResponse.json({
          success: false,
          message: 'Setiap item dalam comment_list harus memiliki comment yang valid'
        }, { status: 400 });
      }
    }

    // Panggil service untuk membalas komentar produk
    const response = await replyProductComment(
      requestData.shop_id,
      requestData.comment_list
    );

    if (!response.success) {
      return NextResponse.json({
        success: false,
        message: response.message,
        error: response.error
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: response.data,
      request_id: response.request_id
    });

  } catch (error) {
    console.error('Error pada endpoint reply product-comments:', error);
    
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan internal'
    }, { status: 500 });
  }
} 