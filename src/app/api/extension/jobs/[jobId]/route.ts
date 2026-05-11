export const dynamic = 'force-dynamic';

import { backendUrl } from '@/lib/env';

const PROXY_TIMEOUT_MS = 15_000;

async function proxy(
  req: Request,
  jobId: string,
  method: 'GET' | 'DELETE',
): Promise<Response> {
  const auth = req.headers.get('authorization');
  if (!auth) {
    return new Response(JSON.stringify({ ok: false, error: 'Authorization header required.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  req.signal.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const upstream = await fetch(`${backendUrl()}/extension/jobs/${encodeURIComponent(jobId)}`, {
      method,
      headers: { authorization: auth },
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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  return proxy(req, jobId, 'GET');
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  return proxy(req, jobId, 'DELETE');
}
