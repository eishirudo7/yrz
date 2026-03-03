/**
 * Webhook Route — Simplified (Queue-based)
 * 
 * Only validates + enqueues webhook data to BullMQ.
 * Actual processing happens in the Worker (workers/webhook/index.ts)
 */

import { NextRequest, NextResponse } from 'next/server';
import { webhookQueue } from '@/lib/queue';

export async function POST(req: NextRequest) {
  try {
    const webhookData = await req.json();

    // Enqueue the webhook for background processing
    await webhookQueue.add(
      `webhook-${webhookData.code}`,  // Job name (for readability in dashboard)
      webhookData,                     // Job data
      {
        priority: getPriority(webhookData.code), // Lower = higher priority
      }
    );

    console.log(`[Webhook] Enqueued code:${webhookData.code} shop:${webhookData.shop_id}`);

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('[Webhook] Failed to enqueue:', error);
    // Still return 200 to prevent Shopee from retrying
    return NextResponse.json({ received: true }, { status: 200 });
  }
}

/**
 * Assign priority based on webhook type
 * Lower number = higher priority
 */
function getPriority(code: number): number {
  const priorities: Record<number, number> = {
    3: 1,   // Order status — highest priority
    23: 1,  // Booking — highest priority
    4: 2,   // Tracking update
    24: 2,  // Booking tracking
    15: 3,  // Document ready
    10: 5,  // Chat — lower priority
    28: 4,  // Penalty
    5: 4,   // Update
    16: 4,  // Violation
  };
  return priorities[code] || 10;
}