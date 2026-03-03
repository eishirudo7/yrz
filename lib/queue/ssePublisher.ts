/**
 * SSE Publisher via Redis Pub/Sub
 * Used by Worker to send notifications to the Next.js SSE service
 */

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Dedicated Redis client for publishing (separate from BullMQ connection)
let publisher: Redis | null = null;

function getPublisher(): Redis {
    if (!publisher) {
        publisher = new Redis(REDIS_URL, {
            maxRetriesPerRequest: 1,
            enableReadyCheck: false,
        });
        publisher.on('error', (err) => console.error('[SSE Publisher] Redis error:', err));
    }
    return publisher;
}

/**
 * Publish an SSE event via Redis Pub/Sub
 * The Next.js process subscribes to this channel and broadcasts to connected browsers
 */
export async function publishSSEEvent(data: any): Promise<void> {
    try {
        const redis = getPublisher();
        await redis.publish('sse:events', JSON.stringify(data));
    } catch (error) {
        console.error('[SSE Publisher] Failed to publish event:', error);
    }
}
