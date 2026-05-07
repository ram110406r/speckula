// Thin proxy: forwards chat requests to the Fastify backend, which owns
// Firebase token verification, Groq access, and cost logging.

export const dynamic = 'force-dynamic';

import { backendUrl } from '@/lib/env';
// Stream calls can take a while; cap so a wedged backend doesn't pin a
// Vercel/Next.js function for the full platform timeout.
const PROXY_TIMEOUT_MS = 90_000;

export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  // Reject unauthenticated callers at the proxy edge so we never even open
  // an upstream connection without a token.
  if (!auth) {
    return new Response('Authorization header required.', {
      status: 401,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  const body = await req.text();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  // If the client disconnects, abort the upstream stream so we stop paying
  // for tokens we'll never deliver.
  req.signal.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const upstream = await fetch(`${backendUrl()}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: auth,
      },
      body,
      signal: controller.signal,
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'text/plain; charset=utf-8',
        // Streaming responses must never be cached or buffered by intermediaries.
        'Cache-Control': 'no-store, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? `AI backend unreachable: ${error.message}` : 'AI backend unreachable.';
    return new Response(message, {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
