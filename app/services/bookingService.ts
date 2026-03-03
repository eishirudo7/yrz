import { db } from '@/db';
import { bookingOrders, shopeeTokens } from '@/db/schema';
import { eq, and, desc, gte, lte, inArray, ilike, or, sql, count } from 'drizzle-orm';
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
 * Helper: validasi user authentication dan akses toko
 */
async function validateShopAccess(shopId: number): Promise<{ success: boolean; message?: string; userId?: string }> {
  const supabaseServer = await createClient();
  const { data: { user }, error: userError } = await supabaseServer.auth.getUser();

  if (userError || !user) {
    return { success: false, message: 'User tidak terautentikasi' };
  }

  const [shopData] = await db.select({ shopId: shopeeTokens.shopId })
    .from(shopeeTokens)
    .where(and(
      eq(shopeeTokens.shopId, shopId),
      eq(shopeeTokens.userId, user.id),
      eq(shopeeTokens.isActive, true),
    ))
    .limit(1);

  if (!shopData) {
    return { success: false, message: 'Toko tidak ditemukan atau tidak memiliki akses' };
  }

  return { success: true, userId: user.id };
}

/**
 * Menyimpan data booking orders ke database
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
      return { success: false, message: 'Data booking kosong' };
    }

    let savedCount = 0;

    for (const booking of bookings) {
      const data = {
        shopId: shopId,
        bookingSn: booking.booking_sn,
        orderSn: booking.order_sn || null,
        region: booking.region || null,
        bookingStatus: booking.booking_status || null,
        matchStatus: booking.match_status || null,
        shippingCarrier: booking.shipping_carrier || null,
        createTime: booking.create_time || null,
        updateTime: booking.update_time || null,
        recipientAddress: booking.recipient_address || null,
        itemList: booking.item_list || null,
        dropshipper: booking.dropshipper || null,
        dropshipperPhone: booking.dropshipper_phone || null,
        cancelBy: booking.cancel_by || null,
        cancelReason: booking.cancel_reason || null,
        fulfillmentFlag: booking.fulfillment_flag || null,
        pickupDoneTime: booking.pickup_done_time || null,
        trackingNumber: booking.tracking_number || null,
        isPrinted: booking.is_printed || false,
        documentStatus: booking.document_status || 'PENDING',
      };

      await db.insert(bookingOrders)
        .values(data)
        .onConflictDoUpdate({
          target: [bookingOrders.shopId, bookingOrders.bookingSn],
          set: data,
        });

      savedCount++;
    }

    console.info(`Berhasil menyimpan ${savedCount} booking orders untuk toko ${shopId}`);
    return {
      success: true,
      message: `Berhasil menyimpan ${savedCount} booking orders`,
      savedCount,
    };

  } catch (error) {
    console.error('Kesalahan saat menyimpan booking orders:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui',
      errors: [error],
    };
  }
}

/**
 * Mengambil booking orders dari database berdasarkan filter
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
    const validation = await validateShopAccess(shopId);
    if (!validation.success) {
      return { success: false, message: validation.message };
    }

    // Build where conditions
    const conditions = [eq(bookingOrders.shopId, shopId)];

    if (filters.booking_status) {
      conditions.push(eq(bookingOrders.bookingStatus, filters.booking_status));
    }
    if (filters.booking_sn) {
      conditions.push(eq(bookingOrders.bookingSn, filters.booking_sn));
    }
    if (filters.order_sn) {
      conditions.push(eq(bookingOrders.orderSn, filters.order_sn));
    }
    if (filters.tracking_number) {
      conditions.push(eq(bookingOrders.trackingNumber, filters.tracking_number));
    }
    if (filters.is_printed !== undefined) {
      conditions.push(eq(bookingOrders.isPrinted, filters.is_printed));
    }
    if (filters.document_status) {
      conditions.push(eq(bookingOrders.documentStatus, filters.document_status));
    }
    if (filters.date_from && filters.date_to) {
      const fromTimestamp = Math.floor(new Date(filters.date_from).getTime() / 1000);
      const toTimestamp = Math.floor(new Date(filters.date_to).getTime() / 1000);
      conditions.push(gte(bookingOrders.createTime, fromTimestamp));
      conditions.push(lte(bookingOrders.createTime, toTimestamp));
    }

    const whereClause = and(...conditions);
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    // Get data
    const data = await db.select()
      .from(bookingOrders)
      .where(whereClause)
      .orderBy(desc(bookingOrders.updateTime))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ total }] = await db.select({ total: count() })
      .from(bookingOrders)
      .where(whereClause);

    return {
      success: true,
      data: data || [],
      total: total || 0,
    };

  } catch (error) {
    console.error('Kesalahan saat mengambil booking orders:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui',
    };
  }
}

/**
 * Menghapus booking orders dari database
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
      return { success: false, message: 'Daftar booking SN tidak boleh kosong' };
    }

    const validation = await validateShopAccess(shopId);
    if (!validation.success) {
      return { success: false, message: validation.message! };
    }

    const deleted = await db.delete(bookingOrders)
      .where(and(
        eq(bookingOrders.shopId, shopId),
        inArray(bookingOrders.bookingSn, bookingSnList),
      ))
      .returning();

    console.info(`Berhasil menghapus ${deleted.length} booking orders untuk toko ${shopId}`);
    return {
      success: true,
      message: `Berhasil menghapus ${deleted.length} booking orders`,
      deletedCount: deleted.length,
    };

  } catch (error) {
    console.error('Kesalahan saat menghapus booking orders:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui',
    };
  }
}

/**
 * Mengupdate status booking order (dengan auth check)
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
    const validation = await validateShopAccess(shopId);
    if (!validation.success) {
      return { success: false, message: validation.message! };
    }

    // Map snake_case fields to camelCase for Drizzle
    const setData: Record<string, any> = { updatedAt: new Date() };
    if (updateData.tracking_number !== undefined) setData.trackingNumber = updateData.tracking_number;
    if (updateData.booking_status !== undefined) setData.bookingStatus = updateData.booking_status;
    if (updateData.match_status !== undefined) setData.matchStatus = updateData.match_status;
    if (updateData.order_sn !== undefined) setData.orderSn = updateData.order_sn;
    if (updateData.is_printed !== undefined) setData.isPrinted = updateData.is_printed;
    if (updateData.document_status !== undefined) setData.documentStatus = updateData.document_status;
    if (updateData.update_time !== undefined) setData.updateTime = updateData.update_time;
    if (updateData.pickup_done_time !== undefined) setData.pickupDoneTime = updateData.pickup_done_time;
    if (updateData.cancel_by !== undefined) setData.cancelBy = updateData.cancel_by;
    if (updateData.cancel_reason !== undefined) setData.cancelReason = updateData.cancel_reason;
    if (updateData.fulfillment_flag !== undefined) setData.fulfillmentFlag = updateData.fulfillment_flag;
    if (updateData.shipping_carrier !== undefined) setData.shippingCarrier = updateData.shipping_carrier;
    if (updateData.recipient_address !== undefined) setData.recipientAddress = updateData.recipient_address;
    if (updateData.item_list !== undefined) setData.itemList = updateData.item_list;

    const [updated] = await db.update(bookingOrders)
      .set(setData)
      .where(and(
        eq(bookingOrders.shopId, shopId),
        eq(bookingOrders.bookingSn, bookingSn),
      ))
      .returning();

    if (!updated) {
      return { success: false, message: 'Booking order tidak ditemukan' };
    }

    console.info(`Berhasil mengupdate booking order ${bookingSn} untuk toko ${shopId}`);
    return {
      success: true,
      message: 'Berhasil mengupdate booking order',
      data: updated,
    };

  } catch (error) {
    console.error('Kesalahan saat mengupdate booking order:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui',
    };
  }
}

/**
 * Mencari booking orders berdasarkan teks
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
    const validation = await validateShopAccess(shopId);
    if (!validation.success) {
      return { success: false, message: validation.message };
    }

    // Build search OR conditions
    const searchConditions = [];

    if (searchFields.includes('booking_sn')) {
      searchConditions.push(ilike(bookingOrders.bookingSn, `%${searchText}%`));
    }
    if (searchFields.includes('order_sn')) {
      searchConditions.push(ilike(bookingOrders.orderSn, `%${searchText}%`));
    }
    if (searchFields.includes('tracking_number')) {
      searchConditions.push(ilike(bookingOrders.trackingNumber, `%${searchText}%`));
    }
    if (searchFields.includes('recipient_name')) {
      searchConditions.push(sql`${bookingOrders.recipientAddress}->>'name' ILIKE ${'%' + searchText + '%'}`);
    }
    if (searchFields.includes('item_name')) {
      searchConditions.push(sql`${bookingOrders.itemList}::text ILIKE ${'%' + searchText + '%'}`);
    }

    const whereClause = searchConditions.length > 0
      ? and(eq(bookingOrders.shopId, shopId), or(...searchConditions))
      : eq(bookingOrders.shopId, shopId);

    const data = await db.select()
      .from(bookingOrders)
      .where(whereClause)
      .orderBy(desc(bookingOrders.updateTime))
      .limit(100);

    return { success: true, data: data || [] };

  } catch (error) {
    console.error('Kesalahan saat mencari booking orders:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui',
    };
  }
}

/**
 * Update tracking number
 */
