// Proxy for Fastify /import routes. Forwards bytes as-is so multipart uploads
// (PDF) and JSON bodies (URL import) both pass through unchanged.

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function forward(req: Request, segments: string[]) {
  const auth = req.headers.get('authorization');
  const contentType = req.headers.get('content-type');

  const headers: Record<string, string> = {};
  if (auth) headers['authorization'] = auth;
  if (contentType) headers['content-type'] = contentType;

  const body = req.method === 'GET' ? undefined : await req.arrayBuffer();

  try {
    const upstream = await fetch(`${BACKEND_URL}/import/${segments.join('/')}`, {
      method: req.method,
      headers,
      body,
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import backend unreachable.';
    return new Response(JSON.stringify({ ok: false, error: `Import backend unreachable: ${message}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
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
