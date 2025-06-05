import { NextRequest, NextResponse } from 'next/server';
import { upsertOrderData, upsertOrderItems, upsertLogisticData, trackingUpdate, updateDocumentStatus, withRetry, updateOrderStatusOnly, saveEscrowDetail } from '@/app/services/databaseOperations';
import { getOrderDetail } from '@/app/services/shopeeService';
import { getEscrowDetail, shipBooking, createBookingShippingDocument } from '@/app/services/shopeeService';
import { redis } from '@/app/services/redis';
import { PenaltyService } from '@/app/services/penaltyService';
import { UpdateService } from '@/app/services/updateService';
import { ViolationService } from '@/app/services/violationService';
import { sendEventToShopOwners } from '@/app/services/serverSSEService';
import { PremiumFeatureService } from '@/app/services/premiumFeatureService';
import { syncBookingsByBookingSns } from '@/app/services/bookingSyncs';
import { updateTrackingNumberForWebhook, updateBookingOrderForWebhook } from '@/app/services/bookingService';

export async function POST(req: NextRequest) {
  // Segera kirim respons 200
  const res = NextResponse.json({ received: true }, { status: 200 });
  
  // Proses data webhook secara asinkron
  const webhookData = await req.json();
  processWebhookData(webhookData).catch(error => {
    console.error('Error processing webhook data:', error);
  });

  return res;
}

async function processWebhookData(webhookData: any) {
  console.log('Webhoook diterima : ', webhookData);
  try {
    const code = webhookData.code;
    
    const handlers: { [key: number]: (data: any) => Promise<void> } = {
      10: handleChat,
      3: handleOrder,
      4: handleTrackingUpdate,
      15: handleDocumentUpdate,
      5: handleUpdate,
      28: handlePenalty,
      16: handleViolation,
      24: handleBookingTrackingUpdate,
      23: handleBooking
    };

    const handler = handlers[code] || handleOther;
    await handler(webhookData);
  } catch (error) {
    console.error('Error processing webhook data:', error);
  }
}

async function handleChat(data: any) {
  if (data.data.type === 'message') {
    const messageContent = data.data.content;
    
    // Ambil data auto_ship untuk mendapatkan nama toko
    const autoShipData = await redis.get('auto_ship');
    let shopName = '';
    
    if (autoShipData) {
      const shops = JSON.parse(autoShipData);
      const shop = shops.find((s: any) => s.shop_id === data.shop_id);
      if (shop) {
        shopName = shop.shop_name;
      }
    }

    // Format data untuk SSE - termasuk data yang diperlukan untuk updateConversationWithMessage
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
    
    // Kirim event ke semua klien terkoneksi
    sendEventToShopOwners(chatData);
  }
}

