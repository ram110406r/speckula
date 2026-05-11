-- Intelligence Loop: Workspace, Outcome, LearningInsight, AgentRun, RoadmapItem, Experiment, ExperimentVariant

-- WORKSPACE ISOLATION

CREATE TABLE "Workspace" (
    "id"          TEXT        NOT NULL,
    "ownerId"     TEXT        NOT NULL,
    "name"        TEXT        NOT NULL,
    "slug"        TEXT        NOT NULL,
    "description" TEXT,
    "metadata"    TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    "deletedAt"   TIMESTAMP(3),
    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");
CREATE INDEX "Workspace_ownerId_idx"  ON "Workspace"("ownerId");
CREATE INDEX "Workspace_slug_idx"     ON "Workspace"("slug");

CREATE TABLE "WorkspaceMember" (
    "id"          TEXT        NOT NULL,
    "workspaceId" TEXT        NOT NULL,
    "userId"      TEXT        NOT NULL,
    "role"        TEXT        NOT NULL DEFAULT 'editor',
    "invitedBy"   TEXT,
    "joinedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");
CREATE INDEX "WorkspaceMember_workspaceId_idx" ON "WorkspaceMember"("workspaceId");
CREATE INDEX "WorkspaceMember_userId_idx"      ON "WorkspaceMember"("userId");

-- OUTCOME & LEARNING LOOP

CREATE TABLE "Outcome" (
    "id"                TEXT        NOT NULL,
    "userId"            TEXT        NOT NULL,
    "workspaceId"       TEXT,
    "decisionId"        TEXT        NOT NULL,
    "decisionTitle"     TEXT        NOT NULL,
    "expectedMetric"    TEXT        NOT NULL,
    "expectedValue"     DOUBLE PRECISION NOT NULL,
    "expectedTimeframe" TEXT        NOT NULL,
    "actualValue"       DOUBLE PRECISION,
    "observedAt"        TIMESTAMP(3),
    "deviationPct"      DOUBLE PRECISION,
    "verdict"           TEXT,
    "status"            TEXT        NOT NULL DEFAULT 'pending',
    "confidenceDelta"   DOUBLE PRECISION,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Outcome_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Outcome_userId_idx"     ON "Outcome"("userId");
CREATE INDEX "Outcome_decisionId_idx" ON "Outcome"("decisionId");
CREATE INDEX "Outcome_status_idx"     ON "Outcome"("status");
CREATE INDEX "Outcome_createdAt_idx"  ON "Outcome"("createdAt");

CREATE TABLE "LearningInsight" (
    "id"              TEXT        NOT NULL,
    "userId"          TEXT        NOT NULL,
    "workspaceId"     TEXT,
    "outcomeId"       TEXT        NOT NULL,
    "decisionId"      TEXT        NOT NULL,
    "insight"         TEXT        NOT NULL,
    "rootCause"       TEXT,
    "actionableNext"  TEXT,
    "confidenceShift" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tags"            TEXT,
    "modelUsed"       TEXT        NOT NULL,
    "tokensUsed"      INTEGER     NOT NULL DEFAULT 0,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearningInsight_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LearningInsight_userId_idx"     ON "LearningInsight"("userId");
CREATE INDEX "LearningInsight_outcomeId_idx"  ON "LearningInsight"("outcomeId");
CREATE INDEX "LearningInsight_decisionId_idx" ON "LearningInsight"("decisionId");
CREATE INDEX "LearningInsight_createdAt_idx"  ON "LearningInsight"("createdAt");

ALTER TABLE "LearningInsight"
    ADD CONSTRAINT "LearningInsight_outcomeId_fkey"
    FOREIGN KEY ("outcomeId") REFERENCES "Outcome"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AUTONOMOUS AGENT RUNS

CREATE TABLE "AgentRun" (
    "id"             TEXT        NOT NULL,
    "userId"         TEXT        NOT NULL,
    "workspaceId"    TEXT,
    "idea"           TEXT        NOT NULL,
    "depth"          TEXT        NOT NULL DEFAULT 'standard',
    "status"         TEXT        NOT NULL DEFAULT 'running',
    "currentStep"    TEXT,
    "steps"          TEXT,
    "clarifications" TEXT,
    "decisions"      TEXT,
    "strategy"       TEXT,
    "roadmap"        TEXT,
    "verdict"        TEXT,
    "verdictReason"  TEXT,
    "modelUsed"      TEXT,
    "tokensUsed"     INTEGER     NOT NULL DEFAULT 0,
    "durationMs"     INTEGER,
    "error"          TEXT,
    "startedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt"    TIMESTAMP(3),
    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentRun_userId_idx"    ON "AgentRun"("userId");
CREATE INDEX "AgentRun_status_idx"    ON "AgentRun"("status");
CREATE INDEX "AgentRun_startedAt_idx" ON "AgentRun"("startedAt");

-- ROADMAPS

CREATE TABLE "RoadmapItem" (
    "id"           TEXT        NOT NULL,
    "userId"       TEXT        NOT NULL,
    "workspaceId"  TEXT,
    "title"        TEXT        NOT NULL,
    "description"  TEXT,
    "quarter"      TEXT        NOT NULL,
    "status"       TEXT        NOT NULL DEFAULT 'planned',
    "priority"     TEXT        NOT NULL DEFAULT 'medium',
    "aiScore"      DOUBLE PRECISION,
    "aiRationale"  TEXT,
    "decisionId"   TEXT,
    "dependsOn"    TEXT,
    "tags"         TEXT,
    "progress"     INTEGER     NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    "deletedAt"    TIMESTAMP(3),
    CONSTRAINT "RoadmapItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoadmapItem_userId_idx"      ON "RoadmapItem"("userId");
CREATE INDEX "RoadmapItem_workspaceId_idx" ON "RoadmapItem"("workspaceId");
CREATE INDEX "RoadmapItem_quarter_idx"     ON "RoadmapItem"("quarter");
CREATE INDEX "RoadmapItem_status_idx"      ON "RoadmapItem"("status");

-- EXPERIMENTS

CREATE TABLE "Experiment" (
    "id"           TEXT        NOT NULL,
    "userId"       TEXT        NOT NULL,
    "workspaceId"  TEXT,
    "title"        TEXT        NOT NULL,
    "hypothesis"   TEXT        NOT NULL,
    "targetMetric" TEXT        NOT NULL,
    "status"       TEXT        NOT NULL DEFAULT 'planned',
    "startedAt"    TIMESTAMP(3),
    "endedAt"      TIMESTAMP(3),
    "aiInsight"    TEXT,
    "tags"         TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    "deletedAt"    TIMESTAMP(3),
    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Experiment_userId_idx"      ON "Experiment"("userId");
CREATE INDEX "Experiment_workspaceId_idx" ON "Experiment"("workspaceId");
CREATE INDEX "Experiment_status_idx"      ON "Experiment"("status");
CREATE INDEX "Experiment_createdAt_idx"   ON "Experiment"("createdAt");

CREATE TABLE "ExperimentVariant" (
    "id"             TEXT        NOT NULL,
    "experimentId"   TEXT        NOT NULL,
    "name"           TEXT        NOT NULL,
    "isControl"      BOOLEAN     NOT NULL DEFAULT false,
    "impressions"    INTEGER     NOT NULL DEFAULT 0,
    "conversions"    INTEGER     NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION,
    "lift"           DOUBLE PRECISION,
    "pValue"         DOUBLE PRECISION,
    "significant"    BOOLEAN,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExperimentVariant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExperimentVariant_experimentId_idx" ON "ExperimentVariant"("experimentId");

ALTER TABLE "ExperimentVariant"
    ADD CONSTRAINT "ExperimentVariant_experimentId_fkey"
    FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
