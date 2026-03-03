import { pgTable, varchar, bigint, numeric, boolean, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { shopeeTokens } from './shopeeTokens';

export const orders = pgTable('orders', {
    orderSn: varchar('order_sn').primaryKey(),
    buyerUserId: bigint('buyer_user_id', { mode: 'number' }),
    buyerUsername: varchar('buyer_username'),
    createTime: bigint('create_time', { mode: 'number' }),
    orderStatus: varchar('order_status'),
    currency: varchar('currency'),
    totalAmount: numeric('total_amount'),
    shippingCarrier: varchar('shipping_carrier'),
    estimatedShippingFee: numeric('estimated_shipping_fee'),
    actualShippingFeeConfirmed: boolean('actual_shipping_fee_confirmed'),
    cod: boolean('cod'),
    daysToShip: integer('days_to_ship'),
    shipByDate: bigint('ship_by_date', { mode: 'number' }),
    paymentMethod: varchar('payment_method'),
    fulfillmentFlag: varchar('fulfillment_flag'),
    messageToSeller: text('message_to_seller'),
    note: text('note'),
    noteUpdateTime: bigint('note_update_time', { mode: 'number' }),
    orderChargeableWeightGram: integer('order_chargeable_weight_gram'),
    pickupDoneTime: bigint('pickup_done_time', { mode: 'number' }),
    updateTime: bigint('update_time', { mode: 'number' }),
    shopId: bigint('shop_id', { mode: 'number' }).notNull().references(() => shopeeTokens.shopId),
    payTime: bigint('pay_time', { mode: 'number' }),
    cancelBy: text('cancel_by'),
    cancelReason: text('cancel_reason'),
    escrowAmountAfterAdjustment: numeric('escrow_amount_after_adjustment').default('0'),
    trackingNumber: text('tracking_number'),
    isPrinted: boolean('is_printed').default(false),
    documentStatus: text('document_status').default('PENDING'),
});

export const ordersRelations = relations(orders, ({ one, many }) => ({
    shop: one(shopeeTokens, {
        fields: [orders.shopId],
        references: [shopeeTokens.shopId],
    }),
    items: many(orderItems),
    logistics: many(logistic),
    escrow: one(orderEscrow, {
        fields: [orders.orderSn],
        references: [orderEscrow.orderSn],
    }),
}));

// Forward imports for relations
import { orderItems } from './orderItems';
import { logistic } from './logistic';
import { orderEscrow } from './orderEscrow';