async function handleOrder(data: any) {
  console.log('Memulai proses order:', data);
  const orderData = data.data;
  
  try {
    // Jalankan kedua operasi ini secara paralel
    const [autoShipData, orderDetail] = await Promise.all([
      redis.get('auto_ship'),
      withRetry(
        () => updateOrderStatus(data.shop_id, orderData.ordersn, orderData.status, orderData.update_time),
        5,
        2000
      )
    ]);

    let shopName = '';
    if (autoShipData) {
      const shops = JSON.parse(autoShipData);
      const shop = shops.find((s: any) => s.shop_id === data.shop_id);
      shopName = shop?.shop_name || '';
    }

    // Ambil dan simpan escrow detail jika status PROCESSED, COMPLETED, atau CANCELED
    if (orderData.status === 'PROCESSED' || orderData.status === 'COMPLETED' || orderData.status === 'CANCELLED') {
      try {
        console.log(`Mengambil detail escrow untuk order: ${orderData.ordersn} dengan status ${orderData.status}`);
        const escrowResponse = await withRetry(
          () => getEscrowDetail(data.shop_id, orderData.ordersn),
          3,
          2000
        );
        
        if (escrowResponse && escrowResponse.success && escrowResponse.data) {
          await saveEscrowDetail(data.shop_id, escrowResponse.data);
        } else {
          console.error(`Gagal mendapatkan detail escrow: ${JSON.stringify(escrowResponse)}`);
        }
      } catch (error) {
        console.error(`Error saat mengambil dan menyimpan escrow detail: ${error}`);
      }
    }

    if (orderData.status === 'READY_TO_SHIP') {
      // Kirim notifikasi dan cek auto-ship secara paralel
      const [_, autoShipResult] = await Promise.all([
        sendEventToShopOwners({
          type: 'new_order',
          order_sn: orderData.ordersn,
          status: orderData.status,
          buyer_name: orderData.buyer_username,
          total_amount: orderData.total_amount,
          sku: orderData.sku,
          shop_name: shopName,
          shop_id: data.shop_id
        }),
        // Gunakan PremiumFeatureService untuk auto-ship
        PremiumFeatureService.handleAutoShip(data.shop_id, orderData.ordersn)
      ]);
    }
    else if (orderData.status === 'IN_CANCEL') {
      // Gunakan PremiumFeatureService untuk auto-chat
      await PremiumFeatureService.handleChatCancel(
        data.shop_id,
        orderData.ordersn,
        orderDetail.buyer_user_id,
        orderDetail.buyer_username
      );
    }
  } catch (error) {
    console.error(`Gagal memproses order ${orderData.ordersn}:`, error);
  }
}

async function handleTrackingUpdate(data: any): Promise<void> {
  await trackingUpdate(data);
}

// Fungsi-fungsi helper (perlu diimplementasikan)
async function updateOrderStatus(shop_id: number, ordersn: string, status: string, updateTime: number) {
  console.log(`Memulai updateOrderStatus untuk order ${ordersn}`);
  
  // Khusus untuk status TO_RETURN, langsung update status saja
  if (status === 'TO_RETURN') {
    await updateOrderStatusOnly(ordersn, status, updateTime);
    return { order_sn: ordersn, status: status }; // Return minimal data yang diperlukan
  }

  let orderDetail: any;
  
  try {
    orderDetail = await withRetry(
      () => getOrderDetail(shop_id, ordersn),
      3,
      1000
    );
    
    if (!orderDetail?.order_list?.[0]) {
      throw new Error(`Data pesanan tidak ditemukan untuk ordersn: ${ordersn}`);
    }

    const orderData = orderDetail.order_list[0];
    
    await withRetry(() => upsertOrderData(orderData, shop_id), 5, 1000);
    await withRetry(() => upsertOrderItems(orderData), 5, 1000);
    await withRetry(() => upsertLogisticData(orderData, shop_id), 5, 1000);
    
    console.log(`Berhasil memperbarui semua data untuk order ${ordersn}`);
    
    return orderData;
  } catch (error) {
    console.error(`Error kritis dalam updateOrderStatus untuk order ${ordersn}:`, error);
    throw error;
  }
}

async function handleOther(data: any) {
  console.log('Handling other type of data', data);
  // Implementasi logika penanganan lainnya di sini
}

