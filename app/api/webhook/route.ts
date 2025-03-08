import { NextRequest, NextResponse } from 'next/server';
import { upsertOrderData, upsertOrderItems, upsertLogisticData, trackingUpdate, updateDocumentStatus, withRetry, updateOrderStatusOnly } from '@/app/services/databaseOperations';
import { prosesOrder } from '@/app/services/prosesOrder';
import { getOrderDetail } from '@/app/services/shopeeService';
import { redis } from '@/app/services/redis';
import { PenaltyService } from '@/app/services/penaltyService';
import { UpdateService } from '@/app/services/updateService';
import { ViolationService } from '@/app/services/violationService';

// Simpan semua koneksi SSE aktif
const clients = new Set<ReadableStreamDefaultController>();

const connectionAttempts = new Map<string, { count: number, firstAttempt: number }>();

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

export async function GET(req: NextRequest) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  
  // Cek dan update connection attempts
  const attempts = connectionAttempts.get(ip) || { count: 0, firstAttempt: now };
  
  if (now - attempts.firstAttempt < 60000) { // Window 1 menit
    if (attempts.count > 10) { // Maksimal 10 koneksi per menit
      return new Response('Too Many Requests', { status: 429 });
    }
    connectionAttempts.set(ip, {
      count: attempts.count + 1,
      firstAttempt: attempts.firstAttempt
    });
  } else {
    // Reset jika sudah lewat 1 menit
    connectionAttempts.set(ip, { count: 1, firstAttempt: now });
  }

  try {
    const stream = new ReadableStream({
      start(controller) {
        clients.add(controller);
        
        // Kirim data inisial ketika koneksi terbentuk
        const initialData = {
          type: 'connection_established',
          timestamp: Date.now(),
          message: 'Koneksi SSE berhasil dibuat'
        };
        
        const event = [
          `id: ${Date.now()}`,
          `data: ${JSON.stringify(initialData)}`,
          '\n'
        ].join('\n');
        
        controller.enqueue(event);

        // Set up heartbeat
        const heartbeatInterval = setInterval(() => {
          const heartbeat = {
            type: 'heartbeat',
            timestamp: Date.now()
          };
          
          const heartbeatEvent = [
            `id: ${Date.now()}`,
            `data: ${JSON.stringify(heartbeat)}`,
            '\n'
          ].join('\n');
          
          controller.enqueue(heartbeatEvent);
        }, 30000); // Kirim heartbeat setiap 30 detik

        req.signal.addEventListener('abort', () => {
          clearInterval(heartbeatInterval);
          clients.delete(controller);
        });
      },
      cancel(controller) {
        clients.delete(controller);
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error dalam membuat SSE connection:', error);
    return new Response('Error', { status: 500 });
  }
}

export function sendEventToAll(data: any) {
  const eventId = Date.now().toString();
  const event = [
    `id: ${eventId}`,
    `retry: 10000`,
    `data: ${JSON.stringify(data)}`,
    '\n'
  ].join('\n');

  clients.forEach(client => {
    try {
      client.enqueue(event);
    } catch (error) {
      console.error('Error mengirim event:', error);
      clients.delete(client);
    }
  });
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
    sendEventToAll(chatData);
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

    if (orderData.status === 'READY_TO_SHIP') {
      // Kirim notifikasi dan cek auto-ship secara paralel
      const [_, autoShipResult] = await Promise.all([
        sendEventToAll({
          type: 'new_order',
          order_sn: orderData.ordersn,
          status: orderData.status,
          buyer_name: orderData.buyer_username,
          total_amount: orderData.total_amount,
          sku: orderData.sku,
          shop_name: shopName
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
            const message = `Halo ${orderDetail.buyer_username},\n\nMohon maaf, pesanan dengan nomor ${orderData.ordersn} yang sudah masuk tidak bisa dibatalkan. Jika kakak ingin mengubah warna atau ukuran, silakan tulis permintaan kakak di sini.\n\nJika ingin mengganti alamat atau model, silakan pesan ulang maka pesanan yang salah akan otomatis dikonfirmasi pembatalannya.\n\nTerima kasih atas pengertiannya.`;
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
    
    sendEventToAll(notificationData);
    
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
    
    sendEventToAll(notificationData);

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
    
    sendEventToAll(notificationData);

    await ViolationService.handleViolation({
      ...data,
      shop_name: shopName
    });
  } catch (error) {
    console.error('Error handling violation webhook:', error);
    throw error;
  }
}