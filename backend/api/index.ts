import type { IncomingMessage, ServerResponse } from 'http';
import createServer from '../src/app.js';

// Singleton — reused across warm invocations within the same Vercel container.
// Reset on rejection so a transient cold-start error doesn't permanently poison
// all subsequent requests.
let appReady: Promise<Awaited<ReturnType<typeof createServer>>> | null = null;

function getApp() {
  if (!appReady) {
    appReady = createServer()
      .then((app) => app.ready().then(() => app))
      .catch((err) => {
        appReady = null;
        throw err;
      });
  }
  return appReady;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getApp();
    app.server.emit('request', req, res);
  } catch (err) {
    console.error('[api/index] App initialization failed:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Service initialization failed.' }));
    }
  }
}
