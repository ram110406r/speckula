// Redis-backed event bus — publish/subscribe for cross-service events.
// The API server publishes; the WebSocket gateway subscribes and fans out
// events to connected browser clients.

import { getRedis, getRedisSubscriber } from '../lib/redis.js';

export type SpeckulaEvent =
  // Extension lifecycle
  | { type: 'extension.connected';    userId: string; data: Record<string, unknown> }
  | { type: 'extension.disconnected'; userId: string; data: Record<string, unknown> }
  // Analysis job
  | { type: 'analysis.started';       userId: string; data: { jobId: string } }
  | { type: 'analysis.progress';      userId: string; data: { jobId: string; progress: number; status: string } }
  | { type: 'analysis.completed';     userId: string; data: { jobId: string; result: unknown } }
  | { type: 'analysis.failed';        userId: string; data: { jobId: string; error: string } }
  // Intelligence
  | { type: 'insight.created';        userId: string; data: { entryId: string; entryType: string; title: string } }
  | { type: 'market_signal.detected'; userId: string; data: { signalId: string; signalType: string; title: string } }
  | { type: 'competitor.updated';     userId: string; data: { domain: string; insightType: string } }
  // Decisions & outcomes
  | { type: 'decision.created';       userId: string; data: { decisionId: string; title: string; score: number } }
  | { type: 'outcome.recorded';       userId: string; data: { outcomeId: string; decisionId: string; verdict: string } }
  | { type: 'learning.generated';     userId: string; data: { insightId: string; decisionId: string; confidenceShift: number } }
  // Execution
  | { type: 'specification.generated'; userId: string; data: { specId: string; decisionId?: string } }
  | { type: 'roadmap.generated';      userId: string; data: { itemCount: number; quarter: string } }
  | { type: 'experiment.started';     userId: string; data: { experimentId: string; title: string } }
  | { type: 'experiment.completed';   userId: string; data: { experimentId: string; verdict: string } }
  | { type: 'task.created';           userId: string; data: { taskId: string; title: string } }
  // Autonomous agent
  | { type: 'agent.started';          userId: string; data: { runId: string; depth: string } }
  | { type: 'agent.step';             userId: string; data: { runId: string; step: string; payload?: unknown } }
  | { type: 'agent.completed';        userId: string; data: { runId: string; verdict: string; tokensUsed: number } }
  | { type: 'agent.stopped';          userId: string; data: { runId: string } }
  // Product Brain
  | { type: 'product_brain.updated';  userId: string; data: { entryId: string; entryType: string; confidence: number } }
  // Platform
  | { type: 'notification.created';   userId: string; data: { notificationId: string; type: string; title: string } }
  | { type: 'auth.expired';           userId: string; data: Record<string, unknown> };

const CHANNEL_PREFIX = 'speckula:events:';

// Per-userId channel so each user's events are isolated.
const userChannel = (userId: string) => `${CHANNEL_PREFIX}${userId}`;

// Publish an event to a user's channel.
export const publishEvent = async (event: SpeckulaEvent): Promise<void> => {
  const redis = getRedis();
  await redis.publish(userChannel(event.userId), JSON.stringify(event));
};

type EventHandler = (event: SpeckulaEvent) => void;

const handlers = new Map<string, Set<EventHandler>>();

let subscriberBootstrapped = false;

// Subscribe to events for a specific userId.
// Can be called multiple times — handlers are accumulated.
export const subscribeUserEvents = (userId: string, handler: EventHandler): () => void => {
  const channel = userChannel(userId);

  if (!handlers.has(channel)) {
    handlers.set(channel, new Set());
  }
  handlers.get(channel)!.add(handler);

  bootstrapSubscriber();

  const sub = getRedisSubscriber();
  sub.subscribe(channel).catch((err) => {
    console.error(`[eventBus] subscribe error for ${channel}:`, err.message);
  });

  // Return unsubscribe function.
  return () => {
    const set = handlers.get(channel);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        handlers.delete(channel);
        sub.unsubscribe(channel).catch(() => undefined);
      }
    }
  };
};

function bootstrapSubscriber() {
  if (subscriberBootstrapped) return;
  subscriberBootstrapped = true;

  const sub = getRedisSubscriber();
  sub.on('message', (channel: string, message: string) => {
    const set = handlers.get(channel);
    if (!set || set.size === 0) return;
    try {
      const event = JSON.parse(message) as SpeckulaEvent;
      set.forEach((h) => {
        try { h(event); } catch (err) {
          console.error('[eventBus] handler error:', err);
        }
      });
    } catch {
      // Malformed message — ignore.
    }
  });
}
