import type { IncomingMessage, ServerResponse } from 'http';
import createServer from '../src/app.js';

// Singleton — reused across warm invocations within the same Vercel container.
let appReady: Promise<Awaited<ReturnType<typeof createServer>>> | null = null;

function getApp() {
  if (!appReady) {
    appReady = createServer().then((app) => app.ready().then(() => app));
  }
  return appReady;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp();
  app.server.emit('request', req, res);
}
