import { NextRequest, NextResponse } from 'next/server';
import { upsertOrderData, upsertOrderItems, upsertLogisticData, trackingUpdate, updateDocumentStatus, withRetry, updateOrderStatusOnly, saveEscrowDetail } from '@/app/services/databaseOperations';
import { prosesOrder } from '@/app/services/prosesOrder';
import { getOrderDetail } from '@/app/services/shopeeService';
import { getEscrowDetail } from '@/app/services/shopeeService';
import { redis } from '@/app/services/redis';
import { PenaltyService } from '@/app/services/penaltyService';
import { UpdateService } from '@/app/services/updateService';
import { ViolationService } from '@/app/services/violationService';
import { sendEventToShopOwners } from '@/app/services/serverSSEService';

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
      16: handleViolation
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
      shop_name: shopName
    };
    
    console.log('Received chat message from Shopee', chatData);
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
        // Cek dan proses auto-ship
        (async () => {
          if (autoShipData) {
            const shops = JSON.parse(autoShipData);
            const shop = shops.find((s: any) => s.shop_id === data.shop_id);
            
            if (shop?.status_ship) {
              return withRetry(
                () => prosesOrder(data.shop_id, orderData.ordersn),
                3,
                2000
              );
            }
          }
        })()
      ]);
    }
    else if (orderData.status === 'IN_CANCEL') {
      // Cek status_chat dari auto_ship data
      if (autoShipData) {
        const shops = JSON.parse(autoShipData);
        const shop = shops.find((s: any) => s.shop_id === data.shop_id);
        const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:10000';

        if (shop && shop.status_chat) {
          try {
            // Kirim pesan pertama dengan tipe 'order'
            console.log('Memulai pengiriman pesan pertama ke pembeli');
            const orderResponse = await fetch(`${API_BASE_URL}/api/msg/send_message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                toId: orderDetail.buyer_user_id,
                messageType: 'order',
                content: {
                  order_sn: orderData.ordersn
                },
                shopId: data.shop_id
              })
            }
          );

            if (!orderResponse.ok) {
              throw new Error(`Gagal mengirim pesan order ke pembeli ${orderDetail.buyer_username}`);
            }

            // Tunggu sebentar sebelum mengirim pesan kedua
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Kirim pesan kedua dengan teks informasi
            const message = `Halo ${orderDetail.buyer_username},\n\nMohon maaf, pesanan dengan nomor ${orderData.ordersn} sudah kami kemas, jika kakak ingin mengubah warna atau ukuran, silakan tulis permintaan kakak di sini.\n\nDitunggu ya kak responnya.`;
            console.log('Memulai pengiriman pesan kedua ke pembeli');
            const textResponse = await fetch(`${API_BASE_URL}/api/msg/send_message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                toId: orderDetail.buyer_user_id,
                messageType: 'text',
                content: message,
                shopId: data.shop_id
              })
            });

            if (!textResponse.ok) {
              throw new Error(`Gagal mengirim pesan teks ke pembeli ${orderDetail.buyer_username}`);
            }

            console.log(`Pesan pembatalan berhasil dikirim ke pembeli untuk order ${orderData.ordersn}`);
          } catch (error) {
            console.error(`Gagal mengirim pesan pembatalan untuk order ${orderData.ordersn}:`, error);
          }
        } else {
          console.log(`Auto-chat tidak aktif untuk toko ${shopName} (${data.shop_id})`);
        }
      }
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
  await updateDocumentStatus(data.data.ordersn, data.data.package_number);
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