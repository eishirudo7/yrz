import { NextRequest, NextResponse } from 'next/server';
import { getReturnList } from '@/app/services/shopeeService';


export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const shopId = searchParams.get('shop_id');
    const status = searchParams.get('status');
    const createTimeFrom = searchParams.get('create_time_from');
    const createTimeTo = searchParams.get('create_time_to');

    // 1. Validasi shop_id
    if (!shopId || isNaN(Number(shopId))) {
      return NextResponse.json(
        { 
          success: false,
          error: 'BAD_REQUEST', 
          message: 'Parameter shop_id harus berupa angka' 
        },
        { status: 400 }
      );
    }

    // 2. Siapkan options
    const options: Record<string, number | string> = {};
    
    // Page size
    const pageSize = searchParams.get('page_size');
    if (pageSize && !isNaN(Number(pageSize))) {
      if (Number(pageSize) > 100) {
        return NextResponse.json(
          { 
            success: false,
            error: 'BAD_REQUEST', 
            message: 'Parameter page_size tidak boleh lebih dari 100' 
          },
          { status: 400 }
        );
      }
      options.page_size = Number(pageSize);
    }

    // Page number
    const pageNo = searchParams.get('page_no');
    if (pageNo && !isNaN(Number(pageNo))) {
      options.page_no = Number(pageNo);
    }

    // Status
    const validStatuses = ['REQUESTED', 'ACCEPTED', 'CANCELLED', 'JUDGING', 'CLOSED', 'PROCESSING', 'SELLER_DISPUTE'];
    if (status && validStatuses.includes(status)) {
      options.status = status;
    }

    // Filter waktu
    if (createTimeFrom && !isNaN(Number(createTimeFrom))) {
      options.create_time_from = Number(createTimeFrom);
    }
    if (createTimeTo && !isNaN(Number(createTimeTo))) {
      options.create_time_to = Number(createTimeTo);
    }

    // 3. Panggil service
    const result = await getReturnList(parseInt(shopId), options);
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in returns API route:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'INTERNAL_SERVER_ERROR', 
        message: error instanceof Error ? error.message : 'Terjadi kesalahan internal server' 
      },
      { status: 500 }
    );
  }
}