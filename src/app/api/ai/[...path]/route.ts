// Generic JSON proxy for non-streaming Fastify backend routes.
// Streaming chat uses /api/chat; this handles /api/ai/insights/generate, /api/ai/prd/generate, etc.

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function forward(req: Request, segments: string[]) {
  const auth = req.headers.get('authorization');
  const body = req.method === 'GET' ? undefined : await req.text();
  const upstream = await fetch(`${BACKEND_URL}/ai/${segments.join('/')}`, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { authorization: auth } : {}),
    },
    body,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
    },
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path);
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path);
}
