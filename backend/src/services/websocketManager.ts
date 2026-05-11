// WebSocket connection registry.
// Tracks live connections keyed by connectionId so the event bus can fan out
// events to all connections belonging to a userId.

import type { WebSocket } from '@fastify/websocket';
import { db } from '../lib/db.js';
import { subscribeUserEvents, type SpeckulaEvent } from './eventBus.js';

interface ConnectionEntry {
  ws: WebSocket;
  userId: string;
  workspaceId: string | null;
  unsubscribe: () => void;
}

// In-memory registry — the source of truth for the current process.
// Multi-process deploys need to route via the event bus instead of this map.
const connections = new Map<string, ConnectionEntry>();

export const wsManager = {
  // Register a new authenticated WebSocket connection.
  async register(
    connectionId: string,
    ws: WebSocket,
    userId: string,
    workspaceId: string | null,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    // Subscribe to user events from the Redis event bus.
    const unsubscribe = subscribeUserEvents(userId, (event) => {
      this.sendToUser(userId, event);
    });

    connections.set(connectionId, { ws, userId, workspaceId, unsubscribe });

    // Persist to DB for observability (best-effort).
    db.webSocketConnection.create({
      data: {
        connectionId,
        userId,
        workspaceId,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      },
    }).catch(() => undefined);
  },

  // Remove a connection on close or error.
  async unregister(connectionId: string): Promise<void> {
    const entry = connections.get(connectionId);
    if (!entry) return;
    entry.unsubscribe();
    connections.delete(connectionId);

    db.webSocketConnection.deleteMany({ where: { connectionId } }).catch(() => undefined);
  },

  // Send an event to all active connections for a userId.
  sendToUser(userId: string, payload: SpeckulaEvent | Record<string, unknown>): void {
    for (const [, entry] of connections) {
      if (entry.userId !== userId) continue;
      if (entry.ws.readyState !== 1 /* OPEN */) continue;
      try {
        entry.ws.send(JSON.stringify(payload));
      } catch {
        // Connection may have closed mid-send — ignore.
      }
    }
  },

  // Broadcast to all connections for a specific workspace.
  sendToWorkspace(workspaceId: string, payload: Record<string, unknown>): void {
    for (const [, entry] of connections) {
      if (entry.workspaceId !== workspaceId) continue;
      if (entry.ws.readyState !== 1) continue;
      try {
        entry.ws.send(JSON.stringify(payload));
      } catch { /* ignore */ }
    }
  },

  // Update last-ping timestamp for a connection.
  ping(connectionId: string): void {
    db.webSocketConnection.update({
      where: { connectionId },
      data: { lastPingAt: new Date() },
    }).catch(() => undefined);
  },

  activeCount(): number {
    return connections.size;
  },

  // Sweep stale DB rows (connections that died without a clean unregister).
  async sweepStale(): Promise<void> {
    const staleThreshold = new Date(Date.now() - 2 * 60 * 1000);
    await db.webSocketConnection.deleteMany({
      where: { lastPingAt: { lt: staleThreshold } },
    }).catch(() => undefined);
  },
};
