-- Add decisionId column to ProductBrainEntry for O(1) indexed confidence updates.
-- Without this column, learningService scanned the full table and parsed JSON
-- metadata to find matching entries; now it uses a direct indexed lookup.
--
-- embeddingStatus tracks whether the pgvector embedding was generated successfully,
-- allowing background jobs to retry failed embeddings instead of silently dropping them.
ALTER TABLE "ProductBrainEntry" ADD COLUMN IF NOT EXISTS "decisionId" TEXT;
ALTER TABLE "ProductBrainEntry" ADD COLUMN IF NOT EXISTS "embeddingStatus" TEXT NOT NULL DEFAULT 'pending';
CREATE INDEX IF NOT EXISTS "ProductBrainEntry_userId_decisionId_idx"
    ON "ProductBrainEntry"("userId", "decisionId");
