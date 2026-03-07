import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { HonoAdapter } from '@bull-board/hono';
import { webhookQueue } from '@/lib/queue';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { handle } from 'hono/vercel';

const app = new Hono({ strict: false });

const serverAdapter = new HonoAdapter(serveStatic);
serverAdapter.setBasePath('/api/admin/queues');

createBullBoard({
    queues: [new BullMQAdapter(webhookQueue)],
    serverAdapter,
});

app.route('/api/admin/queues', serverAdapter.registerPlugin());

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
