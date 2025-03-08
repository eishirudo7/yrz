import { NextRequest, NextResponse } from 'next/server';
import { downloadShippingDocument } from '@/app/services/shopeeService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shopId, orderList } = body;

    if (!shopId || !orderList) {
      return NextResponse.json(
        { 
          error: "invalid_parameters",
          message: "Parameter shopId dan orderList harus diisi" 
        }, 
        { status: 400 }
      );
    }

    const response = await downloadShippingDocument(shopId, orderList);
    
    if (response instanceof Buffer) {
      return new NextResponse(response, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': response.length.toString()
        }
      });
    }

    if (response.error) {
      return NextResponse.json(response, { status: 400 });
    }

    return NextResponse.json(
      { 
        error: "unexpected_response",
        message: "Format response tidak sesuai yang diharapkan" 
      }, 
      { status: 500 }
    );

  } catch (error) {
    console.error('Error in API route:', error);
    return NextResponse.json(
      { 
        error: "internal_server_error",
        message: `Terjadi kesalahan internal: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }, 
      { status: 500 }
    );
  }
} 