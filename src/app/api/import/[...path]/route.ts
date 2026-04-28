// Proxy for Fastify /import routes. Forwards bytes as-is so multipart uploads
// (PDF) and JSON bodies (URL import) both pass through unchanged.

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

const VALID_SEGMENT = /^[a-zA-Z0-9_-]+$/;
const PROXY_TIMEOUT_MS = 60_000;

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

  const contentType = req.headers.get('content-type');
  const headers: Record<string, string> = { authorization: auth };
  if (contentType) headers['content-type'] = contentType;

  const body = req.method === 'GET' ? undefined : await req.arrayBuffer();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  req.signal.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const upstream = await fetch(`${BACKEND_URL}/import/${segments.join('/')}`, {
      method: req.method,
      headers,
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
    const message = error instanceof Error ? error.message : 'Import backend unreachable.';
    return new Response(JSON.stringify({ ok: false, error: `Import backend unreachable: ${message}` }), {
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
