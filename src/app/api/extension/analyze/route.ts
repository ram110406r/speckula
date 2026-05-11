export const dynamic = 'force-dynamic';

import { backendUrl } from '@/lib/env';

const PROXY_TIMEOUT_MS = 30_000;

export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  if (!auth) {
    return new Response(JSON.stringify({ ok: false, error: 'Authorization header required.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rawBody = await req.text();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  req.signal.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const upstream = await fetch(`${backendUrl()}/extension/analyze`, {
      method: 'POST',
      headers: { authorization: auth, 'Content-Type': 'application/json' },
      body: rawBody || undefined,
      signal: controller.signal,
    });

    const data = await upstream.json();
    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
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
