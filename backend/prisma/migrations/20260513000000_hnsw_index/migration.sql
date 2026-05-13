-- Upgrade SemanticEmbedding index from IVFFlat to HNSW.
-- HNSW is faster at query time and requires no tuning of probes — it stays
-- accurate without SET ivfflat.probes before each similarity search.
-- m=16 (max connections per layer) and ef_construction=64 balance index size
-- vs recall. With < 1M rows, this builds in under a minute.
DROP INDEX IF EXISTS "SemanticEmbedding_embedding_idx";
CREATE INDEX "SemanticEmbedding_embedding_hnsw_idx"
    ON "SemanticEmbedding" USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
