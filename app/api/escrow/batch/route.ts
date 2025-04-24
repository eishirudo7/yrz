import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getEscrowDetailBatch } from '@/app/services/shopeeService';
import { saveBatchEscrowDetail } from '@/app/services/databaseOperations';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Autentikasi user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({
        success: false,
        message: 'Pengguna tidak terautentikasi'
      }, { status: 401 });
    }

    const body = await request.json();
    
    // Validasi input
    if (!body.shopId) {
      return NextResponse.json({
        success: false,
        message: 'Parameter shopId diperlukan'
      }, { status: 400 });
    }
    
    if (!body.orderSns || !Array.isArray(body.orderSns) || body.orderSns.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Parameter orderSns harus berupa array yang tidak kosong'
      }, { status: 400 });
    }
    
    if (body.orderSns.length > 50) {
      return NextResponse.json({
        success: false,
        message: 'Jumlah pesanan tidak boleh lebih dari 50'
      }, { status: 400 });
    }
    
    // Ambil detail escrow secara batch
    const batchResponse = await getEscrowDetailBatch(body.shopId, body.orderSns);
    
    if (!batchResponse.success) {
      return NextResponse.json({
        success: false,
        message: batchResponse.message || 'Gagal mengambil data escrow batch',
        error: batchResponse.error,
        request_id: batchResponse.request_id
      }, { status: 500 });
    }
    
    // Simpan data ke database jika diminta
    let saveResult = null;
    if (body.saveToDB && batchResponse.data && batchResponse.data.order_list) {
      try {
        saveResult = await saveBatchEscrowDetail(body.shopId, batchResponse.data.order_list);
        
        if (saveResult.failed > 0) {
          console.warn(`${saveResult.failed} dari ${batchResponse.data.order_list.length} data escrow gagal disimpan`);
        } else {
          console.info(`Berhasil menyimpan ${saveResult.success} data escrow ke database`);
        }
      } catch (error) {
        console.error('Error menyimpan data escrow batch ke database:', error);
        saveResult = {
          success: 0,
          failed: batchResponse.data.order_list.length,
          errors: [{ message: error instanceof Error ? error.message : 'Terjadi kesalahan saat menyimpan data' }]
        };
      }
    }
    
    return NextResponse.json({
      success: true,
      data: batchResponse.data,
      request_id: batchResponse.request_id,
      save_result: saveResult
    });
    
  } catch (error: any) {
    console.error('Error dalam API escrow batch:', error);
    return NextResponse.json({
      success: false,
      message: 'Terjadi kesalahan saat memproses permintaan',
      error: error.message
    }, { status: 500 });
  }
} 