import { NextRequest, NextResponse } from 'next/server';
import { 
  getDiscountDetails,
  addDiscountItems,
  updateDiscount, 
  deleteDiscount,
  updateDiscountItems,
  deleteDiscountItems,
  endDiscount,
  getModelList
} from '@/app/services/shopeeService';
import { createClient } from '@/utils/supabase/server';

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
    
    // Ambil semua model dari setiap item, termasuk yang tidak dalam promosi
    if (result.data?.item_list?.length > 0) {
      try {
        // Ambil data model lengkap untuk setiap item
        const itemsWithAllModels = await Promise.all(
          result.data.item_list.map(async (item: any) => {
            // Ambil semua model untuk item ini
            const modelListResult = await getModelList(shopId, item.item_id);
            
            if (modelListResult.success && modelListResult.data?.model) {
              // Gabungkan model dari promosi dengan model lain
              const allModelMap = new Map();
              
              // Tambahkan model yang dalam promosi ke map
              item.model_list.forEach((promoModel: any) => {
                allModelMap.set(promoModel.model_id, {
                  ...promoModel,
                  in_promotion: true
                });
              });
              
              // Tambahkan model dari getModelList yang belum ada
              modelListResult.data.model.forEach((model: any) => {
                if (!allModelMap.has(model.model_id)) {
                  allModelMap.set(model.model_id, {
                    model_id: model.model_id,
                    model_name: model.model_name,
                    model_original_price: model.price_info[0]?.original_price || 0,
                    model_promotion_price: model.price_info[0]?.original_price || 0, // Sama dengan harga asli jika tidak dalam promosi
                    model_normal_stock: model.stock_info_v2?.summary_info?.total_available_stock || 0,
                    model_promotion_stock: 0,
                    in_promotion: false
                  });
                }
              });
              
              // Konversi map kembali ke array
              return {
                ...item,
                model_list: Array.from(allModelMap.values())
              };
            }
            
            return item;
          })
        );
        
        result.data.item_list = itemsWithAllModels;
        
        // Ambil data gambar dari Supabase
        const itemIds = result.data.item_list.map((item: any) => item.item_id);
        
        // Buat koneksi ke Supabase
        const supabase = await createClient();

        // Query untuk mengambil data item berdasarkan item_id
        const { data, error } = await supabase
          .from('items')
          .select('item_id, image')
          .eq('shop_id', shopId)
          .in('item_id', itemIds);

        if (!error && data) {
          // Tambahkan data gambar ke item_list
          result.data.item_list = result.data.item_list.map((item: any) => {
            const itemData = data.find((i: any) => i.item_id === item.item_id);
            return {
              ...item,
              image_url: itemData?.image?.image_url_list?.[0] || null
            };
          });
        }
      } catch (err) {
        console.error('Error fetching additional data:', err);
        // Lanjutkan dengan data yang ada jika terjadi error
      }
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
    
    else if (action === 'delete-items') {
      const body = await req.json();
      const { shopId, itemIds } = body;
      const discountId = parseInt(params.discountId);

      console.log('Request delete items:', {
        shopId,
        discountId,
        itemIds
      });

      if (!shopId || !discountId || !itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
        return NextResponse.json(
          { error: 'Parameter tidak lengkap atau tidak valid' },
          { status: 400 }
        );
      }

      // Validasi format item_id
      const isValidItemFormat = itemIds.every(item => 
        typeof item === 'object' && item !== null && 'item_id' in item && 
        typeof item.item_id === 'number'
      );

      if (!isValidItemFormat) {
        return NextResponse.json(
          { error: 'Format item tidak valid. Setiap item harus memiliki property item_id bertipe number' },
          { status: 400 }
        );
      }

      const result = await deleteDiscountItems(shopId, discountId, itemIds);
      
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