-- CreateTable
CREATE TABLE "AIInsight" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'groq',
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "modelUsed" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "AIInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIPRD" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "modelUsed" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIPRD_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionReasoning" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "confidenceReasoning" TEXT NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecisionReasoning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatternAnalysis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "patterns" TEXT NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "PatternAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "executionMs" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "cachedResult" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptCache" (
    "id" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AISuggestedTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "prdId" TEXT,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "reasoning" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "modelUsed" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AISuggestedTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APIUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "modelMix" TEXT NOT NULL,

    CONSTRAINT "APIUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIInsight_projectId_idx" ON "AIInsight"("projectId");

-- CreateIndex
CREATE INDEX "AIInsight_userId_idx" ON "AIInsight"("userId");

-- CreateIndex
CREATE INDEX "AIInsight_noteId_idx" ON "AIInsight"("noteId");

-- CreateIndex
CREATE INDEX "AIInsight_generatedAt_idx" ON "AIInsight"("generatedAt");

-- CreateIndex
CREATE INDEX "AIPRD_projectId_idx" ON "AIPRD"("projectId");

-- CreateIndex
CREATE INDEX "AIPRD_userId_idx" ON "AIPRD"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionReasoning_decisionId_key" ON "DecisionReasoning"("decisionId");

-- CreateIndex
CREATE INDEX "DecisionReasoning_projectId_idx" ON "DecisionReasoning"("projectId");

-- CreateIndex
CREATE INDEX "DecisionReasoning_userId_idx" ON "DecisionReasoning"("userId");

-- CreateIndex
CREATE INDEX "DecisionReasoning_userId_generatedAt_idx" ON "DecisionReasoning"("userId", "generatedAt");

-- CreateIndex
CREATE INDEX "PatternAnalysis_projectId_idx" ON "PatternAnalysis"("projectId");

-- CreateIndex
CREATE INDEX "PatternAnalysis_noteId_idx" ON "PatternAnalysis"("noteId");

-- CreateIndex
CREATE INDEX "PatternAnalysis_analyzedAt_idx" ON "PatternAnalysis"("analyzedAt");

-- CreateIndex
CREATE INDEX "PromptLog_userId_idx" ON "PromptLog"("userId");

-- CreateIndex
CREATE INDEX "PromptLog_projectId_idx" ON "PromptLog"("projectId");

-- CreateIndex
CREATE INDEX "PromptLog_promptHash_idx" ON "PromptLog"("promptHash");

-- CreateIndex
CREATE INDEX "PromptLog_createdAt_idx" ON "PromptLog"("createdAt");

-- CreateIndex
CREATE INDEX "PromptLog_userId_createdAt_idx" ON "PromptLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromptCache_promptHash_key" ON "PromptCache"("promptHash");

-- CreateIndex
CREATE INDEX "PromptCache_expiresAt_idx" ON "PromptCache"("expiresAt");

-- CreateIndex
CREATE INDEX "AISuggestedTask_projectId_idx" ON "AISuggestedTask"("projectId");

-- CreateIndex
CREATE INDEX "AISuggestedTask_prdId_idx" ON "AISuggestedTask"("prdId");

-- CreateIndex
CREATE INDEX "AISuggestedTask_userId_idx" ON "AISuggestedTask"("userId");

-- CreateIndex
CREATE INDEX "APIUsage_userId_idx" ON "APIUsage"("userId");

-- CreateIndex
CREATE INDEX "APIUsage_date_idx" ON "APIUsage"("date");

-- CreateIndex
CREATE UNIQUE INDEX "APIUsage_userId_date_key" ON "APIUsage"("userId", "date");

