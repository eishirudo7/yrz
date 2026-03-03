/**
 * Webhook Worker — Standalone process for processing webhook jobs
 * 
 * Run with: npx tsx workers/webhook/index.ts
 * Or via npm: npm run worker:webhook
 */

import { Worker } from 'bullmq';
import { redisConnection } from '@/lib/queue';
import { processWebhookJob } from '@/lib/queue/webhookProcessor';

console.log('[Webhook Worker] Starting...');

const worker = new Worker('webhook-events', processWebhookJob, {
    connection: redisConnection,
    concurrency: 5, // Process up to 5 jobs simultaneously
    limiter: {
        max: 50,       // Max 50 jobs
        duration: 1000, // per second
    },
});

worker.on('ready', () => {
    console.log('[Webhook Worker] Ready and waiting for jobs');
});

worker.on('completed', (job) => {
    console.log(`[Webhook Worker] Job ${job.id} completed (code: ${job.data.code})`);
});

worker.on('failed', (job, err) => {
    console.error(`[Webhook Worker] Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
    console.error('[Webhook Worker] Error:', err);
});

// Graceful shutdown
const shutdown = async () => {
    console.log('[Webhook Worker] Shutting down gracefully...');
    await worker.close();
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[Webhook Worker] Started successfully');
