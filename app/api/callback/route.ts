import { NextRequest, NextResponse } from 'next/server';
import { getTokens } from '@/app/services/tokenManager';
import { unblockShopWebhook } from '@/app/services/shopeeService';
import { syncOrders } from '@/app/services/orderSyncs';
import { createClient } from '@/utils/supabase/server';



export async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get('code');
    const shopId = request.nextUrl.searchParams.get('shop_id');

    if (!code || !shopId) {
        return NextResponse.json({ error: 'Code or shop_id is missing' }, { status: 400 });
    }

    // Dapatkan user_id dari session aktif
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
        console.error('User tidak terautentikasi:', userError);
        return NextResponse.json({ error: 'User tidak terautentikasi' }, { status: 401 });
    }

    // Simpan user_id bersama token
    const tokens = await getTokens(code, Number(shopId), user.id);
    
    await unblockShopWebhook(Number(shopId));

    // Jalankan sinkronisasi pesanan dan produk secara asynchronous
    // Kita tidak menunggu promise ini selesai agar tidak menunda redirect
    triggerInitialSync(Number(shopId));

    // Ambil host dari request headers
    const host = request.headers.get('host');
    // Tentukan protocol (https untuk production, http untuk development)
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    
    const baseUrl = `${protocol}://${host}`;
    const redirectUrl = new URL('/shops', baseUrl);
    console.log('Redirect URL:', redirectUrl.toString());
    return NextResponse.redirect(redirectUrl);
}

/**
 * Fungsi untuk memicu sinkronisasi data pertama kali setelah penambahan toko
 * Dijalankan secara asynchronous tanpa menunggu hasilnya
 */
async function triggerInitialSync(shopId: number) {
    try {
        console.log(`Memulai sinkronisasi awal untuk toko ${shopId}...`);
        
        // Tunggu sebentar agar token tersimpan dengan baik di database
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Jalankan sinkronisasi pesanan 7 hari terakhir
        const now = Math.floor(Date.now() / 1000);
        const orderResult = await syncOrders(shopId, {
            timeRangeField: 'create_time',
            startTime: now - (7 * 24 * 60 * 60), // 7 hari terakhir
            endTime: now,
            orderStatus: 'ALL',
            pageSize: 50,
            onProgress: (progress) => {
                console.log(`Sinkronisasi pesanan toko ${shopId}: ${progress.current}/${progress.total} pesanan terproses`);
            }
        });
        
        if (orderResult.success) {
            console.log(`Sinkronisasi awal pesanan toko ${shopId} selesai: ${orderResult.data?.processed || 0}/${orderResult.data?.total || 0} pesanan berhasil disinkronkan`);
        } else {
            console.error(`Sinkronisasi awal pesanan toko ${shopId} gagal:`, orderResult.error);
        }

        // Jalankan sinkronisasi produk
        await syncProducts(shopId);
        
    } catch (error) {
        console.error(`Error saat melakukan sinkronisasi awal toko ${shopId}:`, error);
    }
}

/**
 * Fungsi untuk sinkronisasi produk dari toko yang baru ditambahkan
 */
const syncProducts = async (shopId: number) => {
    try {
      const supabase = await createClient();
      
      let totalProducts = 0
      let processedProducts = 0

      // Proses setiap toko yang dipilih
      
        const response = await fetch(`/api/produk?shop_id=${shopId}`)
        const data: any = await response.json()

        if (data.success) {
          totalProducts += data.data.items.length

          // Simpan data produk ke Supabase
          for (const item of data.data.items) {
            // Insert/Update item utama
            const { error: itemError } = await supabase
              .from('items')
              .upsert({
                item_id: item.item_id,
                shop_id: shopId,
                category_id: item.category_id,
                item_name: item.item_name,
                description: item.description,
                item_sku: item.item_sku,
                create_time: item.create_time,
                update_time: item.update_time,
                weight: item.weight,
                image: item.image,
                logistic_info: item.logistic_info,
                pre_order: item.pre_order,
                condition: item.condition,
                item_status: item.item_status,
                has_model: item.has_model,
                brand: item.brand,
                item_dangerous: item.item_dangerous,
                description_type: item.description_type,
                size_chart_id: item.size_chart_id,
                promotion_image: item.promotion_image,
                deboost: item.deboost === 'FALSE' ? false : true,
                authorised_brand_id: item.authorised_brand_id
              }, { 
                onConflict: 'item_id' 
              })

            if (itemError) throw itemError

            processedProducts++
            
            
          }
        } else {
          throw new Error(data.error)
        }
      

 



      return {
        success: processedProducts,
        total: totalProducts
      }
    } catch (error) {
        console.log("Gagal sinkronisasi saat menambahkan toko")
      return {
        success: 0,
        total: 0
      }
    } 
  }