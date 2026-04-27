import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHmac, timingSafeEqual } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseFirestore } from '../lib/firebaseAdmin.js';

interface SlackUrlVerification {
  type: 'url_verification';
  token: string;
  challenge: string;
}

interface SlackEventCallback {
  type: 'event_callback';
  team_id: string;
  event_id: string;
  event_time: number;
  event: {
    type: string;
    channel?: string;
    user?: string;
    text?: string;
    ts?: string;
    bot_id?: string;
    thread_ts?: string;
  };
}

type SlackEventPayload = SlackUrlVerification | SlackEventCallback;

// Slack delivers events at-least-once; the same event_id can arrive multiple times even
// with different timestamps (signature timestamp is per-delivery, not per-event). Dedupe
// in memory for single-instance dev; switch to Redis when scaling out.
const SEEN_EVENT_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_SEEN_EVENTS = 10_000;
const seenEventIds = new Map<string, number>();

function alreadyProcessed(eventId: string): boolean {
  const now = Date.now();
  const expiry = seenEventIds.get(eventId);
  if (expiry && expiry > now) return true;

  // Stale entry for this id (or first sight): remove first so the re-set
  // below moves it to the end of insertion order, keeping the eviction
  // queue accurate as a recency queue.
  if (expiry !== undefined) seenEventIds.delete(eventId);

  if (seenEventIds.size >= MAX_SEEN_EVENTS) {
    // Sweep TTL-expired entries before falling back to oldest-insertion
    // eviction. Otherwise long-lived expired entries sit at the front of
    // the map and we end up evicting fresh entries while stale ones leak.
    for (const [key, exp] of seenEventIds) {
      if (exp <= now) seenEventIds.delete(key);
    }
    if (seenEventIds.size >= MAX_SEEN_EVENTS) {
      const oldest = seenEventIds.keys().next().value;
      if (oldest) seenEventIds.delete(oldest);
    }
  }
  seenEventIds.set(eventId, now + SEEN_EVENT_TTL_MS);
  return false;
}

function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  rawBody: string,
  signature: string
): boolean {
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp, 10) < fiveMinutesAgo) return false;

  const sigBaseString = `v0:${timestamp}:${rawBody}`;
  const computed =
    'v0=' +
    createHmac('sha256', signingSecret).update(sigBaseString).digest('hex');

  const a = Buffer.from(computed);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export default async function slackRoutes(fastify: FastifyInstance) {
  fastify.removeContentTypeParser('application/json');
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body: Buffer, done) => {
      const text = body.toString('utf-8');
      (req as FastifyRequest & { rawBody?: string }).rawBody = text;
      try {
        done(null, text.length ? JSON.parse(text) : {});
      } catch (err) {
        done(err as Error);
      }
    }
  );

  fastify.post(
    '/events',
    async (
      request: FastifyRequest<{ Body: SlackEventPayload }>,
      reply: FastifyReply
    ) => {
      const body = request.body;
      request.log.info({ type: (body as any)?.type }, 'slack events hit');

      if (body && (body as SlackUrlVerification).type === 'url_verification') {
        const { challenge } = body as SlackUrlVerification;
        request.log.info({ challenge }, 'responding to url_verification');
        reply.header('Content-Type', 'text/plain');
        return reply.code(200).send(challenge);
      }

      const signingSecret = process.env.SLACK_SIGNING_SECRET;
      const timestamp = request.headers['x-slack-request-timestamp'] as string;
      const signature = request.headers['x-slack-signature'] as string;
      const rawBody =
        (request as FastifyRequest & { rawBody?: string }).rawBody || '';

      if (!signingSecret) {
        request.log.warn('SLACK_SIGNING_SECRET not set — skipping signature check');
      } else if (timestamp && signature) {
        if (!verifySlackSignature(signingSecret, timestamp, rawBody, signature)) {
          return reply.code(401).send({ error: 'invalid signature' });
        }
      } else {
        return reply.code(401).send({ error: 'missing signature headers' });
      }

      reply.code(200).send();

      if ((body as SlackEventCallback).type === 'event_callback') {
        const { event, team_id, event_id } = body as SlackEventCallback;
        if (event.bot_id) return;

        if (event_id && alreadyProcessed(event_id)) {
          request.log.debug({ event_id }, 'duplicate slack event_id; skipping');
          return;
        }

        request.log.info(
          { team_id, event_id, eventType: event.type, user: event.user },
          'slack event received'
        );

        try {
          const firestore = getFirebaseFirestore();

          // Multi-tenant: look up which Buildcase user owns this Slack workspace.
          const installSnap = await firestore.doc(`slackInstallations/${team_id}`).get();
          if (!installSnap.exists) {
            request.log.warn({ team_id }, 'no installation record for incoming team_id; skipping');
            return;
          }
          const ownerUserId = (installSnap.data() as { ownerUserId: string }).ownerUserId;

          // Only persist messages from channels the owner has explicitly selected.
          const wsSnap = await firestore.doc(`users/${ownerUserId}/slackWorkspaces/${team_id}`).get();
          if (!wsSnap.exists) return;
          const selectedChannels = (wsSnap.data() as { selectedChannels?: string[] }).selectedChannels ?? [];
          if (event.channel && selectedChannels.length > 0 && !selectedChannels.includes(event.channel)) {
            request.log.debug(
              { team_id, channel: event.channel, ownerUserId },
              'channel not in selected list; skipping'
            );
            return;
          }

          const slackTs = event.ts ?? `${Date.now() / 1000}`;
          // Use teamId + slackTs as deterministic doc id for natural dedup on
          // Slack's at-least-once delivery.
          const docId = `${team_id}_${slackTs}`;
          await firestore.collection('slackMessages').doc(docId).set(
            {
              teamId: team_id,
              channelId: event.channel ?? null,
              userId: event.user ?? null,
              text: event.text ?? '',
              slackTs,
              threadTs: event.thread_ts ?? null,
              eventType: event.type,
              eventId: event_id,
              ownerUserId,
              source: 'event',
              createdAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        } catch (error) {
          request.log.error({ err: error }, 'failed to persist slack event to firestore');
        }
      }
    }
  );

  fastify.get('/health', async () => ({ status: 'slack ok' }));
}
