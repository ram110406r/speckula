// Text embedding service — generates vector embeddings for Product Brain entries.
// Uses OpenAI text-embedding-3-small by default (1536 dims, $0.02/1M tokens).
// Gracefully degrades when OPENAI_API_KEY is not set: returns null and skips
// embedding so the rest of the ingestion pipeline still works.

import { db } from '../lib/db.js';

let _openai: import('openai').default | null = null;

const getOpenAI = (): import('openai').default | null => {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_openai) {
    // Dynamic import so the package is optional — no crash if not installed.
    const OpenAI = require('openai').default ?? require('openai');
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
};

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const EMBEDDING_DIMS  = 1536;

// Truncate text to avoid exceeding token limits.
// text-embedding-3-small supports up to 8191 tokens; ~4 chars per token → 32 000 chars.
const truncate = (text: string, maxChars = 30_000): string =>
  text.length > maxChars ? text.slice(0, maxChars) : text;

// Generate a float[] embedding for the given text.
// Returns null if OpenAI is not configured or if the call fails.
export const generateEmbedding = async (text: string): Promise<number[] | null> => {
  const openai = getOpenAI();
  if (!openai) return null;
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: truncate(text),
    });
    return response.data[0].embedding;
  } catch (err) {
    console.warn('[embeddingService] embedding generation failed:', err instanceof Error ? err.message : err);
    return null;
  }
};

// Persist a new embedding for a ProductBrainEntry.
// The vector is written using a raw SQL INSERT because Prisma does not support
// the pgvector `vector` type natively.
export const saveEmbedding = async (
  entryId: string,
  embedding: number[]
): Promise<string | null> => {
  try {
    const id = crypto.randomUUID();
    const vectorLiteral = `[${embedding.join(',')}]`;
    await db.$executeRaw`
      INSERT INTO "SemanticEmbedding" ("id", "entryId", "model", "dims", "embedding", "createdAt")
      VALUES (${id}, ${entryId}, ${EMBEDDING_MODEL}, ${EMBEDDING_DIMS}, ${vectorLiteral}::vector, NOW())
      ON CONFLICT ("entryId") DO UPDATE
        SET "embedding" = ${vectorLiteral}::vector,
            "model"     = ${EMBEDDING_MODEL}
    `;
    return id;
  } catch (err) {
    console.warn('[embeddingService] saveEmbedding failed:', err instanceof Error ? err.message : err);
    return null;
  }
};

// Semantic similarity search over ProductBrainEntry using cosine distance.
// Returns up to `limit` entries ordered by similarity to the query text.
export const semanticSearch = async (
  queryText: string,
  userId: string,
  options: { limit?: number; entryType?: string; workspaceId?: string } = {}
): Promise<{ entryId: string; distance: number }[]> => {
  const embedding = await generateEmbedding(queryText);
  if (!embedding) return [];

  const { limit = 10, entryType, workspaceId } = options;
  const vectorLiteral = `[${embedding.join(',')}]`;

  try {
    type Row = { entryId: string; distance: number };

    // Join SemanticEmbedding with ProductBrainEntry to apply user/type filters.
    const rows = await db.$queryRaw<Row[]>`
      SELECT se."entryId", (se."embedding" <=> ${vectorLiteral}::vector) AS distance
      FROM "SemanticEmbedding" se
      JOIN "ProductBrainEntry" pbe ON pbe."id" = se."entryId"
      WHERE pbe."userId" = ${userId}
        ${entryType    ? db.$queryRaw`AND pbe."entryType" = ${entryType}` as unknown as typeof db.$queryRaw : db.$queryRaw``}
        ${workspaceId  ? db.$queryRaw`AND pbe."workspaceId" = ${workspaceId}` as unknown as typeof db.$queryRaw : db.$queryRaw``}
      ORDER BY distance ASC
      LIMIT ${limit}
    `;
    return rows;
  } catch (err) {
    console.warn('[embeddingService] semanticSearch failed:', err instanceof Error ? err.message : err);
    return [];
  }
};
