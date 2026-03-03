import { pgTable, bigint, varchar, text, jsonb, boolean, timestamp, integer, unique } from 'drizzle-orm/pg-core';

export const bookingOrders = pgTable('booking_orders', {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    shopId: bigint('shop_id', { mode: 'number' }).notNull(),
    bookingSn: varchar('booking_sn').notNull().unique(),
    orderSn: varchar('order_sn'),
    region: varchar('region'),
    bookingStatus: varchar('booking_status'),
    matchStatus: varchar('match_status'),
    shippingCarrier: text('shipping_carrier'),
    createTime: bigint('create_time', { mode: 'number' }),
    updateTime: bigint('update_time', { mode: 'number' }),
    recipientAddress: jsonb('recipient_address'),
    itemList: jsonb('item_list'),
    dropshipper: text('dropshipper'),
    dropshipperPhone: varchar('dropshipper_phone'),
    cancelBy: varchar('cancel_by'),
    cancelReason: varchar('cancel_reason'),
    fulfillmentFlag: varchar('fulfillment_flag'),
    pickupDoneTime: bigint('pickup_done_time', { mode: 'number' }),
    trackingNumber: text('tracking_number'),
    isPrinted: boolean('is_printed').default(false),
    documentStatus: text('document_status').default('PENDING'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
    unique('booking_orders_shop_id_booking_sn_key').on(table.shopId, table.bookingSn),
]);
