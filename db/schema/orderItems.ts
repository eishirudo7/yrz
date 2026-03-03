import { pgTable, varchar, bigint, numeric, boolean, integer, text, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { orders } from './orders';

export const orderItems = pgTable('order_items', {
    orderSn: varchar('order_sn').notNull().references(() => orders.orderSn),
    itemId: bigint('item_id', { mode: 'number' }),
    modelId: bigint('model_id', { mode: 'number' }).notNull(),
    orderItemId: bigint('order_item_id', { mode: 'number' }).notNull(),
    itemName: varchar('item_name'),
    itemSku: varchar('item_sku'),
    modelName: varchar('model_name'),
    modelSku: varchar('model_sku'),
    modelQuantityPurchased: integer('model_quantity_purchased'),
    modelOriginalPrice: numeric('model_original_price'),
    modelDiscountedPrice: numeric('model_discounted_price'),
    wholesale: boolean('wholesale'),
    weight: numeric('weight'),
    addOnDeal: boolean('add_on_deal'),
    mainItem: boolean('main_item'),
    addOnDealId: bigint('add_on_deal_id', { mode: 'number' }),
    promotionType: varchar('promotion_type'),
    promotionId: bigint('promotion_id', { mode: 'number' }),
    promotionGroupId: bigint('promotion_group_id', { mode: 'number' }),
    imageUrl: text('image_url'),
}, (table) => [
    primaryKey({ columns: [table.orderSn, table.orderItemId, table.modelId] }),
]);

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
    order: one(orders, {
        fields: [orderItems.orderSn],
        references: [orders.orderSn],
    }),
}));
