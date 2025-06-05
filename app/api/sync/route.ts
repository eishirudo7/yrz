import { NextRequest, NextResponse } from 'next/server';
import { syncOrders, syncOrdersByOrderSns } from '@/app/services/orderSyncs';
import { syncBookings, syncBookingsByBookingSns } from '@/app/services/bookingSyncs';

// Interface untuk request body
interface SyncRequestBody {
  shopId: number;
  orderSns?: string[];
  bookingSns?: string[];
  includeBookings?: boolean;
}

// Validasi input
function validateInput(body: any): { isValid: boolean; error?: string } {
  if (!body.shopId || typeof body.shopId !== 'number') {
    return { isValid: false, error: 'shopId harus berupa angka' };
  }

  if (body.orderSns && !Array.isArray(body.orderSns)) {
    return { isValid: false, error: 'orderSns harus berupa array' };
  }

  if (body.orderSns && body.orderSns.some((sn: string) => typeof sn !== 'string')) {
    return { isValid: false, error: 'Semua orderSns harus berupa string' };
  }

  if (body.bookingSns && !Array.isArray(body.bookingSns)) {
    return { isValid: false, error: 'bookingSns harus berupa array' };
  }

  if (body.bookingSns && body.bookingSns.some((sn: string) => typeof sn !== 'string')) {
    return { isValid: false, error: 'Semua bookingSns harus berupa string' };
  }

  return { isValid: true };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    
    // Validasi input
    const validation = validateInput(body);
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          success: false,
          error: validation.error,
          data: {
            total: 0,
            success: 0,
            failed: 0
          }
        },
        { status: 400 }
      );
    }

    const { shopId, orderSns, bookingSns, includeBookings = true } = body as SyncRequestBody;

    // Log request
    console.log(`[Sync API] Memulai sinkronisasi untuk shopId: ${shopId}`);
    console.log(`- Orders: ${orderSns?.length || 'all'}`);
    console.log(`- Bookings: ${bookingSns?.length || (includeBookings ? 'all' : 'none')}`);

    // Buat streaming response
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        let totalOrdersProcessed = 0;
        let totalBookingsProcessed = 0;
        let totalOrdersCount = 0;
        let totalBookingsCount = 0;
        let currentPhase = '';

        // Function untuk mengirim progress update
        const sendProgress = (phase: string, current: number, total: number, type: 'orders' | 'bookings') => {
          const progress = {
            phase,
            type,
            processed: current,
            total: total,
            percentage: total > 0 ? Math.round((current / total) * 100) : 0,
            timestamp: new Date().toISOString()
          };
          
          controller.enqueue(encoder.encode(JSON.stringify(progress) + '\n'));
        };

        // Function untuk mengirim progress gabungan
        const sendCombinedProgress = () => {
          const totalProcessed = totalOrdersProcessed + totalBookingsProcessed;
          const totalCount = totalOrdersCount + totalBookingsCount;
          
          const progress = {
            phase: currentPhase,
            type: 'combined' as const,
            processed: totalProcessed,
            total: totalCount,
            percentage: totalCount > 0 ? Math.round((totalProcessed / totalCount) * 100) : 0,
            details: {
              orders: { processed: totalOrdersProcessed, total: totalOrdersCount },
              bookings: { processed: totalBookingsProcessed, total: totalBookingsCount }
            },
            timestamp: new Date().toISOString()
          };
          
          controller.enqueue(encoder.encode(JSON.stringify(progress) + '\n'));
        };

        try {
          // PHASE 1: Sinkronisasi Orders
          currentPhase = 'Mensinkronkan Orders';
          sendProgress(currentPhase, 0, 0, 'orders');

          let orderResult;
    if (!orderSns || orderSns.length === 0) {
            orderResult = await syncOrders(shopId, {
              onProgress: (progress) => {
                totalOrdersProcessed = progress.current;
                totalOrdersCount = progress.total;
                sendProgress(currentPhase, progress.current, progress.total, 'orders');
                sendCombinedProgress();
              }
            });
          } else {
            orderResult = await syncOrdersByOrderSns(shopId, orderSns, {
              onProgress: (progress) => {
                totalOrdersProcessed = progress.current;
                totalOrdersCount = progress.total;
                sendProgress(currentPhase, progress.current, progress.total, 'orders');
                sendCombinedProgress();
              }
            });
          }

          if (!orderResult.success) {
            throw new Error(`Gagal sinkronisasi orders: ${orderResult.error}`);
          }

          // Update final orders count
          totalOrdersProcessed = orderResult.data?.processed || 0;
          totalOrdersCount = orderResult.data?.total || 0;

          // PHASE 2: Sinkronisasi Bookings (jika diminta)
          if (includeBookings) {
            currentPhase = 'Mensinkronkan Booking Orders';
            sendProgress(currentPhase, 0, 0, 'bookings');

            let bookingResult;
            if (!bookingSns || bookingSns.length === 0) {
              bookingResult = await syncBookings(shopId, {
                includeTracking: true,
                onProgress: (progress) => {
                  totalBookingsProcessed = progress.current;
                  totalBookingsCount = progress.total;
                  sendProgress(currentPhase, progress.current, progress.total, 'bookings');
                  sendCombinedProgress();
                }
              });
            } else {
              bookingResult = await syncBookingsByBookingSns(shopId, bookingSns, {
                includeTracking: true,
                onProgress: (progress) => {
                  totalBookingsProcessed = progress.current;
                  totalBookingsCount = progress.total;
                  sendProgress(currentPhase, progress.current, progress.total, 'bookings');
                  sendCombinedProgress();
                }
              });
            }

            if (!bookingResult.success) {
              console.error(`Gagal sinkronisasi bookings: ${bookingResult.error}`);
              // Tidak throw error, karena orders sudah berhasil
    } else {
              totalBookingsProcessed = bookingResult.data?.processed || 0;
              totalBookingsCount = bookingResult.data?.total || 0;
            }
          }

          // PHASE 3: Selesai
          currentPhase = 'Sinkronisasi Selesai';
          sendCombinedProgress();

          // Kirim hasil akhir
          const finalResult = {
            success: true,
            completed: true,
          data: {
              orders: {
                total: totalOrdersCount,
                processed: totalOrdersProcessed,
                success: totalOrdersProcessed,
                failed: totalOrdersCount - totalOrdersProcessed
              },
              bookings: includeBookings ? {
                total: totalBookingsCount,
                processed: totalBookingsProcessed,
                success: totalBookingsProcessed,
                failed: totalBookingsCount - totalBookingsProcessed
              } : null,
              summary: {
                total: totalOrdersCount + totalBookingsCount,
                processed: totalOrdersProcessed + totalBookingsProcessed,
                success: totalOrdersProcessed + totalBookingsProcessed,
                failed: (totalOrdersCount + totalBookingsCount) - (totalOrdersProcessed + totalBookingsProcessed)
              }
          },
          metadata: {
            timestamp: new Date().toISOString(),
            processingTime: Date.now() - startTime
          }
          };

          controller.enqueue(encoder.encode(JSON.stringify(finalResult) + '\n'));

          console.log(`[Sync API] Selesai sinkronisasi untuk shopId: ${shopId}`);
          console.log(`- Orders processed: ${totalOrdersProcessed}/${totalOrdersCount}`);
          console.log(`- Bookings processed: ${totalBookingsProcessed}/${totalBookingsCount}`);

        } catch (error) {
          console.error('[Sync API] Error:', error);
          
          const errorResult = {
            success: false,
            error: error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui',
      data: {
              orders: {
                total: totalOrdersCount,
                processed: totalOrdersProcessed,
                success: totalOrdersProcessed,
                failed: totalOrdersCount - totalOrdersProcessed
              },
              bookings: includeBookings ? {
                total: totalBookingsCount,
                processed: totalBookingsProcessed,
                success: totalBookingsProcessed,
                failed: totalBookingsCount - totalBookingsProcessed
              } : null
      },
      metadata: {
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      }
          };

          controller.enqueue(encoder.encode(JSON.stringify(errorResult) + '\n'));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
      },
    });

  } catch (error) {
    console.error('[Sync API] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Terjadi kesalahan internal server',
        data: {
          total: 0,
          success: 0,
          failed: 0
        },
        metadata: {
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime
        }
      },
      { status: 500 }
    );
  }
}

// Handler OPTIONS untuk CORS
export async function OPTIONS() {
  const response = new NextResponse(null, {
    status: 204,
  });
  
  // Security headers
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  return response;
}