async function handleDocumentUpdate(data: any) {
  console.log('Menangani pembaruan dokumen', data);
  try {
    const documentData = data.data;
    const shopId = data.shop_id;
    
    // Ambil shop name untuk notifikasi
    const autoShipData = await redis.get('auto_ship');
    let shopName = '';
    
    if (autoShipData) {
      const shops = JSON.parse(autoShipData);
      const shop = shops.find((s: any) => s.shop_id === shopId);
      shopName = shop?.shop_name || '';
    }

    // Handle document status update untuk orders (existing functionality)
    if (documentData.ordersn || documentData.order_sn) {
      const orderSn = documentData.ordersn || documentData.order_sn;
      await updateDocumentStatus(orderSn);
      
      // Kirim notifikasi untuk order document update
      sendEventToShopOwners({
        type: 'order_document_update',
        order_sn: orderSn,
        package_number: documentData.package_number,
        status: documentData.status,
        shop_id: shopId,
        shop_name: shopName,
        timestamp: new Date().toISOString()
      });
    }
    
    // Handle document status update untuk booking orders jika ada booking_sn
    if (documentData.booking_sn) {
      const documentStatus = documentData.status === 'READY' ? 'READY' : 
                           documentData.status === 'FAILED' ? 'ERROR' : 'PENDING';
      
      const updateResult = await updateBookingOrderForWebhook(shopId, documentData.booking_sn, {
        document_status: documentStatus
      });
      
      if (updateResult.success) {
        console.info(`Successfully updated document status for booking ${documentData.booking_sn}: ${documentStatus}`);
        
        // Kirim notifikasi untuk booking document update
        sendEventToShopOwners({
          type: 'booking_document_update',
          booking_sn: documentData.booking_sn,
          package_number: documentData.package_number,
          status: documentData.status,
          document_status: documentStatus,
          shop_id: shopId,
          shop_name: shopName,
          timestamp: new Date().toISOString()
        });
      } else {
        console.error(`Failed to update document status for booking ${documentData.booking_sn}:`, updateResult.message);
      }
    }

  } catch (error) {
    console.error('Error handling document update webhook:', error);
  }
}

async function handlePenalty(data: any) {
  try {
    // Ambil data auto_ship untuk mendapatkan nama toko
    const autoShipData = await redis.get('auto_ship');
    let shopName = 'Tidak diketahui';
    
    if (autoShipData) {
      const shops = JSON.parse(autoShipData);
      const shop = shops.find((s: any) => s.shop_id === data.shop_id);
      if (shop) {
        shopName = shop.shop_name;
      }
    }

    const notificationData = {
      type: 'penalty',
      ...data,
      shop_name: shopName
    };
    
    sendEventToShopOwners(notificationData);
    
    await PenaltyService.handlePenalty({
      ...data,
      shop_name: shopName
    });

  } catch (error) {
    console.error('Error handling penalty webhook:', error);
    throw error;
  }
}

async function handleUpdate(data: any) {
  try {
    const autoShipData = await redis.get('auto_ship');
    let shopName = 'Tidak diketahui';
    
    if (autoShipData) {
      const shops = JSON.parse(autoShipData);
      const shop = shops.find((s: any) => s.shop_id === data.shop_id);
      if (shop) {
        shopName = shop.shop_name;
      }
    }

    const notificationData = {
      type: 'update',
      ...data,
      shop_name: shopName
    };
    
    sendEventToShopOwners(notificationData);

    await UpdateService.handleUpdate({
      ...data,
      shop_name: shopName
    });
  } catch (error) {
    console.error('Error handling update webhook:', error);
    throw error;
  }
}

async function handleViolation(data: any) {
  try {
    const autoShipData = await redis.get('auto_ship');
    let shopName = 'Tidak diketahui';
    
    if (autoShipData) {
      const shops = JSON.parse(autoShipData);
      const shop = shops.find((s: any) => s.shop_id === data.shop_id);
      if (shop) {
        shopName = shop.shop_name;
      }
    }

    const notificationData = {
      type: 'violation',
      ...data,
      shop_name: shopName
    };
    
    sendEventToShopOwners(notificationData);

    await ViolationService.handleViolation({
      ...data,
      shop_name: shopName
    });
  } catch (error) {
    console.error('Error handling violation webhook:', error);
    throw error;
  }
}

