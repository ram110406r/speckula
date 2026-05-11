// WebSocket gateway — authenticated realtime channel per user.
//
// Connection flow:
//   1. Client connects to ws(s)://api/ws?token=<firebase_id_token>
//   2. Server verifies token → extracts userId + workspaceId
//   3. Client is registered in wsManager and subscribed to their Redis channel
//   4. Bidirectional: server pushes events; client sends ping/subscribe commands
//
// Client → Server messages:
//   { type: "ping" }                          → pong
//   { type: "subscribe", channel: "..." }     → acknowledge (future: filtered subscriptions)
//
// Server → Client messages:
//   All SpeckulaEvent shapes (see eventBus.ts)

import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import { verifyFirebaseIdToken } from '../lib/firebaseAdmin.js';
import { wsManager } from '../services/websocketManager.js';
import { publishEvent } from '../services/eventBus.js';
import { db } from '../lib/db.js';

export default async function websocketRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/ws',
    { websocket: true },
    async (socket: WebSocket, request) => {
      // Extract token from query string or Authorization header.
      const url = new URL(request.url, 'http://localhost');
      const token = url.searchParams.get('token') ?? request.headers['authorization']?.replace('Bearer ', '');

      if (!token) {
        socket.send(JSON.stringify({ type: 'error', code: 'unauthorized', message: 'Token required' }));
        socket.close(1008, 'Token required');
        return;
      }

      let userId: string;
      try {
        const decoded = await verifyFirebaseIdToken(token);
        userId = decoded.uid as string;
      } catch {
        socket.send(JSON.stringify({ type: 'error', code: 'unauthorized', message: 'Invalid token' }));
        socket.close(1008, 'Invalid token');
        return;
      }

      const connectionId = crypto.randomUUID();
      const workspaceId = url.searchParams.get('workspaceId') ?? null;

      await wsManager.register(connectionId, socket, userId, workspaceId, {
        userAgent: request.headers['user-agent'],
        ip:        request.ip,
      });

      publishEvent({ type: 'extension.connected', userId, data: { connectionId } }).catch(() => undefined);

      // Send welcome message with connectionId so the client can reference it.
      socket.send(JSON.stringify({
        type:         'connected',
        connectionId,
        userId,
        serverTime:   new Date().toISOString(),
      }));

      // ── Message handler ────────────────────────────────────────────────────
      socket.on('message', (raw: Buffer | string) => {
        let msg: { type?: string; channel?: string } = {};
        try { msg = JSON.parse(raw.toString()); } catch { return; }

        if (msg.type === 'ping') {
          wsManager.ping(connectionId);
          socket.send(JSON.stringify({ type: 'pong', serverTime: new Date().toISOString() }));
        }
        // Future: workspace channel subscriptions, filtered event types, etc.
      });

      // ── Close handler ──────────────────────────────────────────────────────
      socket.on('close', async () => {
        await wsManager.unregister(connectionId);
        publishEvent({ type: 'extension.disconnected', userId, data: { connectionId } }).catch(() => undefined);
      });

      // ── Error handler ──────────────────────────────────────────────────────
      socket.on('error', async (err: Error) => {
        fastify.log.warn({ err, connectionId, userId }, 'WebSocket error');
        await wsManager.unregister(connectionId);
      });
    }
  );

  // GET /ws/connections — admin endpoint: active connection count.
  fastify.get('/ws/connections', async (request, reply) => {
    const metricsToken = process.env.METRICS_TOKEN;
    if (metricsToken) {
      const provided = (request.headers['x-metrics-token'] as string | undefined) ?? '';
      if (provided !== metricsToken) {
        reply.code(403).send({ ok: false, error: 'Forbidden' });
        return;
      }
    }
    reply.code(200).send({
      ok: true,
      data: { activeConnections: wsManager.activeCount() },
    });
  });
}
