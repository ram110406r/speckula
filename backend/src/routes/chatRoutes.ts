import { FastifyInstance, FastifyRequest } from 'fastify';
import Groq from 'groq-sdk';
import crypto from 'crypto';
import { z } from 'zod';
import { verifyFirebaseAuth } from '../lib/firebaseAuth.js';
import { db } from '../lib/db.js';

const MODEL = 'llama-3.3-70b-versatile';
const COST_PER_MILLION_TOKENS = 0.59;

const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

const chatSchema = z.object({
  messages: z.array(messageSchema).min(1),
  system: z.string().optional(),
});

let _groq: Groq | null = null;
const groq = new Proxy({} as Groq, {
  get(_, prop) {
    if (!_groq) {
      if (!process.env.GROQ_API_KEY) {
        throw new Error(
          'GROQ_API_KEY is not set. Set it in backend/.env to use AI features.'
        );
      }
      _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    return (_groq as any)[prop];
  },
});

const DEFAULT_SYSTEM = `You are Buildcase AI, a senior product management assistant.
Your goal is to help product managers discover insights, define product strategy, and build PRDs.
Be concise, structured, and professional. Use markdown for all responses.
Focus on product thinking: pain points, user segments, and business impact.`;

const hashMessages = (messages: { role: string; content: string }[]): string =>
  crypto
    .createHash('sha256')
    .update(messages.map((m) => `${m.role}::${m.content}`).join('\n---\n'))
    .digest('hex');

const estimateInputTokens = (messages: { content: string }[]): number =>
  Math.ceil(messages.reduce((sum, m) => sum + m.content.length, 0) / 4);

const estimateOutputTokens = (text: string): number => Math.ceil(text.length / 4);

const recordUsage = async (params: {
  userId: string;
  promptHash: string;
  promptText: string;
  inputTokens: number;
  outputTokens: number;
  executionMs: number;
  cachedResult: boolean;
}) => {
  const totalTokens = params.inputTokens + params.outputTokens;
  const cost = (totalTokens / 1_000_000) * COST_PER_MILLION_TOKENS;

  await db.promptLog.create({
    data: {
      userId: params.userId,
      projectId: 'chat',
      promptHash: params.promptHash,
      prompt: params.promptText.slice(0, 8000),
      modelUsed: MODEL,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      totalTokens,
      executionMs: params.executionMs,
      cost,
      cachedResult: params.cachedResult,
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await db.aPIUsage.upsert({
    where: { userId_date: { userId: params.userId, date: today } },
    create: {
      userId: params.userId,
      date: today,
      totalRequests: 1,
      totalTokens,
      totalCost: cost,
      modelMix: MODEL,
    },
    update: {
      totalRequests: { increment: 1 },
      totalTokens: { increment: totalTokens },
      totalCost: { increment: cost },
    },
  });
};

export default async function chatRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', verifyFirebaseAuth);

  fastify.post('/chat', async (request: FastifyRequest, reply) => {
    if (!process.env.GROQ_API_KEY) {
      reply.code(500).send({ ok: false, error: 'Missing Groq configuration.' });
      return;
    }

    const parsed = chatSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ ok: false, error: 'Invalid request payload.' });
      return;
    }

    const userId = request.userId as string;
    const { messages, system } = parsed.data;
    const promptMessages = [
      { role: 'system' as const, content: system ?? DEFAULT_SYSTEM },
      ...messages,
    ];
    const promptHash = hashMessages(promptMessages);
    const promptText = promptMessages.map((m) => `${m.role}: ${m.content}`).join('\n');
    const inputTokens = estimateInputTokens(promptMessages);

    const cached = await db.promptCache
      .findUnique({ where: { promptHash } })
      .catch(() => null);

    if (cached && cached.expiresAt > new Date()) {
      reply.hijack();
      reply.raw.setHeader('Content-Type', 'text/plain; charset=utf-8');
      reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Cache', 'HIT');
      reply.raw.statusCode = 200;
      reply.raw.write(cached.result);
      reply.raw.end();

      db.promptCache
        .update({ where: { promptHash }, data: { hitCount: { increment: 1 } } })
        .catch((err) => fastify.log.warn({ err }, 'cache hit count update failed'));

      recordUsage({
        userId,
        promptHash,
        promptText,
        inputTokens: 0,
        outputTokens: 0,
        executionMs: 0,
        cachedResult: true,
      }).catch((err) => fastify.log.warn({ err }, 'usage logging failed (cache hit)'));

      return;
    }

    let stream;
    const startedAt = Date.now();
    try {
      stream = await groq.chat.completions.create({
        model: MODEL,
        messages: promptMessages,
        stream: true,
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Groq stream init failed');
      reply.code(502).send({ ok: false, error: 'Upstream AI error.' });
      return;
    }

    reply.hijack();
    reply.raw.setHeader('Content-Type', 'text/plain; charset=utf-8');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Cache', 'MISS');
    reply.raw.statusCode = 200;

    let accumulated = '';
    try {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          accumulated += delta;
          reply.raw.write(delta);
        }
      }
    } catch (error) {
      fastify.log.error({ err: error }, 'Groq stream error');
    } finally {
      reply.raw.end();
    }

    const executionMs = Date.now() - startedAt;
    const outputTokens = estimateOutputTokens(accumulated);

    if (accumulated.length > 0) {
      const cacheTTLMinutes = parseInt(process.env.AI_CACHE_TTL_MINUTES || '60', 10);
      db.promptCache
        .upsert({
          where: { promptHash },
          create: {
            promptHash,
            result: accumulated,
            modelUsed: MODEL,
            expiresAt: new Date(Date.now() + cacheTTLMinutes * 60 * 1000),
          },
          update: {
            result: accumulated,
            expiresAt: new Date(Date.now() + cacheTTLMinutes * 60 * 1000),
          },
        })
        .catch((err) => fastify.log.warn({ err }, 'cache write failed'));
    }

    recordUsage({
      userId,
      promptHash,
      promptText,
      inputTokens,
      outputTokens,
      executionMs,
      cachedResult: false,
    }).catch((err) => fastify.log.warn({ err }, 'usage logging failed'));
  });
}
