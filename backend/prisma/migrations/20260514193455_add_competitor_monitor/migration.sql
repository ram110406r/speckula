/*
  Warnings:

  - You are about to drop the column `embedding` on the `SemanticEmbedding` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "SemanticEmbedding_embedding_hnsw_idx";

-- AlterTable
ALTER TABLE "AnalysisJob" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProductBrainEntry" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SemanticEmbedding" DROP COLUMN "embedding";

-- AlterTable
ALTER TABLE "WorkspaceContext" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkspaceMetrics" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "CompetitorMonitor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "domain" TEXT NOT NULL,
    "addedUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "lastJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitorMonitor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompetitorMonitor_userId_idx" ON "CompetitorMonitor"("userId");

-- CreateIndex
CREATE INDEX "CompetitorMonitor_workspaceId_idx" ON "CompetitorMonitor"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorMonitor_userId_domain_key" ON "CompetitorMonitor"("userId", "domain");
