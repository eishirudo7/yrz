import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

const runMigration = async () => {
    console.log('⏳ Memulai proses auto-migrate database...');

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL tidak ditemukan!');
    }

    // Gunakan max: 1 agar migrasi berjalan mulus tanpa pool limits error
    const migrationClient = postgres(connectionString, { max: 1 });
    const db = drizzle(migrationClient);

    try {
        // 1. Jalankan Drizzle Migrations (Create Tables)
        console.log('📦 Applying Drizzle schema migrations...');
        await migrate(db, { migrationsFolder: path.join(process.cwd(), 'db/migrations') });
        console.log('✅ Schema migrations berhasil diaplikasikan.');

        // 2. Jalankan Custom SQL (Indexes)
        console.log('⚡ Applying Custom Indexes...');
        const indexesSql = fs.readFileSync(path.join(process.cwd(), 'db/migrations/custom/indexes.sql'), 'utf-8');
        await migrationClient.unsafe(indexesSql);
        console.log('✅ Custom Indexes berhasil diaplikasikan.');

        // 3. Jalankan Custom SQL (Triggers)
        console.log('⚙️ Applying Custom Triggers...');
        const triggersSql = fs.readFileSync(path.join(process.cwd(), 'db/migrations/custom/triggers.sql'), 'utf-8');
        await migrationClient.unsafe(triggersSql);
        console.log('✅ Custom Triggers berhasil diaplikasikan.');

        console.log('🎉 SEMUA MIGRASI DATABASE BERHASIL!');
    } catch (error) {
        console.error('❌ MIGRASI GAGAL:', error);
        process.exit(1);
    } finally {
        await migrationClient.end();
    }
};

runMigration();
