import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import createServer from '../app.js';

// ── Firebase Admin mock ───────────────────────────────────────────────────────
vi.mock('../lib/firebaseAdmin.js', () => ({
  getFirebaseApp:       vi.fn(() => ({ name: '[DEFAULT]' })),
  verifyFirebaseIdToken: vi.fn(async () => ({ uid: 'test-user-123' })),
}));

vi.mock('../lib/firebaseAuth.js', () => ({
  verifyFirebaseAuth: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'test-user-123';
  }),
}));

// ── In-memory store so POST /outcomes then POST /outcomes/:id/actual can share state ──
const outcomes = new Map<string, Record<string, unknown>>();
const learningInsights: Record<string, unknown>[] = [];
let outcomeIdSeq = 0;
let insightIdSeq = 0;

vi.mock('../lib/db.js', () => {
  const noop = () => Promise.resolve(null);
  return {
    db: {
      $queryRaw:    noop,
      $executeRaw:  noop,
      promptCache:  { findUnique: noop, upsert: noop, update: noop },
      promptLog:    { create: noop },
      aPIUsage:     { findUnique: noop },
      aIInsight:    { createMany: noop },
      aIPRD:        { create: noop },
      aISuggestedTask: { createMany: noop },
      patternAnalysis:  { create: noop },
      decisionReasoning: { upsert: vi.fn(async () => ({ id: 'dr-1' })) },
      webSocketConnection: { create: noop, deleteMany: noop, update: noop, count: noop },
      analysisJob: { count: noop },
      productBrainEntry: {
        findFirst: vi.fn(async () => ({ id: 'brain-1', confidence: 0.7 })),
        update: noop,
      },
      // Outcome CRUD — backed by the in-memory map so the route logic is exercised.
      outcome: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const id = `outcome-${++outcomeIdSeq}`;
          const record = { ...data, id, status: 'pending', createdAt: new Date(), learningInsights: [] };
          outcomes.set(id, record);
          return record;
        }),
        findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
          const r = outcomes.get(where.id);
          if (!r || r.userId !== where.userId) return null;
          return { ...r, learningInsights: learningInsights.filter((i) => i.outcomeId === where.id) };
        }),
        findMany: vi.fn(async ({ where, include }: { where: { userId: string; decisionId?: string; status?: string }; include?: unknown }) => {
          let records = [...outcomes.values()].filter((r) => r.userId === where.userId);
          if (where.decisionId) records = records.filter((r) => r.decisionId === where.decisionId);
          if (where.status)     records = records.filter((r) => r.status === where.status);
          if (include) records = records.map((r) => ({ ...r, learningInsights: learningInsights.filter((i) => i.outcomeId === r.id) }));
          return records;
        }),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const r = outcomes.get(where.id);
          if (!r) throw new Error('not found');
          const updated = { ...r, ...data };
          outcomes.set(where.id, updated);
          return updated;
        }),
        delete: vi.fn(async ({ where }: { where: { id: string } }) => {
          outcomes.delete(where.id);
          return {};
        }),
      },
      // LearningInsight CRUD
      learningInsight: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const id = `insight-${++insightIdSeq}`;
          const record = { ...data, id, createdAt: new Date() };
          learningInsights.push(record);
          return record;
        }),
        findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
          const found = learningInsights.find((i) => i.id === where.id && i.userId === where.userId);
          return found
            ? { ...found, outcome: outcomes.get(found.outcomeId as string) ?? null }
            : null;
        }),
        findMany: vi.fn(async ({ where }: { where: { userId: string; decisionId?: string } }) => {
          return learningInsights.filter(
            (i) => i.userId === where.userId && (!where.decisionId || i.decisionId === where.decisionId)
          );
        }),
      },
    },
    disconnectDb: vi.fn(),
  };
});

// ── Groq mock — returns a valid learning insight JSON ─────────────────────────
vi.mock('groq-sdk', () => ({
  default: vi.fn(function MockGroq() {
    return {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  insight:        'The feature shipped faster than expected, driven by clear scope.',
                  rootCause:      'Early user feedback loops reduced rework.',
                  actionableNext: 'Document the scoping process for future decisions.',
                  tags:           ['exceeded', 'scope', 'velocity'],
                }),
              },
            }],
            usage: { prompt_tokens: 40, completion_tokens: 60 },
          }),
        },
      },
    };
  }),
}));

