import { NextRequest } from 'next/server';

// Simpan semua koneksi SSE aktif dengan informasi toko yang dimiliki user
const clients = new Map<ReadableStreamDefaultController, {
  userId: string,
  shopIds: number[]
}>();

// Rate limit per userId (bukan IP, karena IP tidak reliable di balik proxy)
// FIX #3: Gunakan userId sebagai key, bukan IP
const connectionAttempts = new Map<string, { count: number, firstAttempt: number }>();

// FIX #2: Cleanup connectionAttempts secara periodik agar tidak memory leak
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 menit
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  connectionAttempts.forEach((val, key) => {
    if (now - val.firstAttempt > CLEANUP_INTERVAL_MS) {
      connectionAttempts.delete(key);
      cleaned++;
    }
  });
  if (cleaned > 0) {
    console.log(`[SSE] Cleanup: dihapus ${cleaned} entry rate limit kedaluwarsa`);
  }
}, CLEANUP_INTERVAL_MS);

/**
 * Memeriksa apakah sebuah userId diperbolehkan untuk membuat koneksi baru
 * berdasarkan batasan 10 koneksi per menit
 * FIX #3: Berbasis userId bukan IP
 */
export function checkRateLimit(userId: string): { allowed: boolean, attempts?: { count: number, firstAttempt: number } } {
  const now = Date.now();

  const attempts = connectionAttempts.get(userId) || { count: 0, firstAttempt: now };

  if (now - attempts.firstAttempt < 60000) { // Window 1 menit
    if (attempts.count > 10) { // Maksimal 10 koneksi per menit
      return { allowed: false, attempts };
    }

    const updatedAttempts = {
      count: attempts.count + 1,
      firstAttempt: attempts.firstAttempt
    };

    connectionAttempts.set(userId, updatedAttempts);
    return { allowed: true, attempts: updatedAttempts };
  } else {
    // Reset jika sudah lewat 1 menit
    const newAttempts = { count: 1, firstAttempt: now };
    connectionAttempts.set(userId, newAttempts);
    return { allowed: true, attempts: newAttempts };
  }
}

/**
 * Membuat koneksi SSE baru dengan informasi toko yang dimiliki user
 */
export function createSSEConnection(req: NextRequest, userId: string, shopIds: number[]) {
  try {
    const stream = new ReadableStream({
      start(controller) {
        // Simpan controller dengan userId dan shopIds
        clients.set(controller, { userId, shopIds });
        console.log(`[SSE] Koneksi baru (userId: ${userId}). Total koneksi aktif: ${clients.size}`);

        // FIX #1: Tambahkan retry directive di initial event agar browser auto-reconnect
        const initialData = {
          type: 'connection_established',
          timestamp: Date.now(),
          message: 'Koneksi SSE berhasil dibuat',
          user_id: userId,
          shop_ids: shopIds
        };

        const initialEvent = [
          `id: ${Date.now()}`,
          `retry: 5000`,   // FIX #1: browser akan reconnect dalam 5 detik jika koneksi putus
          `data: ${JSON.stringify(initialData)}`,
          '\n'
        ].join('\n');

        controller.enqueue(initialEvent);

        // Heartbeat setiap 30 detik untuk mencegah timeout
        const heartbeatInterval = setInterval(() => {
          if (!clients.has(controller)) {
            clearInterval(heartbeatInterval);
            return;
          }

          const heartbeat = {
            type: 'heartbeat',
            timestamp: Date.now()
          };

          // FIX #1: Sertakan retry di heartbeat juga
          const heartbeatEvent = [
            `id: ${Date.now()}`,
            `retry: 5000`,
            `data: ${JSON.stringify(heartbeat)}`,
            '\n'
          ].join('\n');

          try {
            controller.enqueue(heartbeatEvent);
          } catch (error) {
            console.error('[SSE] Error mengirim heartbeat, koneksi dihapus');
            clearInterval(heartbeatInterval);
            clients.delete(controller);
          }
        }, 30000);

        req.signal.addEventListener('abort', () => {
          clearInterval(heartbeatInterval);
          clients.delete(controller);
          console.log(`[SSE] Koneksi terputus (userId: ${userId}). Total koneksi aktif: ${clients.size}`);
        });
      },
      cancel(controller) {
        clients.delete(controller);
        console.log(`[SSE] Koneksi dibatalkan. Total koneksi aktif: ${clients.size}`);
      }
    });

    return stream;
  } catch (error) {
    console.error('[SSE] Error dalam membuat koneksi:', error);
    throw error;
  }
}

/**
 * Mengirim event hanya ke klien yang memiliki toko tertentu
 */
export function sendEventToShopOwners(data: any) {
  const eventId = Date.now().toString();

  const shopId = data.shop_id;

  if (!shopId) {
    console.error('[SSE] Data tidak memiliki shop_id, tidak dapat mengirim notifikasi');
    return;
  }

  const event = [
    `id: ${eventId}`,
    `retry: 5000`,
    `data: ${JSON.stringify(data)}`,
    '\n'
  ].join('\n');

  let recipientCount = 0;
  const totalClients = clients.size;

  clients.forEach((userData, controller) => {
    try {
      if (userData.shopIds.includes(Number(shopId))) {
        controller.enqueue(event);
        recipientCount++;
      }
    } catch (error) {
      console.error('[SSE] Error mengirim notifikasi, koneksi dihapus');
      clients.delete(controller);
    }
  });

  console.log(`[SSE] Notifikasi toko ${shopId} → ${recipientCount}/${totalClients} klien`);
}

/**
 * Mengirim event ke semua klien (untuk notifikasi sistem)
 */
export function sendEventToAll(data: any) {
  const eventId = Date.now().toString();
  const event = [
    `id: ${eventId}`,
    `retry: 5000`,
    `data: ${JSON.stringify(data)}`,
    '\n'
  ].join('\n');

  let successCount = 0;
  const totalClients = clients.size;

  clients.forEach((userData, controller) => {
    try {
      controller.enqueue(event);
      successCount++;
    } catch (error) {
      console.error('[SSE] Error mengirim notifikasi sistem, koneksi dihapus');
      clients.delete(controller);
    }
  });

  console.log(`[SSE] Notifikasi sistem → ${successCount}/${totalClients} klien`);
}