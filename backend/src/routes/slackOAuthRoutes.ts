import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createHmac, timingSafeEqual } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getFirebaseFirestore } from '../lib/firebaseAdmin.js';
import { verifyFirebaseAuth } from '../lib/firebaseAuth.js';
import { encryptToken, decryptToken } from '../lib/tokenCrypto.js';
import {
  exchangeOAuthCode,
  listChannels,
  fetchChannelHistory,
} from '../lib/slackApi.js';

const STATE_TTL_MS = 10 * 60 * 1000; // 10 min
const FRONTEND_URL = () => process.env.FRONTEND_URL || 'http://localhost:3000';

// ─── State signing (so we know which Buildcase user is installing) ─────────
const stateSecret = (): string => {
  // Reuse signing secret as the HMAC key for state to keep one less env var.
  const s = process.env.SLACK_SIGNING_SECRET;
  if (!s) throw new Error('SLACK_SIGNING_SECRET required for OAuth state signing');
  return s;
};

const signState = (userId: string): string => {
  const ts = Date.now().toString();
  const data = `${userId}:${ts}`;
  const sig = createHmac('sha256', stateSecret()).update(data).digest('hex');
  return Buffer.from(`${data}:${sig}`).toString('base64url');
};

const verifyState = (state: string): { userId: string } | null => {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return null;
    const [userId, ts, sig] = parts;
    const data = `${userId}:${ts}`;
    const expected = createHmac('sha256', stateSecret()).update(data).digest('hex');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    if (Date.now() - parseInt(ts, 10) > STATE_TTL_MS) return null;
    return { userId };
  } catch {
    return null;
  }
};

// ─── Token retrieval helper used by other routes ───────────────────────────
export const getDecryptedBotToken = async (userId: string, teamId: string): Promise<string> => {
  const firestore = getFirebaseFirestore();
  const snap = await firestore.doc(`users/${userId}/slackWorkspaces/${teamId}`).get();
  if (!snap.exists) throw new Error('workspace not connected');
  const tokenSnap = await firestore.doc(`slackInstallations/${teamId}`).get();
  if (!tokenSnap.exists) throw new Error('token missing');
  const data = tokenSnap.data() as { encryptedBotToken: string; ownerUserId: string };
  if (data.ownerUserId !== userId) throw new Error('owner mismatch');
  return decryptToken(data.encryptedBotToken);
};

const BOT_SCOPES = [
  'channels:history',
  'channels:read',
  'groups:history',
  'groups:read',
  'im:history',
  'users:read',
  'chat:write',
  'team:read',
].join(',');

const channelsBodySchema = z.object({
  teamId: z.string().min(1),
  selectedChannels: z.array(z.string().min(1)).max(500),
});

const backfillBodySchema = z.object({
  teamId: z.string().min(1),
  limit: z.number().int().min(1).max(1000).optional(),
});

const teamIdQuerySchema = z.object({
  teamId: z.string().min(1),
});