// ── Silence eventBus to avoid Redis connection attempts in tests ──────────────
vi.mock('../services/eventBus.js', () => ({
  publishEvent:          vi.fn(async () => undefined),
  publishWorkspaceEvent: vi.fn(async () => undefined),
  subscribeUserEvents:       vi.fn(() => () => undefined),
  subscribeWorkspaceEvents:  vi.fn(() => () => undefined),
}));

// ── Silence aiGroundingService ────────────────────────────────────────────────
vi.mock('../services/aiGroundingService.js', () => ({
  getWorkspaceEvidence: vi.fn(async () => ''),
}));

// ── Suppress workspaceBootstrapService ───────────────────────────────────────
vi.mock('../services/workspaceBootstrapService.js', () => ({
  workspaceBootstrapService: { ensureWorkspaceForUser: vi.fn(async () => undefined) },
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Outcome → Learning end-to-end flow', () => {
  let server: Awaited<ReturnType<typeof createServer>>;

  beforeEach(async () => {
    outcomes.clear();
    learningInsights.length = 0;
    outcomeIdSeq = 0;
    insightIdSeq = 0;
    server = await createServer();
  });
  afterEach(async () => { await server.close(); });

  it('creates an expected outcome', async () => {
    const res = await server.inject({
      method:  'POST',
      url:     '/outcomes',
      payload: {
        decisionId:        'dec-1',
        decisionTitle:     'Launch feature X',
        expectedMetric:    'DAU',
        expectedValue:     1000,
        expectedTimeframe: '30 days',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.outcome).toMatchObject({
      decisionId:     'dec-1',
      expectedMetric: 'DAU',
      expectedValue:  1000,
      status:         'pending',
    });
  });

  it('records actual result and transitions status to recorded', async () => {
    // Create outcome first.
    const createRes = await server.inject({
      method:  'POST',
      url:     '/outcomes',
      payload: {
        decisionId:        'dec-2',
        decisionTitle:     'Improve onboarding',
        expectedMetric:    'activation_rate',
        expectedValue:     0.4,
        expectedTimeframe: '14 days',
      },
    });
    const { id } = createRes.json().data.outcome;

    const actualRes = await server.inject({
      method:  'POST',
      url:     `/outcomes/${id}/actual`,
      payload: { actualValue: 0.55 },
    });

    expect(actualRes.statusCode).toBe(200);
    const body = actualRes.json();
    expect(body.ok).toBe(true);
    expect(body.data.outcome.status).toBe('recorded');
    expect(body.data.outcome.verdict).toBe('exceeded'); // 37.5% above target
    expect(body.data.outcome.actualValue).toBe(0.55);
  });

  it('generates a learning insight after recording actual (fire-and-forget resolves)', async () => {
    const createRes = await server.inject({
      method:  'POST',
      url:     '/outcomes',
      payload: {
        decisionId:        'dec-3',
        decisionTitle:     'Reduce churn',
        expectedMetric:    'churn_rate',
        expectedValue:     0.05,
        expectedTimeframe: '60 days',
      },
    });
    const { id } = createRes.json().data.outcome;

    await server.inject({
      method:  'POST',
      url:     `/outcomes/${id}/actual`,
      payload: { actualValue: 0.03 },  // 40% better — exceeded
    });

    // Allow the fire-and-forget generateLearningInsight to complete.
    await new Promise((r) => setTimeout(r, 50));

    const listRes = await server.inject({ method: 'GET', url: '/learning' });
    expect(listRes.statusCode).toBe(200);
    const insights = listRes.json().data.insights as Array<Record<string, unknown>>;
    expect(insights.length).toBeGreaterThanOrEqual(1);
    expect(insights[0]).toMatchObject({
      decisionId:      'dec-3',
      insight:         expect.stringContaining('faster'),
    });
  });

  it('learning summary reflects positive confidence shift after exceeded outcome', async () => {
    const createRes = await server.inject({
      method:  'POST',
      url:     '/outcomes',
      payload: {
        decisionId:        'dec-4',
        decisionTitle:     'Ship mobile app',
        expectedMetric:    'downloads',
        expectedValue:     500,
        expectedTimeframe: '7 days',
      },
    });
    const { id } = createRes.json().data.outcome;

    await server.inject({
      method:  'POST',
      url:     `/outcomes/${id}/actual`,
      payload: { actualValue: 800 },   // 60% above target
    });

    await new Promise((r) => setTimeout(r, 50));

    const summaryRes = await server.inject({ method: 'GET', url: '/learning/summary' });
    expect(summaryRes.statusCode).toBe(200);
    const summary = summaryRes.json().data;
    expect(summary.totalInsights).toBeGreaterThanOrEqual(1);
    expect(summary.totalShift).toBeGreaterThan(0);
    expect(summary.positiveInsights).toBeGreaterThanOrEqual(1);
  });

  it('returns 409 when recording actual on an already-analyzed outcome', async () => {
    const createRes = await server.inject({
      method:  'POST',
      url:     '/outcomes',
      payload: {
        decisionId:        'dec-5',
        decisionTitle:     'Beta test',
        expectedMetric:    'signups',
        expectedValue:     200,
        expectedTimeframe: '21 days',
      },
    });
    const { id } = createRes.json().data.outcome;

    // Manually set status to 'analyzed' in the in-memory store.
    const record = outcomes.get(id)!;
    outcomes.set(id, { ...record, status: 'analyzed' });

    const res = await server.inject({
      method:  'POST',
      url:     `/outcomes/${id}/actual`,
      payload: { actualValue: 250 },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatch(/already analyzed/);
  });

  it('returns 404 when recording actual for a non-existent outcome', async () => {
    const res = await server.inject({
      method:  'POST',
      url:     '/outcomes/non-existent-id/actual',
      payload: { actualValue: 100 },
    });
    expect(res.statusCode).toBe(404);
  });

  it('rejects outcome creation with missing required fields', async () => {
    const res = await server.inject({
      method:  'POST',
      url:     '/outcomes',
      payload: { decisionId: 'dec-x' },  // missing title, metric, value, timeframe
    });
    expect(res.statusCode).toBe(400);
  });

  it('fetches a single outcome with its learning insights', async () => {
    const createRes = await server.inject({
      method:  'POST',
      url:     '/outcomes',
      payload: {
        decisionId:        'dec-6',
        decisionTitle:     'Pricing update',
        expectedMetric:    'revenue',
        expectedValue:     10000,
        expectedTimeframe: '30 days',
      },
    });
    const { id } = createRes.json().data.outcome;

    const getRes = await server.inject({ method: 'GET', url: `/outcomes/${id}` });
    expect(getRes.statusCode).toBe(200);
    const body = getRes.json();
    expect(body.ok).toBe(true);
    expect(body.data.outcome.id).toBe(id);
    expect(Array.isArray(body.data.outcome.learningInsights)).toBe(true);
  });

  it('deletes an outcome', async () => {
    const createRes = await server.inject({
      method:  'POST',
      url:     '/outcomes',
      payload: {
        decisionId:        'dec-7',
        decisionTitle:     'Temp experiment',
        expectedMetric:    'clicks',
        expectedValue:     50,
        expectedTimeframe: '3 days',
      },
    });
    const { id } = createRes.json().data.outcome;

    const delRes = await server.inject({ method: 'DELETE', url: `/outcomes/${id}` });
    expect(delRes.statusCode).toBe(200);
    expect(delRes.json().ok).toBe(true);
    expect(outcomes.has(id)).toBe(false);
  });

  it('verdict calculation — met when actual is within -5% of expected', async () => {
    const createRes = await server.inject({
      method:  'POST',
      url:     '/outcomes',
      payload: {
        decisionId:        'dec-8',
        decisionTitle:     'SEO push',
        expectedMetric:    'organic_visits',
        expectedValue:     2000,
        expectedTimeframe: '30 days',
      },
    });
    const { id } = createRes.json().data.outcome;

    const res = await server.inject({
      method:  'POST',
      url:     `/outcomes/${id}/actual`,
      payload: { actualValue: 1950 },  // -2.5% — within the "met" band
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.outcome.verdict).toBe('met');
  });

  it('verdict calculation — far_off when actual is more than -25% below expected', async () => {
    const createRes = await server.inject({
      method:  'POST',
      url:     '/outcomes',
      payload: {
        decisionId:        'dec-9',
        decisionTitle:     'Ad campaign',
        expectedMetric:    'conversions',
        expectedValue:     300,
        expectedTimeframe: '14 days',
      },
    });
    const { id } = createRes.json().data.outcome;

    const res = await server.inject({
      method:  'POST',
      url:     `/outcomes/${id}/actual`,
      payload: { actualValue: 150 },  // -50% — far_off
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.outcome.verdict).toBe('far_off');
  });
});
