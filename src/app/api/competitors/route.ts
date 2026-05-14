// Base route for /api/competitors — proxies GET and POST to backend /competitors.
// The [...path] catch-all doesn't match the base path, so this file handles it.

export const dynamic = 'force-dynamic';

import { backendUrl } from '@/lib/env';

const PROXY_TIMEOUT_MS = 30_000;

function unauthorized(): Response {
  return new Response(JSON.stringify({ ok: false, error: 'Authorization header required.' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function gatewayError(message: string): Response {
  return new Response(JSON.stringify({ ok: false, error: `Backend unreachable: ${message}` }), {
    status: 502,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  if (!auth) return unauthorized();

  const url         = new URL(req.url);
  const upstreamUrl = `${backendUrl()}/competitors${url.search}`;

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  req.signal.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const upstream = await fetch(upstreamUrl, {
      method:  'GET',
      headers: { authorization: auth },
      signal:  controller.signal,
    });
    return new Response(upstream.body, {
      status:  upstream.status,
      headers: {
        'Content-Type':  upstream.headers.get('content-type') ?? 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return gatewayError(error instanceof Error ? error.message : 'Unknown error');
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  if (!auth) return unauthorized();

  const url         = new URL(req.url);
  const upstreamUrl = `${backendUrl()}/competitors${url.search}`;

  let body: string;
  try {
    body = JSON.stringify(await req.json());
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  req.signal.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const upstream = await fetch(upstreamUrl, {
      method:  'POST',
      headers: { authorization: auth, 'content-type': 'application/json' },
      body,
      signal:  controller.signal,
    });
    return new Response(upstream.body, {
      status:  upstream.status,
      headers: {
        'Content-Type':  upstream.headers.get('content-type') ?? 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return gatewayError(error instanceof Error ? error.message : 'Unknown error');
  } finally {
    clearTimeout(timeoutId);
  }
}
