import * as Sentry from '@sentry/node';
import dotenv from 'dotenv';
import createServer from './app';
import { disconnectDb } from './lib/db';
import { getFirebaseApp } from './lib/firebaseAdmin';
import { validateEnv } from './lib/env';
import { sweepExpiredRecords } from './scripts/retentionSweeper';

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
