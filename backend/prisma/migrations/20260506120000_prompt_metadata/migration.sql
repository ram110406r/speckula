-- v2.3: prompt registry correlation columns on PromptLog.
-- Both columns are nullable so legacy rows remain valid.

ALTER TABLE "PromptLog"
  ADD COLUMN "promptId" TEXT,
  ADD COLUMN "promptVersion" TEXT;

-- Index for the prompt-health aggregation endpoint.
CREATE INDEX "PromptLog_promptId_idx" ON "PromptLog"("promptId");
