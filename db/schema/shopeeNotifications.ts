import { pgTable, bigint, varchar, text, jsonb, boolean, timestamp } from 'drizzle-orm/pg-core';

export const shopeeNotifications = pgTable('shopee_notifications', {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    notificationType: varchar('notification_type').notNull(),
    shopId: bigint('shop_id', { mode: 'number' }),
    data: jsonb('data').notNull(),
    processed: boolean('processed').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    read: boolean('read').notNull().default(false),
    shopName: text('shop_name'),
});
