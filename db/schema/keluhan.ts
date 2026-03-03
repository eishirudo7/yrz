import { pgTable, integer, varchar, text, timestamp, bigint, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const keluhan = pgTable('keluhan', {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    idPengguna: varchar('id_pengguna').notNull(),
    namaToko: varchar('nama_toko').notNull(),
    jenisKeluhan: text('jenis_keluhan').notNull(),
    nomorInvoice: varchar('nomor_invoice').notNull().unique(),
    createAt: timestamp('create_at', { withTimezone: true }).defaultNow(),
    statusKeluhan: varchar('status_keluhan').default('BELUM DITANGANI'),
    deskripsiKeluhan: text('deskripsi_keluhan'),
    statusPesanan: text('status_pesanan'),
    shopId: text('shop_id'),
    msgId: text('msg_id'),
    userid: bigint('userid', { mode: 'number' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`(now() AT TIME ZONE 'utc')`),
});
