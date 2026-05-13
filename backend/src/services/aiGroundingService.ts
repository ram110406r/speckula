import { db } from '../lib/db.js';

const truncate = (text: string, max: number): string => {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
};

const safeJsonSnippet = (raw: string | null | undefined, max = 800): string => {
  if (!raw) return '';
  const t = raw.trim();
  if (!t) return '';
  // Keep as a single line. We intentionally do not parse/pretty-print here.
  return truncate(t, max);
};

export async function getWorkspaceEvidence(params: {
  userId: string;
  workspaceId?: string | null;
  maxSignals?: number;
  maxCompetitorInsights?: number;
  maxBrainEntries?: number;
}): Promise<string> {
  const workspaceId = params.workspaceId ?? null;
  if (!workspaceId) return '';

  const maxSignals = params.maxSignals ?? 6;
  const maxCompetitors = params.maxCompetitorInsights ?? 6;
  const maxBrain = params.maxBrainEntries ?? 6;

  // Guard against cross-workspace data leakage: require membership.
  const member = await db.workspaceMember
    .findUnique({
      where: { workspaceId_userId: { workspaceId, userId: params.userId } },
      select: { role: true },
    })
    .catch(() => null);
  if (!member) return '';

  const [workspace, context, signals, competitorInsights, brain] = await Promise.all([
    db.workspace
      .findFirst({
        where: { id: workspaceId, deletedAt: null },
        select: {
          id: true,
          name: true,
          slug: true,
          startupStage: true,
          industry: true,
          productCategory: true,
          businessModel: true,
          icp: true,
          aiStrategy: true,
        },
      })
      .catch(() => null),

    db.workspaceContext
      .findUnique({
        where: { workspaceId },
        select: { competitors: true, strategy: true, goals: true, constraints: true, startupContext: true },
      })
      .catch(() => null),

    db.marketSignal
      .findMany({
        where: { workspaceId, userId: params.userId },
        orderBy: { detectedAt: 'desc' },
        take: maxSignals,
        select: { signalType: true, title: true, content: true, strength: true, detectedAt: true, sourceUrl: true },
      })
      .catch(() => []),

    db.competitorInsight
      .findMany({
        where: { workspaceId, userId: params.userId },
        orderBy: { capturedAt: 'desc' },
        take: maxCompetitors,
        select: {
          domain: true,
          competitorName: true,
          insightType: true,
          title: true,
          content: true,
          confidence: true,
          capturedAt: true,
          sourceUrl: true,
        },
      })
      .catch(() => []),

    db.productBrainEntry
      .findMany({
        where: {
          workspaceId,
          userId: params.userId,
          entryType: {
            in: ['pm_insight', 'market_signal', 'competitor_insight', 'strategic_decision', 'pricing_observation'],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: maxBrain,
        select: { entryType: true, title: true, content: true, sourceUrl: true, confidence: true, createdAt: true },
      })
      .catch(() => []),
  ]);

  const lines: string[] = [];
  lines.push('Workspace evidence (from database; treat as the only source of truth):');

  if (workspace) {
    lines.push('Workspace profile:');
    lines.push(`- name: ${workspace.name} (slug: ${workspace.slug})`);
    if (workspace.startupStage) lines.push(`- stage: ${workspace.startupStage}`);
    if (workspace.industry) lines.push(`- industry: ${workspace.industry}`);
    if (workspace.productCategory) lines.push(`- category: ${workspace.productCategory}`);
    if (workspace.businessModel) lines.push(`- businessModel: ${workspace.businessModel}`);
    if (workspace.icp) lines.push(`- icp: ${truncate(workspace.icp, 260)}`);
    if (workspace.aiStrategy) lines.push(`- aiStrategy: ${truncate(workspace.aiStrategy, 260)}`);
  }

  const ctxLines: string[] = [];
  if (context) {
    const competitors = safeJsonSnippet(context.competitors);
    const strategy = safeJsonSnippet(context.strategy);
    const goals = safeJsonSnippet(context.goals);
    const constraints = safeJsonSnippet(context.constraints);
    const startupContext = safeJsonSnippet(context.startupContext);

    if (competitors) ctxLines.push(`- competitors: ${competitors}`);
    if (strategy) ctxLines.push(`- strategy: ${strategy}`);
    if (goals) ctxLines.push(`- goals: ${goals}`);
    if (constraints) ctxLines.push(`- constraints: ${constraints}`);
    if (startupContext) ctxLines.push(`- startupContext: ${startupContext}`);
  }
  if (ctxLines.length) {
    lines.push('Workspace context:');
    lines.push(...ctxLines);
  }

  if (signals.length) {
    lines.push('Recent market signals:');
    for (const s of signals) {
      const when = s.detectedAt.toISOString().slice(0, 10);
      lines.push(
        `- [${when}] (${s.signalType}, strength ${(s.strength ?? 0.5).toFixed(2)}) ${truncate(s.title, 120)} — ${truncate(s.content, 260)}`
      );
    }
  }

  if (competitorInsights.length) {
    lines.push('Recent competitor insights:');
    for (const c of competitorInsights) {
      const when = c.capturedAt.toISOString().slice(0, 10);
      const name = c.competitorName ? ` (${c.competitorName})` : '';
      lines.push(
        `- [${when}] ${c.domain}${name} [${c.insightType}] ${truncate(c.title, 120)} — ${truncate(c.content, 260)}`
      );
    }
  }

  if (brain.length) {
    lines.push('Recent product brain entries:');
    for (const b of brain) {
      const when = b.createdAt.toISOString().slice(0, 10);
      lines.push(
        `- [${when}] (${b.entryType}, conf ${(b.confidence ?? 0.7).toFixed(2)}) ${truncate(b.title, 120)} — ${truncate(b.content, 260)}`
      );
    }
  }

  // If we only have the header and no evidence, don't bloat prompts.
  if (lines.length <= 1) return '';

  return lines.join('\n').trim();
}
