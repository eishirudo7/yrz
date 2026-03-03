import { pgTable, varchar, integer, text, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { orders } from './orders';

export const logistic = pgTable('logistic', {
    orderSn: varchar('order_sn').notNull().references(() => orders.orderSn),
    packageNumber: varchar('package_number').notNull(),
    logisticsStatus: varchar('logistics_status'),
    shippingCarrier: varchar('shipping_carrier'),
    parcelChargeableWeightGram: integer('parcel_chargeable_weight_gram'),
    recipientName: varchar('recipient_name'),
    recipientPhone: varchar('recipient_phone'),
    recipientTown: varchar('recipient_town'),
    recipientDistrict: varchar('recipient_district'),
    recipientCity: varchar('recipient_city'),
    recipientState: varchar('recipient_state'),
    recipientRegion: varchar('recipient_region'),
    recipientZipcode: varchar('recipient_zipcode'),
    recipientFullAddress: text('recipient_full_address'),
    trackingNumber: text('tracking_number'),
}, (table) => [
    primaryKey({ columns: [table.orderSn, table.packageNumber] }),
]);

export const logisticRelations = relations(logistic, ({ one }) => ({
    order: one(orders, {
        fields: [logistic.orderSn],
        references: [orders.orderSn],
    }),
}));
