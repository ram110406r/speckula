import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import striptags from 'striptags';
import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';
import { getDecryptedBotToken } from './slackOAuthRoutes.js';
import { fetchChannelHistory } from '../lib/slackApi.js';

import pdfParse from 'pdf-parse';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_URL_BODY_BYTES = 5 * 1024 * 1024; // 5 MB cap on fetched HTML
const URL_FETCH_TIMEOUT_MS = 10_000;
const SLACK_DEFAULT_LIMIT = 200;
const SLACK_MAX_LIMIT = 1000;

type ArticleExtractor = (
  html: string,
  parserOptions?: unknown,
  opts?: Record<string, unknown>
) => Promise<{ title?: string; content?: string } | null>;
let extractArticle: ArticleExtractor | null = null;
const getArticleExtractor = async (): Promise<ArticleExtractor> => {
  if (!extractArticle) {
    const mod = await import('@extractus/article-extractor');
    extractArticle = mod.extract as unknown as ArticleExtractor;
  }
  return extractArticle!;
};

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

// Returns true for IPs we must never SSRF to: loopback, private, link-local,
// CGNAT, broadcast, IPv6 ULA / link-local / loopback / unspecified.
const isBlockedIp = (ip: string): boolean => {
  const v = isIP(ip);
  if (v === 4) {
    const parts = ip.split('.').map((p) => Number(p));
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return true;
    const [a, b] = parts;
    if (a === 0) return true;                                     // 0.0.0.0/8
    if (a === 10) return true;                                    // 10/8
    if (a === 127) return true;                                   // 127/8 loopback
    if (a === 169 && b === 254) return true;                      // 169.254/16 link-local + AWS metadata
    if (a === 172 && b >= 16 && b <= 31) return true;             // 172.16-31/12
    if (a === 192 && b === 168) return true;                      // 192.168/16
    if (a === 100 && b >= 64 && b <= 127) return true;            // 100.64/10 CGNAT
    if (a >= 224) return true;                                    // multicast/reserved/broadcast
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    if (lower.startsWith('fe80:') || lower.startsWith('fe80::')) return true;
    // ULA fc00::/7 — fc00..fdff
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    // IPv4-mapped IPv6 — two forms produced by different serialisers:
    //   dotted-decimal: ::ffff:127.0.0.1  (some DNS resolvers)
    //   hex groups:     ::ffff:7f00:1     (WHATWG URL normalisation)
    const mappedDecimal = lower.match(/^::ffff:([0-9.]+)$/);
    if (mappedDecimal && isIP(mappedDecimal[1]) === 4 && isBlockedIp(mappedDecimal[1])) return true;
    const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) {
      const hi = parseInt(mappedHex[1], 16);
      const lo = parseInt(mappedHex[2], 16);
      const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      if (isBlockedIp(v4)) return true;
    }
    return false;
  }
  // Not an IP literal at all — treat decimal/hex IPv4 encodings as blocked.
  return true;
};

