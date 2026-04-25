import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import { extract } from '@extractus/article-extractor';
import striptags from 'striptags';
import { verifyFirebaseAuth } from '../lib/firebaseAuth.js';

import pdfParse from 'pdf-parse';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const URL_FETCH_TIMEOUT_MS = 10_000;

const urlImportSchema = z.object({
  url: z.string().url(),
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
}
