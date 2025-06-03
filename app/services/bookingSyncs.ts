import { getBookingList, getBookingDetail, getBookingTrackingNumber } from '@/app/services/shopeeService';
import { saveBookingOrders, updateTrackingNumber } from '@/app/services/bookingService';

interface BookingSyncOptions {
  timeRangeField?: 'create_time' | 'update_time';
  startTime?: number;
  endTime?: number;
  bookingStatus?: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'ALL';
  pageSize?: number;
  onProgress?: (progress: { current: number; total: number }) => void;
  onError?: (error: string) => void;
}

interface ShopeeBooking {
  booking_sn: string;
  [key: string]: any;
}

interface BookingListResponse {
  success: boolean;
  data?: {
    booking_list: ShopeeBooking[];
    more: boolean;
    next_cursor: string;
  };
  message?: string;
}

async function processBookingDetails(shopId: number, bookingSns: string[]) {
  try {
    // Ambil detail booking dari Shopee API
    const response = await getBookingDetail(shopId, bookingSns);
    
    if (!response.success || !response.data?.booking_list) {
      throw new Error(response.message || `Data booking kosong untuk bookings: ${bookingSns.join(',')}`);
    }

    const bookings = response.data.booking_list;

    const results = await Promise.all(bookings.map(async (bookingData: ShopeeBooking) => {
      try {
        if (!bookingData.booking_sn) {
          throw new Error(`Data booking tidak memiliki booking_sn yang valid`);
        }

        // Simpan data booking ke database
        const saveResult = await saveBookingOrders([bookingData], shopId);
        
        if (!saveResult.success) {
          throw new Error(saveResult.message || 'Gagal menyimpan booking order');
        }

        // SELALU coba ambil tracking number untuk semua booking, tidak peduli statusnya
        try {
          const trackingResponse = await getBookingTrackingNumber(shopId, bookingData.booking_sn);
          
          if (trackingResponse.success && trackingResponse.data?.tracking_number) {
            await updateTrackingNumber(shopId, bookingData.booking_sn, trackingResponse.data.tracking_number);
            console.info(`Updated tracking number untuk booking ${bookingData.booking_sn}: ${trackingResponse.data.tracking_number}`);
            // Note: Document status tetap PENDING, tidak diubah dari sinkronisasi
          } else {
            console.info(`Tracking number belum tersedia untuk booking ${bookingData.booking_sn} (status: ${bookingData.booking_status})`);
          }
        } catch (trackingError) {
          console.error(`Gagal mengambil tracking number untuk booking ${bookingData.booking_sn}:`, trackingError);
          // Tidak throw error karena booking tetap tersimpan
        }
        
        return { bookingSn: bookingData.booking_sn, success: true };
      } catch (error) {
        console.error(`Gagal memproses booking ${bookingData.booking_sn}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return { bookingSn: bookingData.booking_sn, success: false };
      }
    }));

    return results;
  } catch (error) {
    console.error(`Gagal memproses batch booking: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return bookingSns.map(sn => ({ bookingSn: sn, success: false }));
  }
}

interface SyncBookingsResult {
  success: boolean;
  data?: {
    total: number;
    processed: number;
    bookingSns: string[];
  };
  error?: string;
}

export async function syncBookings(shopId: number, options: BookingSyncOptions = {}): Promise<SyncBookingsResult> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const syncOptions = {
      timeRangeField: 'create_time' as const,
      startTime: now - (7 * 24 * 60 * 60), // Default 7 hari terakhir
      endTime: now,
      bookingStatus: 'ALL' as const,
      pageSize: 50,
      ...options
    };

    let processedCount = 0;
    let totalBookings = 0;
    const processedBookings: string[] = [];

    console.info(`[BookingSync] Memulai sinkronisasi booking untuk shopId: ${shopId}`);

    // Ambil data pertama untuk mendapatkan total bookings
    const initialResponse = await getBookingList(shopId, { 
      ...syncOptions, 
      cursor: '' 
    }) as BookingListResponse;

    if (!initialResponse.success || !initialResponse.data) {
      throw new Error(initialResponse.message || 'Gagal mengambil daftar booking');
    }

    // Set total awal
    totalBookings = initialResponse.data.booking_list.length;
    console.info(`[BookingSync] Total booking ditemukan: ${totalBookings}`);
    
    // Update progress awal
    if (options.onProgress) {
      options.onProgress({ 
        current: 0, 
        total: totalBookings 
      });
    }

    // Jika tidak ada booking, return sukses
    if (totalBookings === 0) {
      return {
        success: true,
        data: {
          total: 0,
          processed: 0,
          bookingSns: []
        }
      };
    }

    // Mulai proses sync
    let hasMore = initialResponse.data.more;
    let cursor = initialResponse.data.next_cursor;

    // Proses batch pertama
    const BATCH_SIZE = 20; // Lebih kecil untuk booking detail yang lebih kompleks
    const firstBatch = initialResponse.data.booking_list;
    
    for (let i = 0; i < firstBatch.length; i += BATCH_SIZE) {
      const bookingBatch = firstBatch.slice(i, i + BATCH_SIZE);
      const results = await processBookingDetails(shopId, bookingBatch.map(b => b.booking_sn));
      
      results.forEach(result => {
        if (result.success) {
          processedCount++;
          processedBookings.push(result.bookingSn);
        }
      });

      if (options.onProgress) {
        options.onProgress({ 
          current: processedCount, 
          total: totalBookings 
        });
      }
    }

    // Proses batch selanjutnya jika ada
    while (hasMore) {
      const response = await getBookingList(shopId, { ...syncOptions, cursor }) as BookingListResponse;
      
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Gagal mengambil daftar booking');
      }

      // Update total bookings
      totalBookings += response.data.booking_list.length;

      for (let i = 0; i < response.data.booking_list.length; i += BATCH_SIZE) {
        const bookingBatch = response.data.booking_list.slice(i, i + BATCH_SIZE);
        const results = await processBookingDetails(shopId, bookingBatch.map(b => b.booking_sn));
        
        results.forEach(result => {
          if (result.success) {
            processedCount++;
            processedBookings.push(result.bookingSn);
          }
        });

        if (options.onProgress) {
          options.onProgress({ 
            current: processedCount, 
            total: totalBookings 
          });
        }
      }

      hasMore = response.data.more;
      cursor = response.data.next_cursor;
    }

    console.info(`[BookingSync] Selesai sinkronisasi booking untuk shopId: ${shopId}. Processed: ${processedCount}/${totalBookings}`);

    return {
      success: true,
      data: {
        total: totalBookings,
        processed: processedCount,
        bookingSns: processedBookings
      }
    };

  } catch (error) {
    console.error(`[BookingSync] Error sinkronisasi booking untuk shopId: ${shopId}:`, error);
    
    if (options.onError) {
      options.onError(error instanceof Error ? error.message : 'Unknown error');
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
}

export async function syncBookingsByBookingSns(
  shopId: number, 
  bookingSns: string[], 
  options: Omit<BookingSyncOptions, 'timeRangeField' | 'startTime' | 'endTime' | 'bookingStatus' | 'pageSize'> = {}
): Promise<SyncBookingsResult> {
  try {
    console.info(`[BookingSync] Memulai sinkronisasi booking spesifik untuk shopId: ${shopId}, bookings: ${bookingSns.length}`);
    
    if (!bookingSns || bookingSns.length === 0) {
      return {
        success: true,
        data: {
          total: 0,
          processed: 0,
          bookingSns: []
        }
      };
    }

    let processedCount = 0;
    const processedBookings: string[] = [];
    const totalBookings = bookingSns.length;

    // Update progress awal
    if (options.onProgress) {
      options.onProgress({ 
        current: 0, 
        total: totalBookings 
      });
    }

    // Proses booking dalam batch
    const BATCH_SIZE = 20;
    for (let i = 0; i < bookingSns.length; i += BATCH_SIZE) {
      const bookingBatch = bookingSns.slice(i, i + BATCH_SIZE);
      const results = await processBookingDetails(shopId, bookingBatch);
      
      results.forEach(result => {
        if (result.success) {
          processedCount++;
          processedBookings.push(result.bookingSn);
        }
      });

      if (options.onProgress) {
        options.onProgress({ 
          current: processedCount, 
          total: totalBookings 
        });
      }
    }

    console.info(`[BookingSync] Selesai sinkronisasi booking spesifik untuk shopId: ${shopId}. Processed: ${processedCount}/${totalBookings}`);

    return {
      success: true,
      data: {
        total: totalBookings,
        processed: processedCount,
        bookingSns: processedBookings
      }
    };

  } catch (error) {
    console.error(`[BookingSync] Error sinkronisasi booking spesifik untuk shopId: ${shopId}:`, error);
    
    if (options.onError) {
      options.onError(error instanceof Error ? error.message : 'Unknown error');
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui'
    };
  }
} 