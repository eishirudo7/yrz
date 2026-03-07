/**
 * Webhook Processor — All 9 webhook handlers
 * Extracted from /api/webhook/route.ts for queue-based processing
 */

import { Job } from 'bullmq';
import { db } from '@/db';
import { shopeeTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { upsertOrderData, upsertOrderItems, upsertLogisticData, trackingUpdate, updateDocumentStatus, withRetry, updateOrderStatusOnly, saveEscrowDetail } from '@/app/services/databaseOperations';
import { getOrderDetail, getEscrowDetail, shipBooking, createBookingShippingDocument } from '@/app/services/shopeeService';
import { redis } from '@/app/services/redis';
import { PenaltyService } from '@/app/services/penaltyService';
import { UpdateService } from '@/app/services/updateService';
import { ViolationService } from '@/app/services/violationService';
import { PremiumFeatureService } from '@/app/services/premiumFeatureService';
import { syncBookingsByBookingSns } from '@/app/services/bookingSyncs';
import { updateTrackingNumberForWebhook, updateBookingOrderForWebhook } from '@/app/services/bookingService';
import { publishSSEEvent } from '@/lib/queue/ssePublisher';

/**
 * Main processor — dispatches to correct handler based on webhook code
 */
export async function processWebhookJob(job: Job): Promise<void> {
    const webhookData = job.data;
    console.log(`[Worker] Processing job ${job.id} | code: ${webhookData.code}`);

    const handlers: { [key: number]: (data: any, job?: Job) => Promise<void> } = {
        10: handleChat,
        3: handleOrder,
        4: handleTrackingUpdate,
        15: handleDocumentUpdate,
        5: handleUpdate,
        28: handlePenalty,
        16: handleViolation,
        24: handleBookingTrackingUpdate,
        23: handleBooking,
    };

    const handler = handlers[webhookData.code] || handleOther;
    await handler(webhookData, job);
}

// ============================================================
// Helper: Get shop name (cached via Redis)
// ============================================================

async function getShopName(shopId: number): Promise<string> {
    try {
        const cacheKey = `shop_name_cache:${shopId}`;
        const cachedName = await redis.get(cacheKey);
        if (cachedName) return cachedName;

        const [shopData] = await db.select({ shopName: shopeeTokens.shopName })
            .from(shopeeTokens)
            .where(eq(shopeeTokens.shopId, shopId))
            .limit(1);

        if (shopData?.shopName) {
            await redis.set(cacheKey, shopData.shopName, 'EX', 86400);
            return shopData.shopName;
        }

        const shopNameInHash = await redis.hget(`shopee:token:${shopId}`, 'shop_name');
        if (shopNameInHash) {
            return shopNameInHash.replace(/"/g, '');
        }
    } catch (error) {
        console.error(`Error fetching shop name for ${shopId}:`, error);
    }
    return 'Toko Tidak Diketahui';
}

// ============================================================
// Handler: Chat (code 10)
// ============================================================

async function handleChat(data: any) {
    if (data.data.type === 'message') {
        const messageContent = data.data.content;
        const shopName = await getShopName(data.shop_id);

        const chatData = {
            type: 'new_message',
            message_type: messageContent.message_type,
            conversation_id: messageContent.conversation_id,
            message_id: messageContent.message_id,
            sender: messageContent.from_id,
            sender_name: messageContent.from_user_name,
            receiver: messageContent.to_id,
            receiver_name: messageContent.to_user_name,
            content: messageContent.content,
            timestamp: messageContent.created_timestamp,
            shop_id: data.shop_id,
            shop_name: shopName,
        };

        await publishSSEEvent(chatData);
    }
}

// ============================================================
// Handler: Order (code 3)
// ============================================================

async function handleOrder(data: any, job?: Job) {
    console.log('Memulai proses order:', data);
    if (job) await job.log(`[Order] Memulai proses order: ${data.data?.ordersn} | Status: ${data.data?.status}`);
    const orderData = data.data;

    try {
        if (job) await job.updateProgress(20);

        const [shopName, orderDetail] = await Promise.all([
            getShopName(data.shop_id),
            withRetry(
                () => updateOrderStatus(data.shop_id, orderData.ordersn, orderData.status, orderData.update_time),
                5,
                2000
            ),
        ]);

        if (job) await job.log(`[Order] Berhasil memperbarui status dan mengambil detail pesanan dari Shopee API.`);
        if (job) await job.updateProgress(50);

        // Escrow detail for PROCESSED, COMPLETED, CANCELLED
        if (['PROCESSED', 'COMPLETED', 'CANCELLED'].includes(orderData.status)) {
            try {
                if (job) await job.log(`[Escrow] Mengambil detail income/escrow untuk order ${orderData.ordersn}...`);
                const escrowResponse = await withRetry(
                    () => getEscrowDetail(data.shop_id, orderData.ordersn),
                    3, 2000
                );

                if (escrowResponse?.success && escrowResponse.data) {
                    await saveEscrowDetail(data.shop_id, escrowResponse.data);
                    if (job) await job.log(`[Escrow] Berhasil menyimpan detail escrow.`);
                }
            } catch (error) {
                console.error(`Error escrow detail: ${error}`);
                if (job) await job.log(`[Escrow] Gagal mengambil detail escrow: ${error}`);
            }
        }

        if (job) await job.updateProgress(80);

        if (orderData.status === 'READY_TO_SHIP') {
            if (job) await job.log(`[Event] Memicu event new_order dan Auto-Ship untuk order ${orderData.ordersn}`);
            await Promise.all([
                publishSSEEvent({
                    type: 'new_order',
                    order_sn: orderData.ordersn,
                    status: orderData.status,
                    buyer_name: orderData.buyer_username,
                    total_amount: orderData.total_amount,
                    sku: orderData.sku,
                    shop_name: shopName,
                    shop_id: data.shop_id,
                }),
                PremiumFeatureService.handleAutoShip(data.shop_id, orderData.ordersn),
            ]);
            if (job) await job.log(`[Event] Selesai memproses Auto-Ship.`);
        } else if (orderData.status === 'IN_CANCEL') {
            if (job) await job.log(`[Event] Pembatalan order terdeteksi. Memulai Auto-Chat untuk order ${orderData.ordersn}`);
            await PremiumFeatureService.handleChatCancel(
                data.shop_id,
                orderData.ordersn,
                orderDetail.buyer_user_id,
                orderDetail.buyer_username
            );
        }

        if (job) await job.updateProgress(100);
        if (job) await job.log(`[Selesai] Semua data order ${orderData.ordersn} berhasil diproses.`);
    } catch (error) {
        if (job) await job.log(`[Error] Terjadi kesalahan fatal: ${error}`);
        console.error(`Gagal memproses order ${orderData.ordersn}:`, error);
        throw error; // Let BullMQ retry
    }
}

async function updateOrderStatus(shop_id: number, ordersn: string, status: string, updateTime: number) {
    console.log(`Memulai updateOrderStatus untuk order ${ordersn}`);

    if (status === 'TO_RETURN') {
        await updateOrderStatusOnly(ordersn, status, updateTime);
        return { order_sn: ordersn, status };
    }

    const orderDetail = await withRetry(() => getOrderDetail(shop_id, ordersn), 3, 1000);

    if (!orderDetail?.order_list?.[0]) {
        throw new Error(`Data pesanan tidak ditemukan untuk ordersn: ${ordersn}`);
    }

    const orderDetailData = orderDetail.order_list[0];

    await withRetry(() => upsertOrderData(orderDetailData, shop_id), 5, 1000);
    await withRetry(() => upsertOrderItems(orderDetailData), 5, 1000);
    await withRetry(() => upsertLogisticData(orderDetailData, shop_id), 5, 1000);

    console.log(`Berhasil memperbarui semua data untuk order ${ordersn}`);
    return orderDetailData;
}

// ============================================================
// Handler: Tracking Update (code 4)
// ============================================================

async function handleTrackingUpdate(data: any): Promise<void> {
    await trackingUpdate(data);
}

// ============================================================
// Handler: Document Update (code 15)
// ============================================================

async function handleDocumentUpdate(data: any) {
    try {
        const documentData = data.data;
        const shopId = data.shop_id;
        const shopName = await getShopName(shopId);

        if (documentData.ordersn || documentData.order_sn) {
            const orderSn = documentData.ordersn || documentData.order_sn;
            await updateDocumentStatus(orderSn);

            await publishSSEEvent({
                type: 'order_document_update',
                order_sn: orderSn,
                package_number: documentData.package_number,
                status: documentData.status,
                shop_id: shopId,
                shop_name: shopName,
                timestamp: new Date().toISOString(),
            });
        }

        if (documentData.booking_sn) {
            const documentStatus = documentData.status === 'READY' ? 'READY' :
                documentData.status === 'FAILED' ? 'ERROR' : 'PENDING';

            const updateResult = await updateBookingOrderForWebhook(shopId, documentData.booking_sn, {
                document_status: documentStatus,
            });

            if (updateResult.success) {
                await publishSSEEvent({
                    type: 'booking_document_update',
                    booking_sn: documentData.booking_sn,
                    package_number: documentData.package_number,
                    status: documentData.status,
                    document_status: documentStatus,
                    shop_id: shopId,
                    shop_name: shopName,
                    timestamp: new Date().toISOString(),
                });
            }
        }
    } catch (error) {
        console.error('Error handling document update webhook:', error);
    }
}

// ============================================================
// Handler: Penalty (code 28)
// ============================================================

async function handlePenalty(data: any, job?: Job) {
    if (job) await job.log(`[Penalty] Menerima event penalty dari shop: ${data.shop_id}`);
    const shopName = await getShopName(data.shop_id);

    await publishSSEEvent({
        type: 'penalty',
        ...data,
        shop_name: shopName,
    });

    await PenaltyService.handlePenalty({
        ...data,
        shop_name: shopName,
    });
    if (job) await job.log(`[Penalty] Berhasil memproses penalty.`);
    if (job) await job.updateProgress(100);
}

// ============================================================
// Handler: Update (code 5)
// ============================================================

async function handleUpdate(data: any, job?: Job) {
    if (job) await job.log(`[Update] Menerima pembaruan data dari shop: ${data.shop_id}`);
    const shopName = await getShopName(data.shop_id);

    await publishSSEEvent({
        type: 'update',
        ...data,
        shop_name: shopName,
    });

    await UpdateService.handleUpdate({
        ...data,
        shop_name: shopName,
    });
    if (job) await job.log(`[Update] Selesai.`);
    if (job) await job.updateProgress(100);
}

// ============================================================
// Handler: Violation (code 16)
// ============================================================

async function handleViolation(data: any, job?: Job) {
    if (job) await job.log(`[Violation] Ada pelanggaran dari shop: ${data.shop_id}`);
    const shopName = await getShopName(data.shop_id);

    await publishSSEEvent({
        type: 'violation',
        ...data,
        shop_name: shopName,
    });

    await ViolationService.handleViolation({
        ...data,
        shop_name: shopName,
    });
    if (job) await job.log(`[Violation] Penanganan pelanggaran selesai.`);
    if (job) await job.updateProgress(100);
}

// ============================================================
// Handler: Booking Tracking Update (code 24)
// ============================================================

async function handleBookingTrackingUpdate(data: any) {
    try {
        const bookingData = data.data;
        const shopId = data.shop_id;

        const bookingSn = bookingData.booking_sn;
        const trackingNumber = bookingData.tracking_number || bookingData.tracking_no;

        if (!bookingSn || !trackingNumber) {
            console.warn('Missing booking_sn or tracking number:', bookingData);
            return;
        }

        const updateResult = await updateTrackingNumberForWebhook(shopId, bookingSn, trackingNumber);

        if (updateResult.success) {
            try {
                const documentResult = await createBookingShippingDocument(
                    shopId,
                    [{ booking_sn: bookingSn, tracking_number: trackingNumber }],
                    'THERMAL_AIR_WAYBILL'
                );

                if (documentResult.success) {
                    await updateBookingOrderForWebhook(shopId, bookingSn, {
                        document_status: 'READY',
                    });
                }
            } catch (error) {
                console.error(`Error creating shipping doc for booking ${bookingSn}:`, error);
            }
        }
    } catch (error) {
        console.error('Error handling booking tracking update:', error);
    }
}

// ============================================================
// Handler: Booking (code 23)
// ============================================================

async function handleBooking(data: any) {
    try {
        const bookingData = data.data;
        const shopId = data.shop_id;
        const shopName = await getShopName(shopId);

        if (bookingData.booking_sn) {
            const bookingSns = Array.isArray(bookingData.booking_sn)
                ? bookingData.booking_sn
                : [bookingData.booking_sn];

            await syncBookingsByBookingSns(shopId, bookingSns, {
                onProgress: (progress) => {
                    console.log(`Booking sync progress: ${progress.current}/${progress.total}`);
                },
            });

            if (bookingData.booking_status === 'READY_TO_SHIP') {
                try {
                    const shipResult = await shipBooking(shopId, bookingData.booking_sn, 'dropoff');

                    if (shipResult.success) {
                        await publishSSEEvent({
                            type: 'booking_auto_shipped',
                            booking_sn: bookingData.booking_sn,
                            shop_id: shopId,
                            shop_name: shopName,
                            timestamp: new Date().toISOString(),
                        });
                    }
                } catch (error) {
                    console.error(`Error auto-ship booking ${bookingData.booking_sn}:`, error);
                }
            }

            await publishSSEEvent({
                type: 'booking_update',
                booking_sn: bookingData.booking_sn,
                booking_status: bookingData.booking_status,
                shop_id: shopId,
                shop_name: shopName,
                timestamp: new Date().toISOString(),
            });
        }
    } catch (error) {
        console.error('Error handling booking webhook:', error);
    }
}

// ============================================================
// Handler: Other (unknown codes)
// ============================================================

async function handleOther(data: any) {
    console.log('[Worker] Handling unknown webhook code:', data.code);
}
