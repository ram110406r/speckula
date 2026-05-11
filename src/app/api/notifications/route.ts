// Base route for GET /api/notifications and DELETE /api/notifications.
// The [...path] catch-all does not match the empty path, so this file handles it.

export const dynamic = 'force-dynamic';

import { backendUrl } from '@/lib/env';

const PROXY_TIMEOUT_MS = 15_000;

export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  if (!auth) {
    return new Response(JSON.stringify({ ok: false, error: 'Authorization header required.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const url = new URL(req.url);
  const upstreamUrl = `${backendUrl()}/notifications${url.search}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  req.signal.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: { authorization: auth },
      signal: controller.signal,
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Backend unreachable.';
    return new Response(JSON.stringify({ ok: false, error: `Backend unreachable: ${message}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function DELETE(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  if (!auth) {
    return new Response(JSON.stringify({ ok: false, error: 'Authorization header required.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const url = new URL(req.url);
  const upstreamUrl = `${backendUrl()}/notifications${url.search}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  req.signal.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'DELETE',
      headers: { authorization: auth },
      signal: controller.signal,
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Backend unreachable.';
    return new Response(JSON.stringify({ ok: false, error: `Backend unreachable: ${message}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}