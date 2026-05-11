// Retention + cache-cleanup sweeper. Run on a cron (e.g. daily at 02:00 UTC):
//
//   npm run retention:sweep
//
// Removes:
//   - PromptLog rows older than RETENTION_DAYS (default 60).
//     (PII risk: prompts can include user notes / emails / tokens.)
//   - DecisionReasoning rows older than RETENTION_DAYS.
//   - PromptCache rows whose expiresAt has passed.
//   - PatternAnalysis rows whose expiresAt has passed (or older than 7 days).
//   - AIInsight rows whose expiresAt has passed (or older than RETENTION_DAYS).
//   - AIPRD rows older than RETENTION_DAYS.
//   - AISuggestedTask rows older than RETENTION_DAYS that have been dismissed.
//   - ExtensionHeartbeat rows older than 7 days (telemetry only; not needed long-term).
//   - WebSocketConnection rows not updated in the past 24 hours (stale DB tombstones).
//   - ActivityLog rows older than RETENTION_DAYS.
//   - AnalysisJob rows older than RETENTION_DAYS that are terminal (completed/failed).
//
// All per-row deletes use bulk `deleteMany`. Safe to run repeatedly — the
// queries are idempotent.

import { db } from '../lib/db.js';

const readPositiveInt = (raw: string | undefined, fallback: number): number => {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export async function sweepExpiredRecords(): Promise<void> {
  const retentionDays = readPositiveInt(process.env.RETENTION_DAYS, 60);
  const cutoff          = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const patternCutoff   = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000);
  const heartbeatCutoff = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000);
  const wsstaleCutoff   = new Date(Date.now() -      24 * 60 * 60 * 1000);
  const now = new Date();

  const [
    prompts,
    reasoning,
    expiredCache,
    expiredPatterns,
    expiredInsights,
    oldPRDs,
    dismissedTasks,
    oldHeartbeats,
    staleWsRows,
    oldActivityLogs,
    oldTerminalJobs,
  ] = await Promise.all([
    db.promptLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    db.decisionReasoning.deleteMany({ where: { generatedAt: { lt: cutoff } } }),
    db.promptCache.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.patternAnalysis.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { analyzedAt: { lt: patternCutoff } },
        ],
      },
    }),
    // AIInsight: respect explicit expiresAt when set; fall back to retention window.
    db.aIInsight.deleteMany({
      where: {
        OR: [
          { expiresAt: { not: null, lt: now } },
          { expiresAt: null, generatedAt: { lt: cutoff } },
        ],
      },
    }),
    // AIPRD: plain age-based cutoff (no expiresAt field on the model).
    db.aIPRD.deleteMany({ where: { generatedAt: { lt: cutoff } } }),
    // AISuggestedTask: only remove tasks the user has already dismissed.
    // Active (undismissed) suggestions are kept regardless of age so the UI
    // never silently loses live suggestions.
    db.aISuggestedTask.deleteMany({
      where: { dismissed: true, generatedAt: { lt: cutoff } },
    }),
    // ExtensionHeartbeat: telemetry only — 7 days is plenty for trend analysis.
    db.extensionHeartbeat.deleteMany({ where: { receivedAt: { lt: heartbeatCutoff } } }),
    // WebSocketConnection: stale tombstone rows left by crashed connections.
    // wsManager.sweepStale() handles in-memory state; this covers the DB.
    db.webSocketConnection.deleteMany({ where: { updatedAt: { lt: wsstaleCutoff } } }),
    // ActivityLog: bounded by the same retention window as other PII-adjacent logs.
    db.activityLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    // AnalysisJob: keep terminal jobs for RETENTION_DAYS for audit/debugging,
    // then purge. Queued/running jobs are never deleted by the sweeper.
    db.analysisJob.deleteMany({
      where: {
        status: { in: ['completed', 'failed'] },
        createdAt: { lt: cutoff },
      },
    }),
  ]);

  console.log(
    `[retention] removed` +
    ` promptLog=${prompts.count}` +
    ` decisionReasoning=${reasoning.count}` +
    ` promptCache=${expiredCache.count}` +
    ` patternAnalysis=${expiredPatterns.count}` +
    ` aiInsight=${expiredInsights.count}` +
    ` aiPRD=${oldPRDs.count}` +
    ` aiSuggestedTask=${dismissedTasks.count}` +
    ` extensionHeartbeat=${oldHeartbeats.count}` +
    ` webSocketConnection=${staleWsRows.count}` +
    ` activityLog=${oldActivityLogs.count}` +
    ` analysisJob=${oldTerminalJobs.count}`
  );
}

// Standalone script entry point — used by `npm run retention:sweep`.
// When imported as a module (e.g. from index.ts), this block does not run.
const _isMain = process.argv[1] && /retentionSweeper\.[jt]s$/.test(process.argv[1]);
if (_isMain) {
  sweepExpiredRecords()
    .catch((err) => {
      console.error('[retention] sweep failed:', err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
