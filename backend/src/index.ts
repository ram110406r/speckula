import * as Sentry from '@sentry/node';
import dotenv from 'dotenv';
import createServer from './app';
import { db, disconnectDb } from './lib/db';
import { getFirebaseApp } from './lib/firebaseAdmin';
import { validateEnv } from './lib/env';
import { sweepExpiredRecords } from './scripts/retentionSweeper';
import { sendWeeklyDigest } from './scripts/weeklyDigest';

// Load environment variables before Sentry so DSN is available.
dotenv.config();

// Initialize Sentry as early as possible. Skipped gracefully when SENTRY_DSN
// is unset (dev environments) — never crashes the server on missing config.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
  });
}

let env: ReturnType<typeof validateEnv>;
try {
  env = validateEnv();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const PORT = env.PORT;
const NODE_ENV = env.NODE_ENV;

async function startServer() {
  try {
    // Initialize Firebase Admin eagerly so credential problems surface at
    // startup instead of as opaque 401s on the first authenticated request.
    // In development we only warn — non-Firebase routes (e.g. /slack) should
    // still boot when credentials aren't configured locally.
    try {
      getFirebaseApp();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('\n[startup] Firebase Admin failed to initialize:');
      console.error(`  ${message}\n`);
      console.error('Fix backend/.env and restart. Required keys: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (PEM, with literal \\n separators).');
      if (NODE_ENV === 'production') {
        process.exit(1);
      }
      console.warn('[startup] Continuing in development mode — authenticated routes will return 401 until Firebase env is set.\n');
    }

    // Create Fastify server
    const fastify = await createServer();

    // Start server
    await fastify.listen({ port: PORT, host: '0.0.0.0' });

    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`AI backend powered by Groq (llama-3.3-70b-versatile)`);
    console.log(`Environment: ${NODE_ENV}`);

    // Non-fatal DB probe — warns loudly if PostgreSQL is unavailable at startup
    // without crashing. The lazy db proxy means the server stays up and routes
    // return 503 individually until connectivity is restored.
    setTimeout(async () => {
      try {
        await db.$queryRaw`SELECT 1`;
        console.log('[db] PostgreSQL connection verified.');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`\n[db] WARNING: PostgreSQL unavailable at startup — ${msg}`);
        console.warn('[db] Routes requiring the database will return errors until the connection is restored.\n');
      }
    }, 5_000);

    // Run an initial sweep 60 s after startup (avoids cold-start DB pressure),
    // then repeat every 6 hours. Failures are logged but never crash the server.
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    setTimeout(() => {
      sweepExpiredRecords().catch((err) =>
        fastify.log.error({ err }, '[retention] initial sweep failed')
      );
      setInterval(() => {
        sweepExpiredRecords().catch((err) =>
          fastify.log.error({ err }, '[retention] periodic sweep failed')
        );
      }, SIX_HOURS_MS);
    }, 60_000);

    // Schedule the weekly digest email for every Monday at 08:00 UTC.
    // Silently skips when RESEND_API_KEY is not configured.
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const msUntilNextMonday08utc = (): number => {
      const now = new Date();
      const target = new Date(now);
      target.setUTCHours(8, 0, 0, 0);
      // Advance to Monday (day 1); (8 - day) % 7 gives 0 when already Monday.
      target.setUTCDate(target.getUTCDate() + (8 - target.getUTCDay()) % 7);
      // If the computed time is in the past (Monday already past 08:00), skip to next week.
      if (target.getTime() <= now.getTime()) target.setUTCDate(target.getUTCDate() + 7);
      return target.getTime() - now.getTime();
    };
    const firstDigestMs = msUntilNextMonday08utc();
    const nextRun = new Date(Date.now() + firstDigestMs).toUTCString();
    console.log(`[digest] Next weekly digest scheduled for ${nextRun}`);
    setTimeout(() => {
      sendWeeklyDigest().catch((err) =>
        fastify.log.error({ err }, '[digest] scheduled run failed')
      );
      setInterval(() => {
        sendWeeklyDigest().catch((err) =>
          fastify.log.error({ err }, '[digest] scheduled run failed')
        );
      }, ONE_WEEK_MS);
    }, firstDigestMs);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\nSIGTERM received. Shutting down gracefully...');
  await disconnectDb();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received. Shutting down gracefully...');
  await disconnectDb();
  process.exit(0);
});
