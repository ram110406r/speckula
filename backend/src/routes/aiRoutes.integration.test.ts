import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import createServer from '../app.js';

// ── Firebase Admin mock ───────────────────────────────────────────────────────
// Replace the real SDK so tests never need a service-account key.
vi.mock('../lib/firebaseAdmin.js', () => ({
  getFirebaseApp: vi.fn(() => ({ name: '[DEFAULT]' })),
}));

vi.mock('../lib/firebaseAuth.js', () => ({
  verifyFirebaseAuth: vi.fn(async (request: { userId?: string }, _reply: unknown, done: () => void) => {
    // Inject a fake userId so rate-limit keying and requireUserId() both work.
    request.userId = 'test-user-123';
    done();
  }),
}));

// ── Prisma / DB mock ──────────────────────────────────────────────────────────
vi.mock('../lib/db.js', () => {
  const noop = () => Promise.resolve(null);
  return {
    db: {
      $queryRaw: noop,
      $executeRaw: noop,
      promptCache: { findUnique: noop, upsert: noop, update: noop },
      promptLog: { create: noop },
      aPIUsage: { findUnique: noop },
      aIInsight: { createMany: noop },
      aIPRD: { create: noop },
      aISuggestedTask: { createMany: noop },
      patternAnalysis: { create: noop },
      decisionReasoning: { upsert: vi.fn(async (_args: unknown) => ({ id: 'dr-1' })) },
    },
    disconnectDb: vi.fn(),
  };
});

// ── Groq SDK mock ─────────────────────────────────────────────────────────────
vi.mock('groq-sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '{"insights":[],"suggestions":[],"challenges":[],"decisions":[]}' } }],
            usage: { prompt_tokens: 10, completion_tokens: 20 },
          }),
        },
      },
    })),
  };
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  let server: Awaited<ReturnType<typeof createServer>>;

  beforeEach(async () => {
    server = await createServer();
  });
  afterEach(async () => { await server.close(); });

  it('returns 200 with status ok when db and firebase are reachable', async () => {
    const res = await server.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });
});

describe('Protected AI routes — auth rejection', () => {
  let server: Awaited<ReturnType<typeof createServer>>;

  beforeEach(async () => {
    // Override the auth mock to simulate a missing/invalid token.
    vi.mocked((await import('../lib/firebaseAuth.js')).verifyFirebaseAuth).mockImplementationOnce(
      async (_req: unknown, reply: { code: (n: number) => { send: (b: unknown) => void } }, _done: () => void) => {
        reply.code(401).send({ ok: false, error: 'unauthorized' });
      }
    );
    server = await createServer();
  });
  afterEach(async () => { await server.close(); });

  it('rejects /ai/signals/analyze without a valid token', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/ai/signals/analyze',
      payload: { content: 'test content' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects /ai/insights/generate without a valid token', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/ai/insights/generate',
      payload: { content: 'test', noteId: 'n1' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /ai/signals/analyze', () => {
  let server: Awaited<ReturnType<typeof createServer>>;

  beforeEach(async () => { server = await createServer(); });
  afterEach(async () => { await server.close(); });

  it('returns 200 with the signals envelope on valid input', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/ai/signals/analyze',
      payload: { content: 'Users struggle with onboarding and drop off after day 3.' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveProperty('insights');
    expect(body.data).toHaveProperty('suggestions');
    expect(body.data).toHaveProperty('challenges');
    expect(body.data).toHaveProperty('decisions');
  });

  it('returns 400 when content is missing', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/ai/signals/analyze',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /ai/patterns/analyze', () => {
  let server: Awaited<ReturnType<typeof createServer>>;

  beforeEach(async () => { server = await createServer(); });
  afterEach(async () => { await server.close(); });

  it('returns 200 with patterns on valid input', async () => {
    // Groq mock returns generic JSON; override to return valid pattern shape.
    const { default: Groq } = await import('groq-sdk');
    vi.mocked(Groq).mockImplementationOnce(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '{"keywords":[],"weakSignals":[],"gaps":[],"suggestions":[]}' } }],
            usage: { prompt_tokens: 5, completion_tokens: 10 },
          }),
        },
      },
    }) as never);

    const res = await server.inject({
      method: 'POST',
      url: '/ai/patterns/analyze',
      payload: { projectId: 'proj-1', noteId: 'note-1', content: 'Users want faster loading.' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });
});

describe('GET /ai/usage/:date', () => {
  let server: Awaited<ReturnType<typeof createServer>>;

  beforeEach(async () => { server = await createServer(); });
  afterEach(async () => { await server.close(); });

  it('returns 200 for a valid date when no usage exists yet', async () => {
    const res = await server.inject({ method: 'GET', url: '/ai/usage/2026-04-29' });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it('returns 400 for an invalid date format', async () => {
    const res = await server.inject({ method: 'GET', url: '/ai/usage/not-a-date' });
    expect(res.statusCode).toBe(400);
  });
});
