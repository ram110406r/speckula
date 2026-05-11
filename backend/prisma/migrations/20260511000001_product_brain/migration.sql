-- Enable pgvector extension for semantic similarity search.
-- This must run before any vector columns are created.
CREATE EXTENSION IF NOT EXISTS vector;

-- ExtensionSession
CREATE TABLE IF NOT EXISTS "ExtensionSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "extensionVersion" TEXT NOT NULL,
    "browserType" TEXT NOT NULL,
    "workspaceId" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExtensionSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ExtensionSession_userId_browserType_key" ON "ExtensionSession"("userId", "browserType");
CREATE INDEX IF NOT EXISTS "ExtensionSession_userId_idx" ON "ExtensionSession"("userId");
CREATE INDEX IF NOT EXISTS "ExtensionSession_lastSeenAt_idx" ON "ExtensionSession"("lastSeenAt");

-- ExtensionHeartbeat
CREATE TABLE IF NOT EXISTS "ExtensionHeartbeat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "extensionVersion" TEXT NOT NULL,
    "browserType" TEXT NOT NULL,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExtensionHeartbeat_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ExtensionHeartbeat_userId_idx" ON "ExtensionHeartbeat"("userId");
CREATE INDEX IF NOT EXISTS "ExtensionHeartbeat_createdAt_idx" ON "ExtensionHeartbeat"("createdAt");

-- AnalysisJob
CREATE TABLE IF NOT EXISTS "AnalysisJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "bullJobId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "pageType" TEXT,
    "sourceUrl" TEXT,
    "inputContent" TEXT,
    "result" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "AnalysisJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AnalysisJob_userId_idx" ON "AnalysisJob"("userId");
CREATE INDEX IF NOT EXISTS "AnalysisJob_status_idx" ON "AnalysisJob"("status");
CREATE INDEX IF NOT EXISTS "AnalysisJob_createdAt_idx" ON "AnalysisJob"("createdAt");

-- ProductBrainEntry
CREATE TABLE IF NOT EXISTS "ProductBrainEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "entryType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" TEXT,
    "sourceUrl" TEXT,
    "sourceJobId" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "tags" TEXT,
    "embeddingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductBrainEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProductBrainEntry_embeddingId_key" ON "ProductBrainEntry"("embeddingId");
CREATE INDEX IF NOT EXISTS "ProductBrainEntry_userId_idx" ON "ProductBrainEntry"("userId");
CREATE INDEX IF NOT EXISTS "ProductBrainEntry_workspaceId_idx" ON "ProductBrainEntry"("workspaceId");
CREATE INDEX IF NOT EXISTS "ProductBrainEntry_entryType_idx" ON "ProductBrainEntry"("entryType");
CREATE INDEX IF NOT EXISTS "ProductBrainEntry_createdAt_idx" ON "ProductBrainEntry"("createdAt");

-- SemanticEmbedding (stores pgvector embedding alongside metadata)
CREATE TABLE IF NOT EXISTS "SemanticEmbedding" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dims" INTEGER NOT NULL,
    "embedding" vector(1536),   -- pgvector column: 1536-dim for text-embedding-3-small
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SemanticEmbedding_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SemanticEmbedding_entryId_key" ON "SemanticEmbedding"("entryId");
CREATE INDEX IF NOT EXISTS "SemanticEmbedding_entryId_idx" ON "SemanticEmbedding"("entryId");
-- IVFFlat index for approximate nearest-neighbour search (cosine distance).
-- lists=100 is appropriate for up to ~1M rows; tune upward as the table grows.
CREATE INDEX IF NOT EXISTS "SemanticEmbedding_embedding_idx"
    ON "SemanticEmbedding" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

-- CompetitorInsight
CREATE TABLE IF NOT EXISTS "CompetitorInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "domain" TEXT NOT NULL,
    "competitorName" TEXT,
    "insightType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "evidence" TEXT,
    "sourceUrl" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "sourceJobId" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompetitorInsight_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CompetitorInsight_userId_idx" ON "CompetitorInsight"("userId");
CREATE INDEX IF NOT EXISTS "CompetitorInsight_domain_idx" ON "CompetitorInsight"("domain");
CREATE INDEX IF NOT EXISTS "CompetitorInsight_insightType_idx" ON "CompetitorInsight"("insightType");
CREATE INDEX IF NOT EXISTS "CompetitorInsight_capturedAt_idx" ON "CompetitorInsight"("capturedAt");

-- MarketSignal
CREATE TABLE IF NOT EXISTS "MarketSignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "signalType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "tags" TEXT,
    "sourceJobId" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketSignal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MarketSignal_userId_idx" ON "MarketSignal"("userId");
CREATE INDEX IF NOT EXISTS "MarketSignal_signalType_idx" ON "MarketSignal"("signalType");
CREATE INDEX IF NOT EXISTS "MarketSignal_detectedAt_idx" ON "MarketSignal"("detectedAt");

-- Notification
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_read_idx" ON "Notification"("read");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");

-- ActivityLog
CREATE TABLE IF NOT EXISTS "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ActivityLog_userId_idx" ON "ActivityLog"("userId");
CREATE INDEX IF NOT EXISTS "ActivityLog_action_idx" ON "ActivityLog"("action");
CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- WebSocketConnection
CREATE TABLE IF NOT EXISTS "WebSocketConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "connectionId" TEXT NOT NULL,
    "metadata" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPingAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebSocketConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WebSocketConnection_connectionId_key" ON "WebSocketConnection"("connectionId");
CREATE INDEX IF NOT EXISTS "WebSocketConnection_userId_idx" ON "WebSocketConnection"("userId");
CREATE INDEX IF NOT EXISTS "WebSocketConnection_lastPingAt_idx" ON "WebSocketConnection"("lastPingAt");
