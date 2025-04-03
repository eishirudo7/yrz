import { NextRequest } from 'next/server';

// Simpan semua koneksi SSE aktif dengan informasi toko yang dimiliki user
const clients = new Map<ReadableStreamDefaultController, {
  userId: string,
  shopIds: number[]
}>();

// Batasi koneksi untuk mencegah overload
const connectionAttempts = new Map<string, { count: number, firstAttempt: number }>();

/**
 * Memeriksa apakah sebuah IP diperbolehkan untuk membuat koneksi baru
 * berdasarkan batasan 10 koneksi per menit
 */
export function checkRateLimit(ip: string): { allowed: boolean, attempts?: { count: number, firstAttempt: number } } {
  const now = Date.now();
  
  // Cek dan update connection attempts
  const attempts = connectionAttempts.get(ip) || { count: 0, firstAttempt: now };
  
  if (now - attempts.firstAttempt < 60000) { // Window 1 menit
    if (attempts.count > 10) { // Maksimal 10 koneksi per menit
      return { allowed: false, attempts };
    }
    
    const updatedAttempts = {
      count: attempts.count + 1,
      firstAttempt: attempts.firstAttempt
    };
    
    connectionAttempts.set(ip, updatedAttempts);
    return { allowed: true, attempts: updatedAttempts };
  } else {
    // Reset jika sudah lewat 1 menit
    const newAttempts = { count: 1, firstAttempt: now };
    connectionAttempts.set(ip, newAttempts);
    return { allowed: true, attempts: newAttempts };
  }
}

/**
 * Membuat koneksi SSE baru dengan informasi toko yang dimiliki user
 */
export function createSSEConnection(req: NextRequest, userId: string, shopIds: number[]) {
  console.log(`Creating SSE connection for user ${userId} with shops:`, shopIds);
  
  try {
    const stream = new ReadableStream({
      start(controller) {
        // Simpan controller dengan userId dan shopIds
        clients.set(controller, { userId, shopIds });
        console.log(`New SSE client added. Total active connections: ${clients.size}`);
        
        // Kirim data inisial ketika koneksi terbentuk
        const initialData = {
          type: 'connection_established',
          timestamp: Date.now(),
          message: 'Koneksi SSE berhasil dibuat',
          user_id: userId, // Tambahkan informasi user
          shop_ids: shopIds // Tambahkan informasi toko
        };
        
        const event = [
          `id: ${Date.now()}`,
          `data: ${JSON.stringify(initialData)}`,
          '\n'
        ].join('\n');
        
        console.log('Sending initial connection message');
        controller.enqueue(event);

        // Set up heartbeat
        const heartbeatInterval = setInterval(() => {
          if (!clients.has(controller)) {
            console.log('Heartbeat: client no longer exists, clearing interval');
            clearInterval(heartbeatInterval);
            return;
          }
          
          const heartbeat = {
            type: 'heartbeat',
            timestamp: Date.now()
          };
          
          const heartbeatEvent = [
            `id: ${Date.now()}`,
            `data: ${JSON.stringify(heartbeat)}`,
            '\n'
          ].join('\n');
          
          console.log(`Sending heartbeat to user ${userId}`);
          
          try {
            controller.enqueue(heartbeatEvent);
          } catch (error) {
            console.error('Error sending heartbeat, removing client:', error);
            clearInterval(heartbeatInterval);
            clients.delete(controller);
          }
        }, 30000); // Kirim heartbeat setiap 30 detik

        req.signal.addEventListener('abort', () => {
          console.log(`SSE connection aborted for user ${userId}`);
          clearInterval(heartbeatInterval);
          clients.delete(controller);
          console.log(`Client removed. Total remaining connections: ${clients.size}`);
        });
      },
      cancel(controller) {
        console.log('SSE connection cancelled');
        clients.delete(controller);
        console.log(`Client removed on cancel. Total remaining connections: ${clients.size}`);
      }
    });

    return stream;
  } catch (error) {
    console.error('Error dalam membuat SSE connection:', error);
    throw error;
  }
}

/**
 * Mengirim event hanya ke klien yang memiliki toko tertentu
 */
export function sendEventToShopOwners(data: any) {
  console.log('Attempting to send event to shop owners:', data);
  const eventId = Date.now().toString();
  
  // Ambil shop_id dari data
  const shopId = data.shop_id;
  
  if (!shopId) {
    console.error('Data tidak memiliki shop_id, tidak dapat mengirim notifikasi spesifik toko');
    return;
  }
  
  console.log(`Sending event for shop ${shopId}, event type: ${data.type}`);
  
  const event = [
    `id: ${eventId}`,
    `retry: 10000`,
    `data: ${JSON.stringify(data)}`,
    '\n'
  ].join('\n');

  // Hitung jumlah klien yang menerima notifikasi
  let recipientCount = 0;
  let totalClients = clients.size;

  console.log(`Total active clients: ${totalClients}`);

  // Iterasi semua client dan kirim hanya ke yang memiliki toko tersebut
  clients.forEach((userData, controller) => {
    try {
      // Kirim hanya jika user memiliki toko ini
      if (userData.shopIds.includes(Number(shopId))) {
        console.log(`Sending notification to user ${userData.userId} for shop ${shopId}`);
        controller.enqueue(event);
        recipientCount++;
      } else {
        console.log(`User ${userData.userId} does not own shop ${shopId}, skipping notification`);
      }
    } catch (error) {
      console.error(`Error sending event to user ${userData.userId}:`, error);
      clients.delete(controller);
      console.log(`Client removed due to error. Total remaining connections: ${clients.size}`);
    }
  });

  console.log(`Notification for shop ${shopId} sent to ${recipientCount}/${totalClients} clients`);
}

// Tetap pertahankan fungsi sendEventToAll untuk notifikasi sistem
export function sendEventToAll(data: any) {
  console.log('Sending event to all connected clients:', data);
  const eventId = Date.now().toString();
  const event = [
    `id: ${eventId}`,
    `retry: 10000`,
    `data: ${JSON.stringify(data)}`,
    '\n'
  ].join('\n');

  let successCount = 0;
  const totalClients = clients.size;

  // Perbaikan: Menggunakan key (controller) sebagai parameter pertama dan value (userData) sebagai kedua
  clients.forEach((userData, controller) => {
    try {
      console.log(`Sending system notification to user ${userData.userId}`);
      controller.enqueue(event);
      successCount++;
    } catch (error) {
      console.error(`Error sending event to user ${userData.userId}:`, error);
      clients.delete(controller);
      console.log(`Client removed due to error. Total remaining connections: ${clients.size}`);
    }
  });
  
  console.log(`System notification sent to ${successCount}/${totalClients} clients`);
} 