export async function updateTrackingNumber(
  shopId: number,
  bookingSn: string,
  trackingNumber: string
): Promise<{ success: boolean; message: string; data?: any }> {
  return updateBookingOrder(shopId, bookingSn, { tracking_number: trackingNumber });
}

/**
 * Update tracking number (khusus webhook - tanpa auth)
 */
export async function updateTrackingNumberForWebhook(
  shopId: number,
  bookingSn: string,
  trackingNumber: string
): Promise<{ success: boolean; message: string; data?: any }> {
  return updateBookingOrderForWebhook(shopId, bookingSn, { tracking_number: trackingNumber });
}

/**
 * Update booking order (khusus webhook - tanpa auth)
 */
export async function updateBookingOrderForWebhook(
  shopId: number,
  bookingSn: string,
  updateData: Partial<BookingOrderData>
): Promise<{
  success: boolean;
  message: string;
  data?: any;
}> {
  try {
    const setData: Record<string, any> = { updatedAt: new Date() };
    if (updateData.tracking_number !== undefined) setData.trackingNumber = updateData.tracking_number;
    if (updateData.booking_status !== undefined) setData.bookingStatus = updateData.booking_status;
    if (updateData.match_status !== undefined) setData.matchStatus = updateData.match_status;
    if (updateData.order_sn !== undefined) setData.orderSn = updateData.order_sn;
    if (updateData.is_printed !== undefined) setData.isPrinted = updateData.is_printed;
    if (updateData.document_status !== undefined) setData.documentStatus = updateData.document_status;
    if (updateData.update_time !== undefined) setData.updateTime = updateData.update_time;
    if (updateData.pickup_done_time !== undefined) setData.pickupDoneTime = updateData.pickup_done_time;
    if (updateData.cancel_by !== undefined) setData.cancelBy = updateData.cancel_by;
    if (updateData.cancel_reason !== undefined) setData.cancelReason = updateData.cancel_reason;
    if (updateData.fulfillment_flag !== undefined) setData.fulfillmentFlag = updateData.fulfillment_flag;
    if (updateData.shipping_carrier !== undefined) setData.shippingCarrier = updateData.shipping_carrier;

    const [updated] = await db.update(bookingOrders)
      .set(setData)
      .where(and(
        eq(bookingOrders.shopId, shopId),
        eq(bookingOrders.bookingSn, bookingSn),
      ))
      .returning();

    if (!updated) {
      return { success: false, message: 'Booking order tidak ditemukan' };
    }

    console.info(`Berhasil mengupdate booking order ${bookingSn} untuk toko ${shopId} via webhook`);
    return {
      success: true,
      message: 'Berhasil mengupdate booking order',
      data: updated,
    };

  } catch (error) {
    console.error('Kesalahan saat mengupdate booking order via webhook:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui',
    };
  }
}

/**
 * Mark dokumen sebagai sudah dicetak
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
      return { success: false, message: 'Daftar booking SN tidak boleh kosong' };
    }

    const validation = await validateShopAccess(shopId);
    if (!validation.success) {
      return { success: false, message: validation.message! };
    }

    const updated = await db.update(bookingOrders)
      .set({
        isPrinted: true,
        documentStatus: 'PRINTED',
        updatedAt: new Date(),
      })
      .where(and(
        eq(bookingOrders.shopId, shopId),
        inArray(bookingOrders.bookingSn, bookingSnList),
      ))
      .returning();

    console.info(`Berhasil mengupdate status cetak untuk ${updated.length} booking orders`);
    return {
      success: true,
      message: `Berhasil mengupdate status cetak untuk ${updated.length} booking orders`,
      updatedCount: updated.length,
    };

  } catch (error) {
    console.error('Kesalahan saat mengupdate status cetak:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui',
    };
  }
}

/**
 * Mendapatkan booking orders yang siap untuk dicetak
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
    document_status: 'READY',
  });
}