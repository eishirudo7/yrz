import { pgTable, bigint, text, boolean, timestamp, jsonb, numeric, integer, uuid, unique } from 'drizzle-orm/pg-core';

// ── Items Catalog ──

export const items = pgTable('items', {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    itemId: bigint('item_id', { mode: 'number' }).notNull().unique(),
    shopId: bigint('shop_id', { mode: 'number' }).notNull(),
    categoryId: bigint('category_id', { mode: 'number' }).notNull(),
    itemName: text('item_name').notNull(),
    description: text('description').notNull(),
    itemSku: text('item_sku').notNull(),
    createTime: bigint('create_time', { mode: 'number' }).notNull(),
    updateTime: bigint('update_time', { mode: 'number' }).notNull(),
    weight: numeric('weight'),
    image: jsonb('image'),
    logisticInfo: jsonb('logistic_info'),
    preOrder: jsonb('pre_order'),
    condition: text('condition').notNull(),
    itemStatus: text('item_status').notNull(),
    hasModel: boolean('has_model').notNull().default(false),
    brand: jsonb('brand'),
    itemDangerous: integer('item_dangerous').notNull().default(0),
    descriptionType: text('description_type').notNull(),
    sizeChartId: bigint('size_chart_id', { mode: 'number' }),
    promotionImage: jsonb('promotion_image'),
    deboost: boolean('deboost').notNull().default(false),
    authorisedBrandId: bigint('authorised_brand_id', { mode: 'number' }).notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const itemModels = pgTable('item_models', {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    itemId: bigint('item_id', { mode: 'number' }).notNull().references(() => items.itemId),
    modelId: bigint('model_id', { mode: 'number' }).notNull(),
    modelName: text('model_name').notNull(),
    currentPrice: numeric('current_price').notNull(),
    originalPrice: numeric('original_price').notNull(),
    stockInfo: jsonb('stock_info').notNull(),
    modelStatus: text('model_status').notNull(),
}, (table) => [
    unique('unique_item_model').on(table.itemId, table.modelId),
]);

export const itemVariations = pgTable('item_variations', {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    itemId: bigint('item_id', { mode: 'number' }).notNull().references(() => items.itemId),
    variationId: bigint('variation_id', { mode: 'number' }).notNull(),
    variationName: text('variation_name').notNull(),
    variationOption: jsonb('variation_option').notNull(),
}, (table) => [
    unique('unique_item_variation').on(table.itemId, table.variationId),
]);

// ── OpenAI API Keys ──

export const openaiApi = pgTable('openai_api', {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    apiKey: text('api_key').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ── Pengaturan (User Settings) ──

export const pengaturan = pgTable('pengaturan', {
    id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity(),
    userId: uuid('user_id').notNull().unique(),
    openaiApi: text('openai_api'),
    openaiModel: text('openai_model'),
    openaiTemperature: numeric('openai_temperature'),  // real → numeric (close enough)
    openaiPrompt: text('openai_prompt'),
    autoShipInterval: integer('auto_ship_interval').notNull().default(5),
    inCancelMsg: text('in_cancel_msg'),
    inReturnMsg: text('in_return_msg'),
    inReturnStatus: boolean('in_return_status').default(true),
    inCancelStatus: boolean('in_cancel_status').default(true),
});

// ── SKU Cost Margins ──

export const skuCostMargins = pgTable('sku_cost_margins', {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    itemSku: text('item_sku').notNull(),
    costPrice: numeric('cost_price'),
    marginPercentage: numeric('margin_percentage'),
    isUsingCost: boolean('is_using_cost').notNull().default(false),
    lastUpdatedBy: text('last_updated_by'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    userId: uuid('user_id'),
}, (table) => [
    unique('sku_cost_margins_item_sku_user_id_key').on(table.itemSku, table.userId),
]);

// ── Subscription Plans ──

export const subscriptionPlans = pgTable('subscription_plans', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(),
    description: text('description'),
    price: numeric('price').notNull(),
    maxShops: integer('max_shops').notNull(),
    features: jsonb('features'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ── User Subscriptions ──

export const userSubscriptions = pgTable('user_subscriptions', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    planId: uuid('plan_id').notNull().references(() => subscriptionPlans.id),
    status: text('status').notNull(),  // CHECK: active, cancelled, expired, trial
    startDate: timestamp('start_date', { withTimezone: true }).defaultNow(),
    endDate: timestamp('end_date', { withTimezone: true }),
    paymentStatus: text('payment_status'),
    paymentReference: text('payment_reference'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ── HPP Master ──

export const hppMaster = pgTable('hpp_master', {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    userId: uuid('user_id').notNull(),
    itemSku: text('item_sku').notNull(),
    tier1Variation: text('tier1_variation').notNull(),
    costPrice: numeric('cost_price'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    canonicalSku: text('canonical_sku'),
}, (table) => [
    unique('hpp_master_user_sku_tier1_unique').on(table.userId, table.itemSku, table.tier1Variation),
]);
