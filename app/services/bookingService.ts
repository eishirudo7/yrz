import { supabase } from '@/lib/supabase';
import { createClient } from "@/utils/supabase/server";

interface BookingOrderData {
  shop_id: number;
  booking_sn: string;
  order_sn?: string;
  region?: string;
  booking_status?: string;
  match_status?: string;
  shipping_carrier?: string;
  create_time?: number;
  update_time?: number;
  recipient_address?: any;
  item_list?: any[];
  dropshipper?: string;
  dropshipper_phone?: string;
  cancel_by?: string;
  cancel_reason?: string;
  fulfillment_flag?: string;
  pickup_done_time?: number;
  tracking_number?: string;
  is_printed?: boolean;
  document_status?: string;
}

/**
 * Menyimpan data booking orders ke database
 * @param bookings Array booking orders dari Shopee API response
 * @param shopId ID toko
 * @returns Hasil operasi penyimpanan
 */
export async function saveBookingOrders(
  bookings: any[], 
  shopId: number
): Promise<{
  success: boolean;
  message: string;
  savedCount?: number;
  errors?: any[];
}> {
  try {
    if (!bookings || bookings.length === 0) {
      return {
        success: false,
        message: 'Data booking kosong'
      };
    }

    const bookingData: BookingOrderData[] = bookings.map(booking => ({
      shop_id: shopId,
      booking_sn: booking.booking_sn,
      order_sn: booking.order_sn || null,
      region: booking.region || null,
      booking_status: booking.booking_status || null,
      match_status: booking.match_status || null,
      shipping_carrier: booking.shipping_carrier || null,
      create_time: booking.create_time || null,
      update_time: booking.update_time || null,
      recipient_address: booking.recipient_address || null,
      item_list: booking.item_list || null,
      dropshipper: booking.dropshipper || null,
      dropshipper_phone: booking.dropshipper_phone || null,
      cancel_by: booking.cancel_by || null,
      cancel_reason: booking.cancel_reason || null,
      fulfillment_flag: booking.fulfillment_flag || null,
      pickup_done_time: booking.pickup_done_time || null,
      tracking_number: booking.tracking_number || null,
      is_printed: booking.is_printed || false,
      document_status: booking.document_status || 'PENDING'
    }));

    // Upsert data (insert atau update jika sudah ada)
    const { data, error } = await supabase
      .from('booking_orders')
      .upsert(bookingData, {
        onConflict: 'shop_id,booking_sn',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error('Error menyimpan booking orders:', error);
      return {
        success: false,
        message: `Gagal menyimpan data booking: ${error.message}`,
        errors: [error]
      };
    }

    console.info(`Berhasil menyimpan ${data?.length || 0} booking orders untuk toko ${shopId}`);
    return {
      success: true,
      message: `Berhasil menyimpan ${data?.length || 0} booking orders`,
      savedCount: data?.length || 0
    };

  } catch (error) {
    console.error('Kesalahan saat menyimpan booking orders:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui',
      errors: [error]
    };
  }
}

/**
 * Mengambil booking orders dari database berdasarkan filter
 * @param shopId ID toko
 * @param filters Filter pencarian
 * @returns Data booking orders
 */
export async function getBookingOrdersFromDB(
  shopId: number,
  filters: {
    booking_status?: string;
    booking_sn?: string;
    order_sn?: string;
    tracking_number?: string;
    is_printed?: boolean;
    document_status?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{
  success: boolean;
  data?: any[];
  message?: string;
  total?: number;
}> {
  try {
    // Validasi user authentication
    const supabaseServer = await createClient();
    const { data: { user }, error: userError } = await supabaseServer.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        message: 'User tidak terautentikasi'
      };
    }

    // Validasi akses toko
    const { data: shopData, error: shopError } = await supabase
      .from('shopee_tokens')
      .select('shop_id')
      .eq('shop_id', shopId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (shopError || !shopData) {
      return {
        success: false,
        message: 'Toko tidak ditemukan atau tidak memiliki akses'
      };
    }

    let query = supabase
      .from('booking_orders')
      .select('*', { count: 'exact' })
      .eq('shop_id', shopId)
      .order('update_time', { ascending: false });

    // Apply filters
    if (filters.booking_status) {
      query = query.eq('booking_status', filters.booking_status);
    }

    if (filters.booking_sn) {
      query = query.eq('booking_sn', filters.booking_sn);
    }

    if (filters.order_sn) {
      query = query.eq('order_sn', filters.order_sn);
    }

    if (filters.tracking_number) {
      query = query.eq('tracking_number', filters.tracking_number);
    }

    if (filters.is_printed !== undefined) {
      query = query.eq('is_printed', filters.is_printed);
    }

    if (filters.document_status) {
      query = query.eq('document_status', filters.document_status);
    }

    if (filters.date_from && filters.date_to) {
      const fromTimestamp = Math.floor(new Date(filters.date_from).getTime() / 1000);
      const toTimestamp = Math.floor(new Date(filters.date_to).getTime() / 1000);
      query = query
        .gte('create_time', fromTimestamp)
        .lte('create_time', toTimestamp);
    }

    // Apply pagination
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, (filters.offset + (filters.limit || 50)) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error mengambil booking orders:', error);
      return {
        success: false,
        message: `Gagal mengambil data booking: ${error.message}`
      };
    }

    return {
      success: true,
      data: data || [],
      total: count || 0
    };

  } catch (error) {
    console.error('Kesalahan saat mengambil booking orders:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

/**
 * Menghapus booking orders dari database
 * @param shopId ID toko
 * @param bookingSnList Array booking SN yang akan dihapus
 * @returns Hasil operasi penghapusan
 */
export async function deleteBookingOrders(
  shopId: number,
  bookingSnList: string[]
): Promise<{
  success: boolean;
  message: string;
  deletedCount?: number;
}> {
  try {
    if (!bookingSnList || bookingSnList.length === 0) {
      return {
        success: false,
        message: 'Daftar booking SN tidak boleh kosong'
      };
    }

    // Validasi user authentication
    const supabaseServer = await createClient();
    const { data: { user }, error: userError } = await supabaseServer.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        message: 'User tidak terautentikasi'
      };
    }

    // Validasi akses toko
    const { data: shopData, error: shopError } = await supabase
      .from('shopee_tokens')
      .select('shop_id')
      .eq('shop_id', shopId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (shopError || !shopData) {
      return {
        success: false,
        message: 'Toko tidak ditemukan atau tidak memiliki akses'
      };
    }

    const { data, error } = await supabase
      .from('booking_orders')
      .delete()
      .eq('shop_id', shopId)
      .in('booking_sn', bookingSnList)
      .select();

    if (error) {
      console.error('Error menghapus booking orders:', error);
      return {
        success: false,
        message: `Gagal menghapus data booking: ${error.message}`
      };
    }

    console.info(`Berhasil menghapus ${data?.length || 0} booking orders untuk toko ${shopId}`);
    return {
      success: true,
      message: `Berhasil menghapus ${data?.length || 0} booking orders`,
      deletedCount: data?.length || 0
    };

  } catch (error) {
    console.error('Kesalahan saat menghapus booking orders:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

/**
 * Mengupdate status booking order
 * @param shopId ID toko
 * @param bookingSn Booking SN
 * @param updateData Data yang akan diupdate
 * @returns Hasil operasi update
 */
export async function updateBookingOrder(
  shopId: number,
  bookingSn: string,
  updateData: Partial<BookingOrderData>
): Promise<{
  success: boolean;
  message: string;
  data?: any;
}> {
  try {
    // Validasi user authentication
    const supabaseServer = await createClient();
    const { data: { user }, error: userError } = await supabaseServer.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        message: 'User tidak terautentikasi'
      };
    }

    // Validasi akses toko
    const { data: shopData, error: shopError } = await supabase
      .from('shopee_tokens')
      .select('shop_id')
      .eq('shop_id', shopId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (shopError || !shopData) {
      return {
        success: false,
        message: 'Toko tidak ditemukan atau tidak memiliki akses'
      };
    }

    const { data, error } = await supabase
      .from('booking_orders')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('shop_id', shopId)
      .eq('booking_sn', bookingSn)
      .select()
      .single();

    if (error) {
      console.error('Error mengupdate booking order:', error);
      return {
        success: false,
        message: `Gagal mengupdate booking order: ${error.message}`
      };
    }

    console.info(`Berhasil mengupdate booking order ${bookingSn} untuk toko ${shopId}`);
    return {
      success: true,
      message: 'Berhasil mengupdate booking order',
      data: data
    };

  } catch (error) {
    console.error('Kesalahan saat mengupdate booking order:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

/**
 * Mencari booking orders berdasarkan teks
 * @param shopId ID toko
 * @param searchText Teks pencarian
 * @param searchFields Field yang akan dicari
 * @returns Hasil pencarian
 */
export async function searchBookingOrders(
  shopId: number,
  searchText: string,
  searchFields: ('booking_sn' | 'order_sn' | 'recipient_name' | 'item_name' | 'tracking_number')[] = ['booking_sn', 'order_sn']
): Promise<{
  success: boolean;
  data?: any[];
  message?: string;
}> {
  try {
    // Validasi user authentication
    const supabaseServer = await createClient();
    const { data: { user }, error: userError } = await supabaseServer.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        message: 'User tidak terautentikasi'
      };
    }

    // Validasi akses toko
    const { data: shopData, error: shopError } = await supabase
      .from('shopee_tokens')
      .select('shop_id')
      .eq('shop_id', shopId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (shopError || !shopData) {
      return {
        success: false,
        message: 'Toko tidak ditemukan atau tidak memiliki akses'
      };
    }

    let query = supabase
      .from('booking_orders')
      .select('*')
      .eq('shop_id', shopId);

    // Build search conditions
    const conditions = [];
    
    if (searchFields.includes('booking_sn')) {
      conditions.push(`booking_sn.ilike.%${searchText}%`);
    }
    
    if (searchFields.includes('order_sn')) {
      conditions.push(`order_sn.ilike.%${searchText}%`);
    }

    if (searchFields.includes('tracking_number')) {
      conditions.push(`tracking_number.ilike.%${searchText}%`);
    }
    
    if (searchFields.includes('recipient_name')) {
      conditions.push(`recipient_address->>name.ilike.%${searchText}%`);
    }
    
    if (searchFields.includes('item_name')) {
      // Search dalam array item_list untuk item_name
      query = query.or(`item_list.cs.[{"item_name": "${searchText}"}]`);
    }

    // Apply OR condition untuk field lainnya
    if (conditions.length > 0 && !searchFields.includes('item_name')) {
      query = query.or(conditions.join(','));
    }

    const { data, error } = await query
      .order('update_time', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error mencari booking orders:', error);
      return {
        success: false,
        message: `Gagal mencari booking orders: ${error.message}`
      };
    }

    return {
      success: true,
      data: data || []
    };

  } catch (error) {
    console.error('Kesalahan saat mencari booking orders:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

/**
 * Update tracking number untuk booking order
 * @param shopId ID toko
 * @param bookingSn Booking SN
 * @param trackingNumber Nomor tracking
 * @returns Hasil operasi update
 */
export async function updateTrackingNumber(
  shopId: number,
  bookingSn: string,
  trackingNumber: string
): Promise<{
  success: boolean;
  message: string;
  data?: any;
}> {
  return updateBookingOrder(shopId, bookingSn, {
    tracking_number: trackingNumber
  });
}

/**
 * Mark dokumen sebagai sudah dicetak
 * @param shopId ID toko
 * @param bookingSnList Array booking SN yang dokumennya sudah dicetak
 * @returns Hasil operasi update
 */
export async function markDocumentsAsPrinted(
  shopId: number,
  bookingSnList: string[]
): Promise<{
  success: boolean;
  message: string;
  updatedCount?: number;
}> {
  try {
    if (!bookingSnList || bookingSnList.length === 0) {
      return {
        success: false,
        message: 'Daftar booking SN tidak boleh kosong'
      };
    }

    // Validasi user authentication
    const supabaseServer = await createClient();
    const { data: { user }, error: userError } = await supabaseServer.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        message: 'User tidak terautentikasi'
      };
    }

    // Validasi akses toko
    const { data: shopData, error: shopError } = await supabase
      .from('shopee_tokens')
      .select('shop_id')
      .eq('shop_id', shopId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (shopError || !shopData) {
      return {
        success: false,
        message: 'Toko tidak ditemukan atau tidak memiliki akses'
      };
    }

    const { data, error } = await supabase
      .from('booking_orders')
      .update({
        is_printed: true,
        document_status: 'PRINTED',
        updated_at: new Date().toISOString()
      })
      .eq('shop_id', shopId)
      .in('booking_sn', bookingSnList)
      .select();

    if (error) {
      console.error('Error mengupdate status cetak:', error);
      return {
        success: false,
        message: `Gagal mengupdate status cetak: ${error.message}`
      };
    }

    console.info(`Berhasil mengupdate status cetak untuk ${data?.length || 0} booking orders`);
    return {
      success: true,
      message: `Berhasil mengupdate status cetak untuk ${data?.length || 0} booking orders`,
      updatedCount: data?.length || 0
    };

  } catch (error) {
    console.error('Kesalahan saat mengupdate status cetak:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

/**
 * Mendapatkan booking orders yang siap untuk dicetak
 * @param shopId ID toko
 * @returns Booking orders yang siap dicetak
 */
export async function getBookingsReadyToPrint(
  shopId: number
): Promise<{
  success: boolean;
  data?: any[];
  message?: string;
  total?: number;
}> {
  return getBookingOrdersFromDB(shopId, {
    is_printed: false,
    document_status: 'READY'
  });
} 