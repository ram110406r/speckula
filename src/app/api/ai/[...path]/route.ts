// Generic JSON proxy for non-streaming Fastify backend routes.
// Streaming chat uses /api/chat; this handles /api/ai/insights/generate, /api/ai/prd/generate, etc.

export const dynamic = 'force-dynamic';

import { backendUrl } from '@/lib/env';
const BACKEND_URL = backendUrl;
const PROXY_TIMEOUT_MS = 90_000;

// Allow-list of segments we are willing to forward to the backend. Prevents
// path-traversal-style abuse if the dynamic segment is ever populated by an
// untrusted source.
const VALID_SEGMENT = /^[a-zA-Z0-9_-]+$/;

async function forward(req: Request, segments: string[]) {
  const auth = req.headers.get('authorization');
  if (!auth) {
    return new Response(JSON.stringify({ ok: false, error: 'Authorization header required.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  if (segments.length === 0 || !segments.every((s) => VALID_SEGMENT.test(s))) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid path.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rawBody = req.method === 'GET' ? undefined : await req.text();
  const body = rawBody || undefined;

  const upstreamHeaders: Record<string, string> = { authorization: auth };
  if (body) upstreamHeaders['Content-Type'] = 'application/json';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  req.signal.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const upstream = await fetch(`${BACKEND_URL}/ai/${segments.join('/')}`, {
      method: req.method,
      headers: upstreamHeaders,
      body,
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
    const message = error instanceof Error ? error.message : 'AI backend unreachable.';
    return new Response(JSON.stringify({ ok: false, error: `AI backend unreachable: ${message}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path);
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path);
}