async function handleBookingTrackingUpdate(data: any) {
  console.log('Handling booking tracking number update', data);
  try {
    const bookingData = data.data;
    const shopId = data.shop_id;
    
    // Extract booking tracking data - support both tracking_number and tracking_no
    const bookingSn = bookingData.booking_sn;
    const trackingNumber = bookingData.tracking_number || bookingData.tracking_no;
    const fOrderId = bookingData.forder_id;
    const isAbo = bookingData.is_abo;
    
    if (!bookingSn || !trackingNumber) {
      console.warn('Missing booking_sn or tracking number in webhook data:', bookingData);
      return;
    }

    console.log(`Processing booking tracking update:`, {
      booking_sn: bookingSn,
      tracking_number: trackingNumber,
      forder_id: fOrderId,
      is_abo: isAbo,
      shop_id: shopId
    });

    // Update tracking number di database
    const updateResult = await updateTrackingNumberForWebhook(shopId, bookingSn, trackingNumber);
    
    if (updateResult.success) {
      console.info(`Successfully updated tracking number for booking ${bookingSn}: ${trackingNumber}`);
      
      // Auto-create shipping document setelah tracking number tersedia
      try {
        console.log(`Auto-creating shipping document for booking: ${bookingSn} with tracking: ${trackingNumber}`);
        
        const documentResult = await createBookingShippingDocument(
          shopId, 
          [{ 
            booking_sn: bookingSn,
            tracking_number: trackingNumber
          }], 
          'THERMAL_AIR_WAYBILL'
        );
        
        if (documentResult.success) {
          console.log(`Shipping document berhasil dibuat untuk booking ${bookingSn}`);
          
          // Update database status menjadi READY setelah document dibuat
          const docUpdateResult = await updateBookingOrderForWebhook(shopId, bookingSn, {
            document_status: 'READY'
          });
          
          if (docUpdateResult.success) {
            console.log(`Database status updated to READY for booking ${bookingSn}`);
          } else {
            console.error(`Failed to update database status for booking ${bookingSn}:`, docUpdateResult.message);
          }
        } else {
          console.error(`Gagal membuat shipping document untuk booking ${bookingSn}:`, documentResult.message);
        }
      } catch (error) {
        console.error(`Error saat membuat shipping document untuk booking ${bookingSn}:`, error);
      }
    } else {
      console.error(`Failed to update tracking number for booking ${bookingSn}:`, updateResult.message);
    }

  } catch (error) {
    console.error('Error handling booking tracking update webhook:', error);
  }
}

async function handleBooking(data: any) {
  console.log('Handling booking event', data);
  try {
    const bookingData = data.data;
    const shopId = data.shop_id;
    
    // Ambil shop name untuk notifikasi
    const autoShipData = await redis.get('auto_ship');
    let shopName = '';
    
    if (autoShipData) {
      const shops = JSON.parse(autoShipData);
      const shop = shops.find((s: any) => s.shop_id === shopId);
      shopName = shop?.shop_name || '';
    }

    // Sync booking berdasarkan booking_sn yang diterima
    if (bookingData.booking_sn) {
      const bookingSns = Array.isArray(bookingData.booking_sn) 
        ? bookingData.booking_sn 
        : [bookingData.booking_sn];

      await syncBookingsByBookingSns(shopId, bookingSns, {
        onProgress: (progress) => {
          console.log(`Booking sync progress: ${progress.current}/${progress.total}`);
        }
      });

      // Fitur Premium - Auto Ship untuk Booking Orders
      if (bookingData.booking_status === 'READY_TO_SHIP') {
        try {
          console.log(`Auto-shipping booking: ${bookingData.booking_sn}`);
          const shipResult = await shipBooking(shopId, bookingData.booking_sn, 'dropoff');
          
          if (shipResult.success) {
            console.log(`Booking ${bookingData.booking_sn} berhasil di-ship otomatis`);
            
            // Kirim notifikasi auto-ship berhasil
            sendEventToShopOwners({
              type: 'booking_auto_shipped',
              booking_sn: bookingData.booking_sn,
              shop_id: shopId,
              shop_name: shopName,
              timestamp: new Date().toISOString()
            });
          } else {
            console.error(`Gagal auto-ship booking ${bookingData.booking_sn}:`, shipResult.message);
          }
        } catch (error) {
          console.error(`Error saat auto-ship booking ${bookingData.booking_sn}:`, error);
        }
      }

      // Kirim notifikasi real-time untuk booking update
      sendEventToShopOwners({
        type: 'booking_update',
        booking_sn: bookingData.booking_sn,
        booking_status: bookingData.booking_status,
        shop_id: shopId,
        shop_name: shopName,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Error handling booking webhook:', error);
  }
}