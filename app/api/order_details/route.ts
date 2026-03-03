import { db } from '@/db';
import { orders, orderItems, logistic, orderEscrow, shopeeTokens } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');
    const order_sn = searchParams.get('order_sn');

    if (user_id && order_sn) {
      return NextResponse.json(
        { success: false, message: 'Hanya boleh memberikan salah satu parameter: user_id ATAU order_sn' },
        { status: 400 }
      );
    }

    if (!user_id && !order_sn) {
      return NextResponse.json(
        { success: false, message: 'Parameter user_id atau order_sn diperlukan' },
        { status: 400 }
      );
    }

    let data: any[];

    if (order_sn) {
      // Single order detail with items + logistics + escrow
      data = await db.select({
        order_sn: orders.orderSn,
        shop_id: orders.shopId,
        buyer_user_id: orders.buyerUserId,
        buyer_username: orders.buyerUsername,
        create_time: orders.createTime,
        order_status: orders.orderStatus,
        total_amount: orders.totalAmount,
        currency: orders.currency,
        shipping_carrier: orders.shippingCarrier,
        payment_method: orders.paymentMethod,
        tracking_number: orders.trackingNumber,
        message_to_seller: orders.messageToSeller,
        note: orders.note,
        fulfillment_flag: orders.fulfillmentFlag,
        cancel_by: orders.cancelBy,
        cancel_reason: orders.cancelReason,
        update_time: orders.updateTime,
        pay_time: orders.payTime,
        is_printed: orders.isPrinted,
        document_status: orders.documentStatus,
        escrow_amount_after_adjustment: orders.escrowAmountAfterAdjustment,
        shop_name: shopeeTokens.shopName,
      })
        .from(orders)
        .leftJoin(shopeeTokens, eq(orders.shopId, shopeeTokens.shopId))
        .where(eq(orders.orderSn, order_sn));

      if (data.length > 0) {
        // Get items for this order
        const itemsData = await db.select().from(orderItems)
          .where(eq(orderItems.orderSn, order_sn));

        // Get logistics for this order
        const logisticData = await db.select().from(logistic)
          .where(eq(logistic.orderSn, order_sn));

        // Get escrow for this order
        const [escrowData] = await db.select().from(orderEscrow)
          .where(eq(orderEscrow.orderSn, order_sn))
          .limit(1);

        data = data.map(order => ({
          ...order,
          items: itemsData,
          logistics: logisticData,
          escrow: escrowData || null,
        }));
      }
    } else {
      // All orders by buyer_user_id
      data = await db.select({
        order_sn: orders.orderSn,
        shop_id: orders.shopId,
        buyer_user_id: orders.buyerUserId,
        buyer_username: orders.buyerUsername,
        create_time: orders.createTime,
        order_status: orders.orderStatus,
        total_amount: orders.totalAmount,
        currency: orders.currency,
        shipping_carrier: orders.shippingCarrier,
        payment_method: orders.paymentMethod,
        tracking_number: orders.trackingNumber,
        update_time: orders.updateTime,
        pay_time: orders.payTime,
        is_printed: orders.isPrinted,
        document_status: orders.documentStatus,
        shop_name: shopeeTokens.shopName,
      })
        .from(orders)
        .leftJoin(shopeeTokens, eq(orders.shopId, shopeeTokens.shopId))
        .where(eq(orders.buyerUserId, parseInt(user_id!)));
    }

    return NextResponse.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Terjadi kesalahan server: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    );
  }
}
