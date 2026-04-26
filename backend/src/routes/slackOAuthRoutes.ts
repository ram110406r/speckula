import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createHmac, timingSafeEqual } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseFirestore } from '../lib/firebaseAdmin.js';
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

export default async function slackOAuthRoutes(fastify: FastifyInstance) {
  // GET /auth/slack/install?userId=...
  // User clicks "Connect Slack" on frontend, frontend navigates here.
  // We sign a state token with their userId and redirect to Slack.
  fastify.get(
    '/install',
    async (
      request: FastifyRequest<{ Querystring: { userId?: string } }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.query;
      if (!userId) {
        return reply.code(400).send({ ok: false, error: 'userId query param required' });
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
      return reply.redirect(url.toString());
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

  // GET /auth/slack/channels?userId=...&teamId=...
  // Lists channels from this user's connected workspace.
  fastify.get(
    '/channels',
    async (
      request: FastifyRequest<{ Querystring: { userId?: string; teamId?: string } }>,
      reply: FastifyReply
    ) => {
      const { userId, teamId } = request.query;
      if (!userId || !teamId) {
        return reply.code(400).send({ ok: false, error: 'userId and teamId required' });
      }
      try {
        const token = await getDecryptedBotToken(userId, teamId);
        const channels = await listChannels(token);
        return { ok: true, channels };
      } catch (err) {
        request.log.error({ err }, 'list channels failed');
        return reply.code(500).send({ ok: false, error: (err as Error).message });
      }
    }
  );

  // POST /auth/slack/channels
  // Saves the user's selected channel IDs for a workspace.
  fastify.post(
    '/channels',
    async (
      request: FastifyRequest<{
        Body: { userId: string; teamId: string; selectedChannels: string[] };
      }>,
      reply: FastifyReply
    ) => {
      const { userId, teamId, selectedChannels } = request.body;
      if (!userId || !teamId || !Array.isArray(selectedChannels)) {
        return reply.code(400).send({ ok: false, error: 'userId, teamId, selectedChannels required' });
      }
      const firestore = getFirebaseFirestore();
      await firestore.doc(`users/${userId}/slackWorkspaces/${teamId}`).set(
        { selectedChannels, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      return { ok: true };
    }
  );

  // POST /auth/slack/backfill
  // Pulls historical messages from the user's selected channels and writes them
  // to slackMessages/{teamId}_{slackTs}. Idempotent (set with merge).
  fastify.post(
    '/backfill',
    async (
      request: FastifyRequest<{
        Body: { userId: string; teamId: string; limit?: number };
      }>,
      reply: FastifyReply
    ) => {
      const { userId, teamId, limit: rawLimit = 100 } = request.body;
      const limit = Math.min(Math.max(1, Number(rawLimit) || 100), 1000);
      if (!userId || !teamId) {
        return reply.code(400).send({ ok: false, error: 'userId and teamId required' });
      }
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
        request.log.error({ err }, 'backfill failed');
        return reply.code(500).send({ ok: false, error: (err as Error).message });
      }
    }
  );

  // DELETE /auth/slack/disconnect?userId=...&teamId=...
  // Removes workspace metadata + encrypted token. (Slack-side app stays installed
  // until user removes it from their Slack workspace settings.)
  fastify.delete(
    '/disconnect',
    async (
      request: FastifyRequest<{ Querystring: { userId?: string; teamId?: string } }>,
      reply: FastifyReply
    ) => {
      const { userId, teamId } = request.query;
      if (!userId || !teamId) {
        return reply.code(400).send({ ok: false, error: 'userId and teamId required' });
      }
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
