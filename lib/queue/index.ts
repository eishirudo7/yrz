/**
 * BullMQ Queue Configuration
 * Shared queue instance for webhook processing
 */

import { Queue, QueueEvents } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function parseRedisConnection(url: string) {
    const parsed = new URL(url);
    return {
        host: parsed.hostname,
        port: parseInt(parsed.port) || 6379,
        password: parsed.password || undefined,
        username: parsed.username || undefined,
        ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
    };
}

export const redisConnection = parseRedisConnection(REDIS_URL);

// Webhook events queue
export const webhookQueue = new Queue('webhook-events', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
        removeOnComplete: {
            age: 3600,   // Keep completed jobs for 1 hour
            count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
            age: 86400,  // Keep failed jobs for 24 hours
        },
    },
});

// Queue event monitoring (optional, for logging)
export const webhookQueueEvents = new QueueEvents('webhook-events', {
    connection: redisConnection,
});

webhookQueueEvents.on('completed', ({ jobId }) => {
    console.log(`[Queue] Job ${jobId} completed`);
});

webhookQueueEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`[Queue] Job ${jobId} failed: ${failedReason}`);
});
