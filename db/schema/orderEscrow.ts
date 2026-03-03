import { pgTable, varchar, bigint, numeric, timestamp, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { orders } from './orders';
import { shopeeTokens } from './shopeeTokens';

export const orderEscrow = pgTable('order_escrow', {
    orderSn: varchar('order_sn').primaryKey().references(() => orders.orderSn),
    shopId: bigint('shop_id', { mode: 'number' }).notNull().references(() => shopeeTokens.shopId),
    escrowAmount: numeric('escrow_amount'),
    buyerTotalAmount: numeric('buyer_total_amount'),
    originalPrice: numeric('original_price'),
    sellerDiscount: numeric('seller_discount'),
    shopeeDiscount: numeric('shopee_discount'),
    voucherFromSeller: numeric('voucher_from_seller'),
    commissionFee: numeric('commission_fee'),
    serviceFee: numeric('service_fee'),
    sellerTransactionFee: numeric('seller_transaction_fee'),
    actualShippingFee: numeric('actual_shipping_fee'),
    buyerPaymentMethod: varchar('buyer_payment_method'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    escrowAmountAfterAdjustment: numeric('escrow_amount_after_adjustment').default('0'),
    amsCommissionFee: numeric('ams_commission_fee'),
}, (table) => [
    unique('unique_order_shop').on(table.orderSn, table.shopId),
]);

export const orderEscrowRelations = relations(orderEscrow, ({ one }) => ({
    order: one(orders, {
        fields: [orderEscrow.orderSn],
        references: [orders.orderSn],
    }),
    shop: one(shopeeTokens, {
        fields: [orderEscrow.shopId],
        references: [shopeeTokens.shopId],
    }),
}));
