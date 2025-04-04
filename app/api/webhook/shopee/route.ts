import { NextRequest, NextResponse } from "next/server";
import { PremiumFeatureService } from '@/app/services/premiumFeatureService';

/**
 * Webhook handler untuk Shopee
 * Menerima notifikasi perubahan status pesanan dari Shopee
 * 
 * Status yang ditangani:
 * - READY_TO_SHIP: Menjalankan auto-ship untuk pesanan yang siap dikirim
 * - IN_CANCEL: Mengirim pesan auto-chat untuk pembatalan pesanan
 */
export async function POST(req: NextRequest) {
  try {
    // Validasi request
    const data = await req.json();
    console.log('Webhook data received:', JSON.stringify(data, null, 2));
    
    // Validasi data webhook
    if (!data || !data.shop_id || !data.order_sn) {
      console.error('Invalid webhook data', data);
      return NextResponse.json({ error: 'Invalid webhook data' }, { status: 400 });
    }
    
    const { shop_id, order_sn, status, buyer_user_id, buyer_username } = data;
    
    // Log notifikasi webhook
    console.log(`Shopee webhook: Toko ${shop_id}, Order ${order_sn}, Status ${status}`);
    
    // Handle auto-ship untuk pesanan baru dengan status READY_TO_SHIP
    if (status === 'READY_TO_SHIP') {
      console.log(`Menjalankan auto-ship untuk pesanan ${order_sn}`);
      const shipped = await PremiumFeatureService.handleAutoShipByShopId(shop_id, order_sn);
      
      if (shipped) {
        console.log(`Berhasil menjalankan auto-ship untuk pesanan ${order_sn}`);
      } else {
        console.log(`Tidak dapat menjalankan auto-ship untuk pesanan ${order_sn}`);
      }
    }
    
    // Handle auto-chat untuk pesanan yang dibatalkan dengan status IN_CANCEL
    if (status === 'IN_CANCEL' && buyer_user_id && buyer_username) {
      console.log(`Menjalankan auto-chat untuk pesanan ${order_sn} yang dibatalkan`);
      const chatSent = await PremiumFeatureService.handleAutoChatByShopId(
        shop_id, 
        order_sn, 
        buyer_user_id, 
        buyer_username
      );
      
      if (chatSent) {
        console.log(`Berhasil mengirim pesan pembatalan untuk pesanan ${order_sn}`);
      } else {
        console.log(`Tidak dapat mengirim pesan pembatalan untuk pesanan ${order_sn}`);
      }
    }
    
    return NextResponse.json({ 
      success: true,
      message: `Webhook untuk pesanan ${order_sn} dengan status ${status} telah diproses`
    });
  } catch (error) {
    console.error('Error processing Shopee webhook:', error);
    return NextResponse.json(
      { error: 'Server Error', message: 'Terjadi kesalahan saat memproses webhook' },
      { status: 500 }
    );
  }
}

// Untuk debugging webhook Shopee
export async function GET(req: NextRequest) {
  return NextResponse.json({
    message: 'Shopee Webhook Endpoint',
    instructions: 'Send POST requests to this endpoint with Shopee webhook data'
  });
} 