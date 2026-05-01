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

// Slack delivers events at-least-once; the same event_id can arrive multiple
// times even with different timestamps (signature timestamp is per-delivery,
// not per-event). We dedupe via a Firestore document with a `create()`
// (compare-and-swap): the second replica sees ALREADY_EXISTS and skips.
// In-memory cache fronts Firestore so back-to-back retries from a single
// replica don't issue redundant writes.
const SEEN_EVENT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_SEEN_EVENTS = 10_000;
const seenEventIds = new Map<string, number>();

function localAlreadyProcessed(eventId: string): boolean {
  const now = Date.now();
  const expiry = seenEventIds.get(eventId);
  if (expiry && expiry > now) return true;
  if (expiry !== undefined) seenEventIds.delete(eventId);
  if (seenEventIds.size >= MAX_SEEN_EVENTS) {
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

async function alreadyProcessed(eventId: string): Promise<boolean> {
  if (localAlreadyProcessed(eventId)) return true;

  const firestore = getFirebaseFirestore();
  const ref = firestore.collection('slackEventDedupe').doc(eventId);
  try {
    await ref.create({
      processedAt: FieldValue.serverTimestamp(),
      // Soft-TTL hint; an external job can sweep entries older than this.
      expiresAt: new Date(Date.now() + SEEN_EVENT_TTL_MS),
    });
    return false;
  } catch (err) {
    // Firestore returns ALREADY_EXISTS (code 6) when another replica won
    // the race. Anything else, log and conservatively process the event
    // — a duplicate is preferable to silently dropping a legitimate one.
    const code = (err as { code?: number | string } | undefined)?.code;
    if (code === 6 || code === 'already-exists') return true;
    return false;
  }
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

const MAX_SLACK_PAYLOAD_BYTES = 1024 * 1024; // 1 MB — Slack events are typically < 50 KB

export default async function slackRoutes(fastify: FastifyInstance) {
  fastify.removeContentTypeParser('application/json');
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body: Buffer, done) => {
      // Prevent DoS via unbounded payload: Slack events never exceed ~50 KB,
      // so reject anything larger than 1 MB to prevent memory exhaustion.
      if (body.length > MAX_SLACK_PAYLOAD_BYTES) {
        done(new Error(`Payload too large: ${body.length} bytes exceeds ${MAX_SLACK_PAYLOAD_BYTES} byte limit`));
        return;
      }
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
      request.log.info({ type: (body as { type?: string } | undefined)?.type }, 'slack events hit');

      const signingSecret = process.env.SLACK_SIGNING_SECRET;
      const timestamp = request.headers['x-slack-request-timestamp'] as string;
      const signature = request.headers['x-slack-signature'] as string;
      const rawBody =
        (request as FastifyRequest & { rawBody?: string }).rawBody || '';

      // Fail closed: never accept Slack events without a verified signature.
      // A missing/typo'd signing secret in production would otherwise let
      // any caller forge events and inject Firestore writes under a
      // legitimate ownerUserId.
      if (!signingSecret) {
        request.log.error('SLACK_SIGNING_SECRET not set — rejecting slack event');
        return reply.code(503).send({ error: 'slack signing secret not configured' });
      }
      if (!timestamp || !signature) {
        return reply.code(401).send({ error: 'missing signature headers' });
      }
      if (!verifySlackSignature(signingSecret, timestamp, rawBody, signature)) {
        return reply.code(401).send({ error: 'invalid signature' });
      }

      // Slack URL verification handshake — only respond after the signature
      // has been validated, otherwise an unauthenticated caller can use
      // /slack/events as a reflection oracle for arbitrary `challenge` values.
      if (body && (body as SlackUrlVerification).type === 'url_verification') {
        const { challenge } = body as SlackUrlVerification;
        reply.header('Content-Type', 'text/plain');
        return reply.code(200).send(challenge);
      }

      // Reject future-timestamped requests too (defense in depth; valid Slack
      // events arrive with timestamps within ~a few seconds of now).
      const nowSec = Math.floor(Date.now() / 1000);
      if (parseInt(timestamp, 10) > nowSec + 60) {
        return reply.code(401).send({ error: 'timestamp in future' });
      }

      reply.code(200).send();

      if ((body as SlackEventCallback).type === 'event_callback') {
        const { event, team_id, event_id } = body as SlackEventCallback;
        if (event.bot_id) return;

        if (event_id && (await alreadyProcessed(event_id))) {
          request.log.debug({ event_id }, 'duplicate slack event_id; skipping');
          return;
        }

        request.log.info(
          { team_id, event_id, eventType: event.type, user: event.user },
          'slack event received'
        );

        try {
          const firestore = getFirebaseFirestore();

          // Multi-tenant: look up which Speckula user owns this Slack workspace.
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
