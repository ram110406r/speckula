import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db.js';

const requireUserId = (request: FastifyRequest, reply: FastifyReply): string | null => {
  const uid = request.userId;
  if (!uid) { reply.code(401).send({ ok: false, error: 'unauthorized' }); return null; }
  return uid;
};

const markReadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
}).strict();

export default async function notificationRoutes(fastify: FastifyInstance) {

  // GET /notifications — inbox (latest 50, unread first).
  fastify.get('/', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const params = request.query as { unreadOnly?: string; limit?: string };
    const limit = Math.min(parseInt(params.limit ?? '50', 10), 100);
    const unreadOnly = params.unreadOnly === 'true';

    const where: Record<string, unknown> = { userId };
    if (unreadOnly) where.read = false;

    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
        take: limit,
      }),
      db.notification.count({ where: { userId, read: false } }),
    ]);

    reply.code(200).send({
      ok: true,
      data: {
        notifications: notifications.map((n) => ({
          ...n,
          metadata: n.metadata ? JSON.parse(n.metadata) : null,
        })),
        unreadCount,
      },
    });
  });

  // POST /notifications/read — mark specific notifications as read.
  fastify.post('/read', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const body = markReadSchema.safeParse(request.body);
    if (!body.success) {
      reply.code(400).send({ ok: false, error: 'ids array required' });
      return;
    }

    await db.notification.updateMany({
      where: { id: { in: body.data.ids }, userId, read: false },
      data: { read: true, readAt: new Date() },
    });

    reply.code(200).send({ ok: true });
  });

  // POST /notifications/read-all — mark all unread notifications as read.
  fastify.post('/read-all', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    await db.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });

    reply.code(200).send({ ok: true });
  });

  // DELETE /notifications/:id
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const note = await db.notification.findUnique({ where: { id: request.params.id } });
    if (!note || note.userId !== userId) {
      reply.code(404).send({ ok: false, error: 'Not found' });
      return;
    }

    await db.notification.delete({ where: { id: request.params.id } });
    reply.code(200).send({ ok: true });
  });

  // DELETE /notifications — clear all notifications for the user.
  fastify.delete('/', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    await db.notification.deleteMany({ where: { userId } });
    reply.code(200).send({ ok: true });
  });
}
