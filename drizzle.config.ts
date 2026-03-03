import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    schema: './db/schema/index.ts',
    out: './db/migrations',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL || 'postgresql://yorozuya@localhost:5432/omniyrz',
    },
    verbose: true,
    strict: true,
});
