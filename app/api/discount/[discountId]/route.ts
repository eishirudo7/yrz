import { NextRequest, NextResponse } from 'next/server';
import { 
  getDiscountDetails,
  addDiscountItems,
  updateDiscount, 
  deleteDiscount,
  updateDiscountItems,
  endDiscount 
} from '@/app/services/shopeeService';

export async function GET(
  req: NextRequest,
  { params }: { params: { discountId: string } }
) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const shopId = parseInt(searchParams.get('shopId') || '');
    const discountId = parseInt(params.discountId);

    if (!shopId || !discountId) {
      return NextResponse.json(
        { error: 'Parameter tidak lengkap' },
        { status: 400 }
      );
    }

    const result = await getDiscountDetails(shopId, discountId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting discount details:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan internal server' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { discountId: string } }
) {
  try {
    const body = await req.json();
    const { shopId, updateData } = body;
    const discountId = parseInt(params.discountId);

    if (!shopId || !discountId || !updateData) {
      return NextResponse.json(
        { error: 'Data tidak lengkap' },
        { status: 400 }
      );
    }

    const result = await updateDiscount(shopId, discountId, updateData);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating discount:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan internal server' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { discountId: string } }
) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const shopId = parseInt(searchParams.get('shopId') || '');
    const discountId = parseInt(params.discountId);

    if (!shopId || !discountId) {
      return NextResponse.json(
        { error: 'Parameter tidak lengkap' },
        { status: 400 }
      );
    }

    const result = await deleteDiscount(shopId, discountId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error deleting discount:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan internal server' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { discountId: string } }
) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const action = searchParams.get('action');
    
    if (action === 'end') {
      const body = await req.json();
      const { shopId } = body;
      const discountId = parseInt(params.discountId);

      if (!shopId || !discountId) {
        return NextResponse.json(
          { error: 'Parameter tidak lengkap' },
          { status: 400 }
        );
      }

      const result = await endDiscount(shopId, discountId);

      if (!result.success) {
        return NextResponse.json(
          { error: result.message },
          { status: 400 }
        );
      }

      return NextResponse.json(result);
    } 
    
    else if (action === 'update-items') {
      const body = await req.json();
      const { shopId, items } = body;
      const discountId = parseInt(params.discountId);

      console.log('Request update items:', {
        shopId,
        discountId,
        items
      });

      if (!shopId || !discountId || !items) {
        return NextResponse.json(
          { error: 'Parameter tidak lengkap' },
          { status: 400 }
        );
      }

      const result = await updateDiscountItems(shopId, discountId, items);
      
      console.log('Response from Shopee:', result);

      if (!result.success) {
        return NextResponse.json(
          { error: result.message },
          { status: 400 }
        );
      }

      return NextResponse.json(result);
    }

    else if (action === 'add-items') {
      const body = await req.json();
      const { shopId, items } = body;
      const discountId = parseInt(params.discountId);

      console.log('Request add items:', {
        shopId,
        discountId,
        items
      });

      if (!shopId || !discountId || !items) {
        return NextResponse.json(
          { error: 'Parameter tidak lengkap' },
          { status: 400 }
        );
      }

      const result = await addDiscountItems(shopId, discountId, items);
      
      console.log('Response from Shopee:', result);

      if (!result.success) {
        return NextResponse.json(
          { error: result.message },
          { status: 400 }
        );
      }

      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: 'Action tidak valid' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing discount action:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan internal server' },
      { status: 500 }
    );
  }
} 