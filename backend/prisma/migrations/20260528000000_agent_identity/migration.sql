-- Agent Identity: persistent, configurable agents (replaces job-derived agents).

CREATE TABLE "Agent" (
    "id"                TEXT         NOT NULL,
    "userId"            TEXT         NOT NULL,
    "workspaceId"       TEXT,
    "key"               TEXT         NOT NULL,
    "name"              TEXT         NOT NULL,
    "role"              TEXT         NOT NULL,
    "objective"         TEXT,
    "modelName"         TEXT         NOT NULL DEFAULT 'llama-3.3-70b-versatile',
    "temperature"       DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "autonomyLevel"     TEXT         NOT NULL DEFAULT 'suggest',
    "enabled"           BOOLEAN      NOT NULL DEFAULT true,
    "schedule"          TEXT,
    "tokenBudget"       INTEGER,
    "maxRetries"        INTEGER      NOT NULL DEFAULT 1,
    "memoryScope"       TEXT         NOT NULL DEFAULT 'workspace',
    "tools"             TEXT,
    "permissions"       TEXT,
    "confidenceProfile" TEXT,
    "executionPolicy"   TEXT,
    "isDefault"         BOOLEAN      NOT NULL DEFAULT false,
    "lastRunAt"         TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Agent_userId_key_key" ON "Agent"("userId", "key");
CREATE INDEX "Agent_userId_idx"      ON "Agent"("userId");
CREATE INDEX "Agent_workspaceId_idx" ON "Agent"("workspaceId");
CREATE INDEX "Agent_enabled_idx"     ON "Agent"("enabled");
