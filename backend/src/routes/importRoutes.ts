import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import { extract } from '@extractus/article-extractor';
import striptags from 'striptags';
import { verifyFirebaseAuth } from '../lib/firebaseAuth.js';
import { getDecryptedBotToken } from './slackOAuthRoutes.js';
import { fetchChannelHistory } from '../lib/slackApi.js';

import pdfParse from 'pdf-parse';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const URL_FETCH_TIMEOUT_MS = 10_000;
const SLACK_DEFAULT_LIMIT = 200;
const SLACK_MAX_LIMIT = 1000;

const urlImportSchema = z.object({
  url: z.string().url(),
});

const slackImportSchema = z.object({
  teamId: z.string().min(1),
  channelId: z.string().min(1),
  messageCount: z.number().int().positive().max(SLACK_MAX_LIMIT).optional(),
});

const replyError = (reply: FastifyReply, status: number, message: string) => {
  reply.code(status).send({ ok: false, error: message });
};

const isPrivateHost = (hostname: string): boolean => {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower === '127.0.0.1' || lower === '::1' || lower === '0.0.0.0') {
    return true;
  }
  // IPv4 private ranges
  const ipv4 = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true; // link-local
  }
  return false;
};

const cleanPdfText = (raw: string): string => {
  return raw
    .split(/\r?\n/)
    .filter((line) => !/^\s*\d+\s*$/.test(line)) // drop bare page-number lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const cleanHtmlText = (raw: string): string => {
  return raw
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export default async function importRoutes(fastify: FastifyInstance) {
  // Auth runs as onRequest (before preParsing) so multipart never starts
  // streaming a body for an unauthenticated caller — otherwise we'd happily
  // buffer up to MAX_FILE_BYTES before checking the bearer token.
  fastify.addHook('onRequest', verifyFirebaseAuth);

  await fastify.register(multipart, {
    limits: {
      fileSize: MAX_FILE_BYTES,
      files: 1,
    },
  });

  fastify.post('/file', async (request: FastifyRequest, reply: FastifyReply) => {
    const contentType = request.headers['content-type'] ?? '';
    if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
      return replyError(reply, 400, 'Expected multipart/form-data upload.');
    }

    try {
      const file = await request.file();
      if (!file) {
        return replyError(reply, 400, 'No file uploaded.');
      }

      if (file.mimetype !== 'application/pdf') {
        return replyError(reply, 400, 'Only PDF files are supported on this endpoint');
      }

      const buffer = await file.toBuffer();
      if (buffer.length > MAX_FILE_BYTES) {
        return replyError(reply, 413, 'File too large. Maximum size is 10MB.');
      }

      const parsed = await pdfParse(buffer);
      const text = cleanPdfText(parsed.text || '');

      if (!text) {
        return replyError(reply, 500, 'Could not extract text from this PDF.');
      }

      reply.code(200).send({
        ok: true,
        data: {
          text,
          charCount: text.length,
          pageCount: parsed.numpages ?? 0,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      // @fastify/multipart surfaces specific error codes — map them to
      // accurate HTTP responses instead of pretending every failure is a
      // PDF-parse failure.
      const code = (error as { code?: string } | undefined)?.code;
      const message = error instanceof Error ? error.message : '';

      if (code === 'FST_REQ_FILE_TOO_LARGE' || /file size limit|too large/i.test(message)) {
        return replyError(reply, 413, 'File too large. Maximum size is 10MB.');
      }
      if (code === 'FST_FILES_LIMIT' || /files limit/i.test(message)) {
        return replyError(reply, 400, 'Only one file may be uploaded per request.');
      }
      if (code === 'FST_INVALID_MULTIPART_CONTENT_TYPE') {
        return replyError(reply, 400, 'Expected multipart/form-data upload.');
      }
      replyError(reply, 500, 'Could not extract text from this PDF.');
    }
  });

  fastify.post<{ Body: z.infer<typeof urlImportSchema> }>(
    '/url',
    async (request, reply) => {
      let parsedUrl: URL;
      try {
        const body = urlImportSchema.parse(request.body);
        parsedUrl = new URL(body.url);
      } catch {
        return replyError(reply, 400, 'Invalid or unreachable URL.');
      }

      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return replyError(reply, 400, 'Invalid or unreachable URL.');
      }

      if (isPrivateHost(parsedUrl.hostname)) {
        return replyError(reply, 400, 'Private network URLs are not allowed.');
      }

      const controller = new AbortController();
      const startedAt = Date.now();
      const timeoutId = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);
      const remaining = () => Math.max(0, URL_FETCH_TIMEOUT_MS - (Date.now() - startedAt));

      let html: string;
      try {
        const response = await fetch(parsedUrl.toString(), {
          headers: { 'User-Agent': 'Buildcase/1.0 (content import)' },
          signal: controller.signal,
        });

        if (!response.ok) {
          return replyError(reply, 400, 'Could not fetch that URL.');
        }

        // Bound the body read by the same overall timeout — the fetch signal
        // covers metadata, but slow streams could still hang past 10s.
        html = await Promise.race<string>([
          response.text(),
          new Promise<string>((_, reject) =>
            setTimeout(() => {
              controller.abort();
              reject(new DOMException('Body read timed out', 'AbortError'));
            }, remaining())
          ),
        ]);
      } catch (error) {
        const isAbort = error instanceof Error && error.name === 'AbortError';
        if (isAbort) {
          return replyError(reply, 504, 'The URL took too long to respond.');
        }
        fastify.log.error(error);
        return replyError(reply, 400, 'Invalid or unreachable URL.');
      } finally {
        clearTimeout(timeoutId);
      }

      try {
        const article = await extract(html, undefined, {
          headers: { 'User-Agent': 'Buildcase/1.0 (content import)' },
        });

        const rawContent = article?.content ?? '';
        const stripped = striptags(rawContent, [], '\n');
        const text = cleanHtmlText(stripped);

        if (!text || text.length < 40) {
          return replyError(reply, 422, 'Could not extract readable content from this URL.');
        }

        const title = (article?.title ?? '').trim() || null;

        reply.code(200).send({
          ok: true,
          data: {
            title,
            text,
            sourceUrl: parsedUrl.toString(),
            charCount: text.length,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        replyError(reply, 422, 'Could not extract readable content from this URL.');
      }
    }
  );

  fastify.post<{ Body: z.infer<typeof slackImportSchema> }>(
    '/slack',
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return replyError(reply, 401, 'Unauthorized');
      }

      let body: z.infer<typeof slackImportSchema>;
      try {
        body = slackImportSchema.parse(request.body);
      } catch {
        return replyError(reply, 400, 'teamId and channelId are required.');
      }

      const limit = body.messageCount ?? SLACK_DEFAULT_LIMIT;

      let token: string;
      try {
        token = await getDecryptedBotToken(userId, body.teamId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'workspace not connected';
        const status = /not connected|missing|mismatch/i.test(message) ? 404 : 500;
        return replyError(reply, status, message);
      }

      let messages;
      try {
        messages = await fetchChannelHistory(token, body.channelId, { limit });
      } catch (err) {
        fastify.log.error({ err }, 'slack history fetch failed');
        return replyError(reply, 502, 'Could not fetch Slack channel history.');
      }

      // Slack returns newest-first; reverse to chronological so the LLM reads
      // the conversation forwards.
      const ordered = [...messages].reverse();

      const lines: string[] = [];
      let bytes = 0;
      let included = 0;
      let truncated = false;

      for (const msg of ordered) {
        if (msg.bot_id) continue;
        const text = (msg.text ?? '').trim();
        if (!text) continue;

        const tsSeconds = Number.parseFloat(msg.ts);
        const iso = Number.isFinite(tsSeconds)
          ? new Date(tsSeconds * 1000).toISOString()
          : msg.ts;
        const sender = msg.user ?? 'unknown';
        // Strip control chars except \n (\x0A) so multi-line messages stay legible.
        const sanitized = text.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '');
        const line = `[${iso}] @${sender}: ${sanitized}`;
        const lineBytes = Buffer.byteLength(line, 'utf-8') + 1;

        if (bytes + lineBytes > MAX_FILE_BYTES) {
          truncated = true;
          break;
        }
        lines.push(line);
        bytes += lineBytes;
        included += 1;
      }

      if (lines.length === 0) {
        return replyError(reply, 422, 'No readable messages found in this channel.');
      }

      const content = lines.join('\n');

      reply.code(200).send({
        ok: true,
        data: {
          content,
          metadata: {
            source: 'slack',
            channelId: body.channelId,
            teamId: body.teamId,
            messageCount: included,
            ...(truncated ? { truncated: true } : {}),
          },
        },
      });
    }
  );
}
