import { pgTable, bigint, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { shopeeTokens } from './shopeeTokens';

export const autoShipChat = pgTable('auto_ship_chat', {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    shopId: bigint('shop_id', { mode: 'number' }).notNull().unique().references(() => shopeeTokens.shopId),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    statusChat: boolean('status_chat').notNull().default(true),
    statusShip: boolean('status_ship').notNull().default(true),
});

export const autoShipChatRelations = relations(autoShipChat, ({ one }) => ({
    shop: one(shopeeTokens, {
        fields: [autoShipChat.shopId],
        references: [shopeeTokens.shopId],
    }),
}));
