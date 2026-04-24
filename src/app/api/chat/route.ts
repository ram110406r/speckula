// Thin proxy: forwards chat requests to the Fastify backend, which owns
// Firebase token verification, Groq access, and (eventually) cost logging.
// The request body and Authorization header pass through untouched;
// the response stream is piped back to the client.

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  const body = await req.text();

  const upstream = await fetch(`${BACKEND_URL}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { authorization: auth } : {}),
    },
    body,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'text/plain; charset=utf-8',
    },
  });
}
