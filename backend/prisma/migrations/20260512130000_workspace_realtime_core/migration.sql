-- Workspace realtime core: workspace profile fields + activity/metrics/context tables + workspace-scoped analysis jobs

-- Add workspace-scoped field to analysis jobs so dashboard + websockets can filter by workspace.
ALTER TABLE "AnalysisJob" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
CREATE INDEX IF NOT EXISTS "AnalysisJob_workspaceId_idx" ON "AnalysisJob"("workspaceId");

-- Extend Workspace with startup intelligence metadata.
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "startupStage" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "industry" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "productCategory" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "businessModel" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "icp" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "aiStrategy" TEXT;

-- Workspace activity feed
CREATE TABLE IF NOT EXISTS "WorkspaceActivity" (
  "id"          TEXT         NOT NULL,
  "workspaceId" TEXT         NOT NULL,
  "actorId"     TEXT         NOT NULL,
  "eventType"   TEXT         NOT NULL,
  "title"       TEXT         NOT NULL,
  "description" TEXT,
  "entityType"  TEXT,
  "entityId"    TEXT,
  "metadata"    TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkspaceActivity_workspaceId_createdAt_idx" ON "WorkspaceActivity"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "WorkspaceActivity_workspaceId_eventType_idx" ON "WorkspaceActivity"("workspaceId", "eventType");
CREATE INDEX IF NOT EXISTS "WorkspaceActivity_actorId_createdAt_idx" ON "WorkspaceActivity"("actorId", "createdAt");

-- Workspace metrics rollup
CREATE TABLE IF NOT EXISTS "WorkspaceMetrics" (
  "id"               TEXT         NOT NULL,
  "workspaceId"      TEXT         NOT NULL,
  "totalSignals"     INTEGER      NOT NULL DEFAULT 0,
  "totalDecisions"   INTEGER      NOT NULL DEFAULT 0,
  "totalSpecs"       INTEGER      NOT NULL DEFAULT 0,
  "totalTasks"       INTEGER      NOT NULL DEFAULT 0,
  "totalExperiments" INTEGER      NOT NULL DEFAULT 0,
  "aiConfidence"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceMetrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceMetrics_workspaceId_key" ON "WorkspaceMetrics"("workspaceId");
CREATE INDEX IF NOT EXISTS "WorkspaceMetrics_workspaceId_idx" ON "WorkspaceMetrics"("workspaceId");

-- Workspace context blob (AI prompt injection)
CREATE TABLE IF NOT EXISTS "WorkspaceContext" (
  "id"             TEXT         NOT NULL,
  "workspaceId"    TEXT         NOT NULL,
  "competitors"    TEXT,
  "strategy"       TEXT,
  "goals"          TEXT,
  "constraints"    TEXT,
  "startupContext" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceContext_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceContext_workspaceId_key" ON "WorkspaceContext"("workspaceId");
CREATE INDEX IF NOT EXISTS "WorkspaceContext_workspaceId_idx" ON "WorkspaceContext"("workspaceId");