export default async function slackOAuthRoutes(fastify: FastifyInstance) {
  // POST /auth/slack/install
  // Authenticated. We derive userId from the verified ID token (never trust
  // the client to tell us who they are), sign a state token, and return the
  // OAuth URL for the frontend to redirect to.
  fastify.post(
    '/install',
    { preHandler: verifyFirebaseAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userId;
      if (!userId) {
        return reply.code(401).send({ ok: false, error: 'unauthorized' });
      }
      const clientId = process.env.SLACK_CLIENT_ID;
      const redirectUri = process.env.SLACK_REDIRECT_URI;
      if (!clientId || !redirectUri) {
        return reply.code(500).send({ ok: false, error: 'SLACK_CLIENT_ID or SLACK_REDIRECT_URI not configured' });
      }
      const state = signState(userId);
      const url = new URL('https://slack.com/oauth/v2/authorize');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('scope', BOT_SCOPES);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('state', state);
      return { ok: true, authorizeUrl: url.toString() };
    }
  );

  // GET /auth/slack/callback?code=...&state=...
  // Slack hits this after user approves. We exchange the code for a bot token,
  // store metadata in user-readable doc, store encrypted token in admin-only doc,
  // then redirect the user back to the frontend.
  fastify.get(
    '/callback',
    async (
      request: FastifyRequest<{ Querystring: { code?: string; state?: string; error?: string } }>,
      reply: FastifyReply
    ) => {
      const { code, state, error } = request.query;
      if (error) {
        return reply.redirect(`${FRONTEND_URL()}/?slack=denied`);
      }
      if (!code || !state) {
        return reply.code(400).send({ ok: false, error: 'missing code or state' });
      }
      const verified = verifyState(state);
      if (!verified) {
        return reply.code(401).send({ ok: false, error: 'invalid or expired state' });
      }
      const clientId = process.env.SLACK_CLIENT_ID;
      const clientSecret = process.env.SLACK_CLIENT_SECRET;
      const redirectUri = process.env.SLACK_REDIRECT_URI;
      if (!clientId || !clientSecret || !redirectUri) {
        return reply.code(500).send({ ok: false, error: 'slack oauth env not configured' });
      }
      try {
        const oauth = await exchangeOAuthCode({ code, clientId, clientSecret, redirectUri });
        const firestore = getFirebaseFirestore();
        const teamId = oauth.team.id;
        const userId = verified.userId;

        // User-readable workspace metadata (no token).
        await firestore.doc(`users/${userId}/slackWorkspaces/${teamId}`).set(
          {
            teamId,
            teamName: oauth.team.name,
            botUserId: oauth.bot_user_id,
            installedBy: oauth.authed_user.id,
            scope: oauth.scope,
            selectedChannels: [],
            backfillCompleted: false,
            installedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // Admin-only encrypted token + reverse lookup (teamId -> ownerUserId).
        await firestore.doc(`slackInstallations/${teamId}`).set({
          teamId,
          ownerUserId: userId,
          encryptedBotToken: encryptToken(oauth.access_token),
          botUserId: oauth.bot_user_id,
          installedAt: FieldValue.serverTimestamp(),
        });

        return reply.redirect(
          `${FRONTEND_URL()}/?slack=connected&teamId=${encodeURIComponent(teamId)}`
        );
      } catch (err) {
        request.log.error({ err }, 'slack oauth callback failed');
        return reply.redirect(`${FRONTEND_URL()}/?slack=error`);
      }
    }
  );

  // GET /auth/slack/channels?teamId=...
  // Authenticated. Lists channels from the calling user's workspace.
  fastify.get<{ Querystring: { teamId?: string } }>(
    '/channels',
    { preHandler: verifyFirebaseAuth },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) return reply.code(401).send({ ok: false, error: 'unauthorized' });
      const parsed = teamIdQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({ ok: false, error: 'teamId required' });
      }
      try {
        const token = await getDecryptedBotToken(userId, parsed.data.teamId);
        const channels = await listChannels(token);
        return { ok: true, channels };
      } catch (err) {
        if ((err as { code?: string })?.code === 'TOKEN_DECRYPT_FAILED') {
          return reply.code(401).send({ ok: false, error: (err as Error).message });
        }
        request.log.error({ err }, 'list channels failed');
        return reply.code(500).send({ ok: false, error: 'failed to list channels' });
      }
    }
  );

  // POST /auth/slack/channels
  // Authenticated. Saves the calling user's selected channel IDs.
  fastify.post(
    '/channels',
    { preHandler: verifyFirebaseAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userId;
      if (!userId) return reply.code(401).send({ ok: false, error: 'unauthorized' });
      const parsed = channelsBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ ok: false, error: 'invalid body', details: parsed.error.flatten() });
      }
      const { teamId, selectedChannels } = parsed.data;
      const firestore = getFirebaseFirestore();
      // Confirm the workspace doc actually belongs to this user before writing.
      const wsSnap = await firestore.doc(`users/${userId}/slackWorkspaces/${teamId}`).get();
      if (!wsSnap.exists) {
        return reply.code(404).send({ ok: false, error: 'workspace not connected' });
      }
      await firestore.doc(`users/${userId}/slackWorkspaces/${teamId}`).set(
        { selectedChannels, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      return { ok: true };
    }
  );

  // POST /auth/slack/backfill
  // Authenticated. Pulls history for the calling user's selected channels.
  fastify.post(
    '/backfill',
    { preHandler: verifyFirebaseAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userId;
      if (!userId) return reply.code(401).send({ ok: false, error: 'unauthorized' });
      const parsed = backfillBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ ok: false, error: 'invalid body', details: parsed.error.flatten() });
      }
      const { teamId, limit: rawLimit = 100 } = parsed.data;
      const limit = Math.min(Math.max(1, Number(rawLimit) || 100), 1000);
      try {
        const firestore = getFirebaseFirestore();
        const wsSnap = await firestore.doc(`users/${userId}/slackWorkspaces/${teamId}`).get();
        if (!wsSnap.exists) {
          return reply.code(404).send({ ok: false, error: 'workspace not connected' });
        }
        const ws = wsSnap.data() as { selectedChannels: string[]; botUserId: string };
        if (!ws.selectedChannels?.length) {
          return reply.code(400).send({ ok: false, error: 'no channels selected' });
        }

        const token = await getDecryptedBotToken(userId, teamId);
        let totalIngested = 0;
        const errors: { channel: string; error: string }[] = [];

        for (const channelId of ws.selectedChannels) {
          try {
            const messages = await fetchChannelHistory(token, channelId, { limit });
            const batch = firestore.batch();
            for (const msg of messages) {
              if (msg.bot_id) continue; // skip bot messages
              if (!msg.ts) continue;
              const docRef = firestore.collection('slackMessages').doc(`${teamId}_${msg.ts}`);
              batch.set(
                docRef,
                {
                  teamId,
                  channelId,
                  userId: msg.user ?? null,
                  text: msg.text ?? '',
                  slackTs: msg.ts,
                  threadTs: msg.thread_ts ?? null,
                  eventType: 'message',
                  ownerUserId: userId,
                  source: 'backfill',
                  createdAt: FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
              totalIngested += 1;
            }
            await batch.commit();
          } catch (err) {
            errors.push({ channel: channelId, error: (err as Error).message });
          }
        }

        await firestore.doc(`users/${userId}/slackWorkspaces/${teamId}`).set(
          { backfillCompleted: true, lastBackfillAt: FieldValue.serverTimestamp() },
          { merge: true }
        );

        return { ok: true, ingested: totalIngested, errors };
      } catch (err) {
        if ((err as { code?: string })?.code === 'TOKEN_DECRYPT_FAILED') {
          return reply.code(401).send({ ok: false, error: (err as Error).message });
        }
        request.log.error({ err }, 'backfill failed');
        return reply.code(500).send({ ok: false, error: 'backfill failed' });
      }
    }
  );

  // DELETE /auth/slack/disconnect?teamId=...
  // Authenticated. Removes the calling user's workspace + encrypted token.
  fastify.delete<{ Querystring: { teamId?: string } }>(
    '/disconnect',
    { preHandler: verifyFirebaseAuth },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) return reply.code(401).send({ ok: false, error: 'unauthorized' });
      const parsed = teamIdQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({ ok: false, error: 'teamId required' });
      }
      const { teamId } = parsed.data;
      const firestore = getFirebaseFirestore();
      await firestore.doc(`users/${userId}/slackWorkspaces/${teamId}`).delete();
      const tokenSnap = await firestore.doc(`slackInstallations/${teamId}`).get();
      if (tokenSnap.exists && (tokenSnap.data() as { ownerUserId: string }).ownerUserId === userId) {
        await firestore.doc(`slackInstallations/${teamId}`).delete();
      }
      return { ok: true };
    }
  );
}
