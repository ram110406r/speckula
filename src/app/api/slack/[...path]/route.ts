export const dynamic = 'force-dynamic';

import { backendUrl } from '@/lib/env';
const PROXY_TIMEOUT_MS = 30_000;

const VALID_SEGMENT = /^[a-zA-Z0-9_-]+$/;

// The OAuth callback is a plain browser redirect from Slack — no JS, no Bearer token.
// All other routes require the user to be authenticated via Firebase.
const isOAuthCallback = (method: string, segments: string[]) =>
  method === 'GET' && segments.length === 1 && segments[0] === 'callback';

async function forward(req: Request, segments: string[]) {
  if (segments.length === 0 || !segments.every((s) => VALID_SEGMENT.test(s))) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid path.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const callback = isOAuthCallback(req.method, segments);

  const auth = req.headers.get('authorization');
  if (!auth && !callback) {
    return new Response(JSON.stringify({ ok: false, error: 'Authorization header required.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const url = new URL(req.url);
  const upstream_url = `${backendUrl()}/auth/slack/${segments.join('/')}${url.search}`;
  const rawBody = req.method === 'GET' || req.method === 'DELETE' ? undefined : await req.text();
  const body = rawBody || undefined;

  const upstreamHeaders: Record<string, string> = {};
  if (auth) upstreamHeaders['authorization'] = auth;
  if (body) upstreamHeaders['Content-Type'] = 'application/json';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  req.signal.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const upstream = await fetch(upstream_url, {
      method: req.method,
      headers: upstreamHeaders,
      body,
      signal: controller.signal,
      redirect: 'manual', // let us forward redirects to the browser instead of following them
    });

    const responseHeaders: Record<string, string> = {
      'Cache-Control': 'no-store',
    };

    // Forward redirect Location header (e.g. backend sends 302 → /?slack=connected)
    const location = upstream.headers.get('location');
    if (location) responseHeaders['Location'] = location;

    const contentType = upstream.headers.get('content-type');
    if (contentType) responseHeaders['Content-Type'] = contentType;

    return new Response(
      upstream.status === 302 || upstream.status === 301 ? null : upstream.body,
      { status: upstream.status, headers: responseHeaders }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Backend unreachable.';
    return new Response(JSON.stringify({ ok: false, error: `Slack backend unreachable: ${message}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path);
}

export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path);
}
