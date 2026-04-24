import { FastifyInstance, FastifyRequest } from 'fastify';
import Groq from 'groq-sdk';
import { z } from 'zod';
import { verifyFirebaseAuth } from '../lib/firebaseAuth.js';

const MODEL = 'llama-3.3-70b-versatile';

const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

const chatSchema = z.object({
  messages: z.array(messageSchema).min(1),
  system: z.string().optional(),
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const DEFAULT_SYSTEM = `You are Buildcase AI, a senior product management assistant.
Your goal is to help product managers discover insights, define product strategy, and build PRDs.
Be concise, structured, and professional. Use markdown for all responses.
Focus on product thinking: pain points, user segments, and business impact.`;

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

    const { messages, system } = parsed.data;
    const promptMessages = [
      { role: 'system' as const, content: system ?? DEFAULT_SYSTEM },
      ...messages,
    ];

    let stream;
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

    // Hand off to raw Node stream so we can forward chunks without Fastify serialization.
    reply.hijack();
    reply.raw.setHeader('Content-Type', 'text/plain; charset=utf-8');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.statusCode = 200;

    try {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) reply.raw.write(delta);
      }
    } catch (error) {
      fastify.log.error({ err: error }, 'Groq stream error');
    } finally {
      reply.raw.end();
    }
  });
}
