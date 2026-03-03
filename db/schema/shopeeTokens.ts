import { pgTable, bigint, text, timestamp, boolean, integer, uuid, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const shopeeTokens = pgTable('shopee_tokens', {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    shopId: bigint('shop_id', { mode: 'number' }).notNull().unique(),
    shopName: text('shop_name').notNull(),
    partnerId: bigint('partner_id', { mode: 'number' }).notNull(),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token').notNull(),
    accessTokenExpiry: timestamp('access_token_expiry', { withTimezone: true }).notNull(),
    refreshTokenExpiry: timestamp('refresh_token_expiry', { withTimezone: true }).notNull(),
    authorizationExpiry: timestamp('authorization_expiry', { withTimezone: true }).notNull(),
    lastRefreshAttempt: timestamp('last_refresh_attempt', { withTimezone: true }),
    refreshCount: integer('refresh_count').default(0),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    userId: uuid('user_id'),  // No FK to auth.users — stored as plain UUID
});

export const shopeeTokensRelations = relations(shopeeTokens, ({ one, many }) => ({
    autoShipChat: one(autoShipChat, {
        fields: [shopeeTokens.shopId],
        references: [autoShipChat.shopId],
    }),
}));

// Forward import
import { autoShipChat } from './autoShipChat';
