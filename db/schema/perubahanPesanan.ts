import { pgTable, integer, varchar, text, jsonb, timestamp, bigint } from 'drizzle-orm/pg-core';

export const perubahanPesanan = pgTable('perubahan_pesanan', {
    id: integer('id').generatedByDefaultAsIdentity(),
    idPengguna: varchar('id_pengguna').notNull(),
    namaToko: varchar('nama_toko').notNull(),
    nomorInvoice: varchar('nomor_invoice').unique(),
    perubahan: jsonb('perubahan').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    status: text('status').notNull().default('BARU'),
    statusPesanan: text('status_pesanan'),
    detailPerubahan: text('detail_perubahan'),
    shopId: text('shop_id'),
    msgId: text('msg_id'),
    userid: bigint('userid', { mode: 'number' }).notNull(),
});
