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
//
// All per-row deletes use bulk `deleteMany`. Safe to run repeatedly — the
// queries are idempotent.

import { db } from '../lib/db.js';

const readPositiveInt = (raw: string | undefined, fallback: number): number => {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

async function main() {
  const retentionDays = readPositiveInt(process.env.RETENTION_DAYS, 60);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const now = new Date();

  console.log(`[retention] cutoff=${cutoff.toISOString()} now=${now.toISOString()}`);

  const [prompts, reasoning, expiredCache, expiredPatterns] = await Promise.all([
    db.promptLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    db.decisionReasoning.deleteMany({ where: { generatedAt: { lt: cutoff } } }),
    db.promptCache.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.patternAnalysis.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { analyzedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        ],
      },
    }),
  ]);

  console.log(
    `[retention] removed promptLog=${prompts.count} decisionReasoning=${reasoning.count} promptCache=${expiredCache.count} patternAnalysis=${expiredPatterns.count}`
  );
}

main()
  .catch((err) => {
    console.error('[retention] sweep failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
