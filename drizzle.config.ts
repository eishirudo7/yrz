import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    schema: './db/schema/index.ts',
    out: './db/migrations',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL || 'postgresql://omniyrz:4Nsatsuu@43.156.75.167:5432/omniyrz',
    },
    verbose: true,
    strict: true,
});