// SSRF guard: resolve the hostname and verify EVERY answer is a public IP.
// String-only hostname checks miss DNS rebinding and decimal/hex IPv4
// encodings; only DNS resolution + per-IP allow-list is safe.
const assertPublicHost = async (hostname: string): Promise<void> => {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower === 'localhost.localdomain') {
    throw new Error('Private network URLs are not allowed.');
  }
  // Strip brackets from IPv6 literals — WHATWG URL hostname includes them:
  // new URL('http://[::1]').hostname === '[::1]', so isIP returns 0 without this.
  const rawHost = lower.startsWith('[') && lower.endsWith(']') ? lower.slice(1, -1) : lower;
  // If the host is already a literal IP, validate directly.
  if (isIP(rawHost) !== 0) {
    if (isBlockedIp(rawHost)) throw new Error('Private network URLs are not allowed.');
    return;
  }
  // Otherwise resolve A and AAAA and ensure all returned IPs are public.
  let answers: string[] = [];
  try {
    const [a, aaaa] = await Promise.allSettled([
      dns.resolve4(rawHost),
      dns.resolve6(rawHost),
    ]);
    if (a.status === 'fulfilled') answers.push(...a.value);
    if (aaaa.status === 'fulfilled') answers.push(...aaaa.value);
  } catch {
    /* fall through; below handles empty answers */
  }
  if (answers.length === 0) {
    throw new Error('Could not resolve URL hostname.');
  }
  for (const ip of answers) {
    if (isBlockedIp(ip)) throw new Error('Private network URLs are not allowed.');
  }
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
  // Auth and rate-limit are configured at the /import prefix scope in
  // app.ts so multipart never streams a body for an unauthenticated caller.

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

      try {
        await assertPublicHost(parsedUrl.hostname);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Private network URLs are not allowed.';
        return replyError(reply, 400, message);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);

      let html: string;
      try {
        // Fetch with manual redirect — every redirect target's hostname must
        // pass the same DNS-resolved public-IP check before we follow it.
        let currentUrl = parsedUrl;
        let response: Response | null = null;
        for (let hop = 0; hop < 5; hop += 1) {
          const r = await fetch(currentUrl.toString(), {
            headers: { 'User-Agent': 'Speckula/1.0 (content import)' },
            signal: controller.signal,
            redirect: 'manual',
          });
          if (r.status >= 300 && r.status < 400) {
            const loc = r.headers.get('location');
            if (!loc) {
              return replyError(reply, 400, 'Could not fetch that URL.');
            }
            const next = new URL(loc, currentUrl);
            if (next.protocol !== 'http:' && next.protocol !== 'https:') {
              return replyError(reply, 400, 'Redirect to non-http(s) URL refused.');
            }
            await assertPublicHost(next.hostname);
            currentUrl = next;
            continue;
          }
          response = r;
          break;
        }

        if (!response || !response.ok) {
          return replyError(reply, 400, 'Could not fetch that URL.');
        }

        // Read the body with a hard byte cap to prevent unbounded memory
        // growth, and stop early if it would exceed the limit.
        const reader = response.body?.getReader();
        if (!reader) {
          html = '';
        } else {
          const chunks: Uint8Array[] = [];
          let total = 0;
          try {
            // eslint-disable-next-line no-constant-condition
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) {
                total += value.byteLength;
                if (total > MAX_URL_BODY_BYTES) {
                  controller.abort();
                  await reader.cancel().catch(() => undefined);
                  return replyError(reply, 413, 'URL body too large.');
                }
                chunks.push(value);
              }
            }
          } finally {
            await reader.cancel().catch(() => undefined);
          }
          html = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf-8');
        }
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
        const extract = await getArticleExtractor();
        const article = await extract(html, undefined, {
          headers: { 'User-Agent': 'Speckula/1.0 (content import)' },
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
        const isDecryptFail = (err as { code?: string })?.code === 'TOKEN_DECRYPT_FAILED';
        const status = isDecryptFail ? 401
          : /not connected|missing|mismatch/i.test(message) ? 404
          : 500;
        return replyError(reply, status, message);
      }

      let messages;
      try {
        messages = await fetchChannelHistory(token, body.channelId, { limit });
      } catch (err) {
        fastify.log.error({ err }, 'slack history fetch failed');
        // slackApi throws `slack <path> failed: <slack_error>` — pull the trailing
        // code out so we can map known Slack errors to actionable HTTP statuses
        // instead of a blanket 502 that hides whether the user needs to invite
        // the bot, reconnect, or grant a scope.
        const raw = err instanceof Error ? err.message : '';
        const code = raw.match(/failed:\s*(\S+)/)?.[1] ?? '';
        switch (code) {
          case 'not_in_channel':
          case 'channel_not_found':
            return replyError(reply, 403, 'The Slack bot is not in this channel. Invite @Speckula to the channel and try again.');
          case 'is_archived':
            return replyError(reply, 410, 'This Slack channel is archived.');
          case 'invalid_auth':
          case 'token_revoked':
          case 'token_expired':
          case 'account_inactive':
            return replyError(reply, 401, 'Slack workspace authorization is no longer valid. Reconnect Slack and try again.');
          case 'missing_scope':
          case 'not_allowed_token_type':
            return replyError(reply, 403, 'The Slack app is missing required permissions. Reconnect Slack to grant updated scopes.');
          case 'ratelimited':
            return replyError(reply, 429, 'Slack rate limit reached. Try again in a minute.');
          default:
            return replyError(reply, 502, code ? `Slack API error: ${code}` : 'Could not fetch Slack channel history.');
        }
      }

      // Slack returns newest-first; reverse to chronological so the LLM reads
      // the conversation forwards.
      const ordered = [...messages].reverse();

      // System subtypes that add no conversational value.
      const SKIP_SUBTYPES = new Set([
        'channel_join', 'channel_leave', 'channel_purpose', 'channel_topic',
        'channel_name', 'channel_archive', 'channel_unarchive',
        'pinned_item', 'unpinned_item', 'bot_message',
      ]);

      // Decode Slack mrkdwn into plain readable text for the LLM.
      const decodeSlackMarkup = (raw: string): string =>
        raw
          .replace(/<@[A-Z0-9]+\|([^>]+)>/g, '@$1')           // <@UID|name> -> @name
          .replace(/<@([A-Z0-9]+)>/g, (_, id: string) => `@user_${id.slice(-4)}`) // <@UID> -> @user_XXXX
          .replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1')           // <#CID|name> -> #name
          .replace(/<!here>/g, '@here')
          .replace(/<!channel>/g, '@channel')
          .replace(/<!everyone>/g, '@everyone')
          .replace(/<https?:[^|>]+\|([^>]+)>/g, '$1')          // <URL|label> -> label
          .replace(/<(https?:[^>]+)>/g, '$1')                  // <URL> -> URL
          .replace(/\*([^*\n]+)\*/g, '$1')                   // *bold* -> bold
          .replace(/_([^_\n]+)_/g, '$1');                    // _italic_ -> italic

      // Format Slack ts (epoch seconds string) as "MMM D, HH:MM UTC".
      const formatTs = (ts: string): string => {
        const secs = Number.parseFloat(ts);
        if (!Number.isFinite(secs)) return ts;
        const d = new Date(secs * 1000);
        const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
        const day = d.getUTCDate();
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const mm = String(d.getUTCMinutes()).padStart(2, '0');
        return `${month} ${day}, ${hh}:${mm} UTC`;
      };

      const lines: string[] = [];
      let bytes = 0;
      let included = 0;
      let truncated = false;

      for (const msg of ordered) {
        if (msg.bot_id) continue;
        if (msg.subtype && SKIP_SUBTYPES.has(msg.subtype)) continue;
        const rawText = (msg.text ?? '').trim();
        if (!rawText) continue;

        const timestamp = formatTs(msg.ts);
        const sender = msg.user ? `@user_${msg.user.slice(-4)}` : 'unknown';
        const decoded = decodeSlackMarkup(rawText);
        // eslint-disable-next-line no-control-regex
        const sanitized = decoded.replace(/[ -	-]/g, '');
        const line = `[${timestamp}] ${sender}: ${sanitized}`;
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
