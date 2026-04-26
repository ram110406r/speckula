import Groq from "groq-sdk";
import { db } from "../lib/db.js";
import crypto from "crypto";
import { extractJsonArray } from "./jsonExtract.js";

let _groq: Groq | null = null;
const groq = new Proxy({} as Groq, {
  get(_, prop) {
    if (!_groq) {
      if (!process.env.GROQ_API_KEY) {
        throw new Error(
          "GROQ_API_KEY is not set. Set it in backend/.env to use AI features."
        );
      }
      _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    return (_groq as any)[prop];
  },
});

let dbWarningLogged = false;
const warnDbDegraded = (op: string, error: unknown) => {
  if (!dbWarningLogged) {
    dbWarningLogged = true;
    console.warn(
      `[groqService] Postgres unavailable — AI calls will run without caching/telemetry. First failure on ${op}:`,
      error instanceof Error ? error.message : error
    );
  }
};

// Model selection based on task complexity.
// Both slots use Llama 3.3 70B Versatile — Groq retired Mixtral and the older Llama3 models.
// Kept as two keys so callers can express intent; swap in a smaller model here when one ships.
const MODELS = {
  fast: "llama-3.3-70b-versatile",
  reasoning: "llama-3.3-70b-versatile",
};

interface GroqResponse {
  content: string;
  tokensUsed: number;
  modelUsed: string;
}

// Derive a stored confidence score from the AI's own output. We bump up when
// the text shows specificity signals (numbers, quoted phrases, named user
// segments) and otherwise treat the output as a softer assertion.
const SEGMENT_HINT_REGEX = /\b(users?|customers?|students|teachers|developers|designers|engineers|managers|founders|parents|teens|professionals|freelancers|nurses|patients|doctors|clinicians|gamers|creators|writers|merchants|millennials|gen ?z|gen ?x|boomers|small businesses|enterprises|teams|investors)\b/i;

const deriveConfidenceFromSpecificity = (text: string): number => {
  if (!text) return 0.6;
  const hasNumber = /\d/.test(text);
  const hasQuote = /["'`‘’“”]/.test(text);
  const hasNamedSegment = SEGMENT_HINT_REGEX.test(text);
  return hasNumber || hasQuote || hasNamedSegment ? 0.8 : 0.6;
};

/**
 * Core Groq AI Service
 * Handles all AI operations with caching and cost optimization
 */
export const groqService = {
  /**
   * Call Groq with prompt caching
   */
  async callGroq(
    prompt: string,
    model: "fast" | "reasoning" = "fast",
    userId: string,
    projectId: string
  ): Promise<GroqResponse> {
    const promptHash = this.hashPrompt(prompt);
    const modelName = MODELS[model];

    // Cache/telemetry is best-effort: if Postgres is unavailable or
    // misconfigured, fall through to a fresh Groq call so the user-facing AI
    // request still succeeds.
    const cached = await db.promptCache
      .findUnique({ where: { promptHash } })
      .catch((error) => {
        warnDbDegraded("promptCache.findUnique", error);
        return null;
      });

    if (cached && cached.expiresAt > new Date()) {
      db.promptLog.create({
        data: {
          userId,
          projectId,
          promptHash,
          prompt,
          modelUsed: modelName,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          executionMs: 0,
          cost: 0,
          cachedResult: true,
        },
      }).catch((error) => warnDbDegraded("promptLog.create (hit)", error));

      db.promptCache.update({
        where: { promptHash },
        data: { hitCount: { increment: 1 } },
      }).catch((error) => warnDbDegraded("promptCache.update", error));

      return {
        content: cached.result,
        tokensUsed: 0,
        modelUsed: modelName,
      };
    }

    // Call Groq
    const startTime = Date.now();
    const response = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: modelName,
      temperature: 0.7,
      max_tokens: 2000,
    });

    const executionMs = Date.now() - startTime;
    const content = response.choices[0]?.message?.content || "";
    const totalTokens =
      (response.usage?.prompt_tokens || 0) +
      (response.usage?.completion_tokens || 0);
    const cost = this.estimateCost(modelName, totalTokens);

    // Fire-and-forget telemetry; failures must not affect the AI response.
    db.promptLog.create({
      data: {
        userId,
        projectId,
        promptHash,
        prompt,
        modelUsed: modelName,
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        totalTokens,
        executionMs,
        cost,
        cachedResult: false,
      },
    }).catch((error) => warnDbDegraded("promptLog.create", error));

    const cacheTTLMinutes = parseInt(process.env.AI_CACHE_TTL_MINUTES || "60");
    db.promptCache.upsert({
      where: { promptHash },
      create: {
        promptHash,
        result: content,
        modelUsed: modelName,
        expiresAt: new Date(Date.now() + cacheTTLMinutes * 60 * 1000),
      },
      update: {
        result: content,
        expiresAt: new Date(Date.now() + cacheTTLMinutes * 60 * 1000),
      },
    }).catch((error) => warnDbDegraded("promptCache.upsert", error));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    db.aPIUsage.upsert({
      where: { userId_date: { userId, date: today } },
      create: {
        userId,
        date: today,
        totalRequests: 1,
        totalTokens,
        totalCost: cost,
        modelMix: modelName,
      },
      update: {
        totalRequests: { increment: 1 },
        totalTokens: { increment: totalTokens },
        totalCost: { increment: cost },
      },
    }).catch((error) => warnDbDegraded("aPIUsage.upsert", error));

    return {
      content,
      tokensUsed: totalTokens,
      modelUsed: modelName,
    };
  },

  /**
   * Generate insights from note content.
   * Returns frontend-shaped insights: { title, description, category }.
   */
  async generateInsights(
    noteContent: string,
    projectId: string,
    noteId: string,
    userId: string
  ) {
    const prompt = `You are a sharp product analyst. Your job is to surface non-obvious insights from raw research notes — things the PM might have missed, patterns across multiple data points, and contradictions worth interrogating.

Notes:
${noteContent}

Rules:
- Do not state the obvious. If a college student says they struggle to track expenses, that is not an insight — that is the problem statement. An insight is WHY they struggle, or WHAT they do instead, or WHERE existing tools fail them.
- Look for: repeated friction across different contexts, workarounds users have invented, stated needs that contradict observed behavior, segments with meaningfully different needs, market assumptions that the notes disprove.
- Each insight must reference something specific from the notes — a word, a pattern, a contradiction. If you cannot point to something specific, it is not an insight.
- Be precise. "Students avoid budgeting apps because manual entry feels like homework" is an insight. "Students need better budgeting tools" is not.

Return ONLY a JSON array (no prose, no markdown fences) with exactly 4 items:
[
  {
    "title": "Short precise headline (max 8 words, no generic verbs like 'improve' or 'enhance')",
    "description": "2-3 sentences. What is the specific pattern or contradiction? What does it imply for product decisions? Do NOT end with a generic recommendation.",
    "category": "pain-point" | "opportunity" | "user-segment" | "pattern"
  }
]`;

    const result = await this.callGroq(prompt, "reasoning", userId, projectId);
    const insights = extractJsonArray(result.content);

    type InsightCategory = "pain-point" | "opportunity" | "user-segment" | "pattern";
    const allowedCategories = new Set<InsightCategory>(["pain-point", "opportunity", "user-segment", "pattern"]);
    const normalized: { title: string; description: string; category: InsightCategory }[] = [];
    for (const raw of insights) {
      const item = raw as { title?: unknown; description?: unknown; category?: unknown };
      const title = typeof item.title === "string" ? item.title.trim() : "";
      const description = typeof item.description === "string" ? item.description.trim() : "";
      if (!title || !description) continue;
      const category: InsightCategory =
        typeof item.category === "string" && (allowedCategories as Set<string>).has(item.category)
          ? (item.category as InsightCategory)
          : "pattern";
      normalized.push({ title, description, category });
    }

    // Persist to Postgres (audit log; frontend separately writes canonical copy to Firestore)
    for (const insight of normalized) {
      await db.aIInsight.create({
        data: {
          projectId,
          noteId,
          userId,
          content: `${insight.title}\n${insight.description}`,
          confidenceScore: deriveConfidenceFromSpecificity(insight.description),
          modelUsed: result.modelUsed,
          tokensUsed: result.tokensUsed,
        },
      }).catch(() => undefined);
    }

    return { insights: normalized, tokensUsed: result.tokensUsed };
  },

  /**
   * Generate PRD from notes + decisions. Returns markdown content.
   */
  async generatePRD(
    title: string,
    projectNotes: string,
    decisions: string,
    projectId: string,
    userId: string
  ) {
    const prompt = `You are a staff PM writing a PRD that will go directly to engineering. This document must be specific enough that a developer could start building from it without asking clarifying questions.

Project: ${title}

Research and context:
${projectNotes}

Key decisions already made:
${decisions}

Write a PRD with these sections. Every section must be grounded in the research above — do not invent requirements that are not supported by evidence in the notes.

## Problem Statement
State the specific user problem in one paragraph. Name the user segment. Describe the exact friction point. Cite specific evidence from the research. Do not use generic language like "users struggle with" — be precise.

## Who This Is For
Primary user segment with specific characteristics drawn from the research.
Secondary segment if the research supports one. If the research only supports one segment, say so and do not invent a second.

## What We Are Building
Bullet list of specific capabilities. Each bullet must answer: what does the user do, what does the system do, what is the outcome? No vague features.

## User Stories
3-5 stories in the format: As a [specific user type from research], I want to [specific action], so that [specific outcome tied to a pain point in the research]. Do not write generic user stories — each one must trace back to something in the notes.

## What We Are Not Building
At least 2 explicit exclusions with reasoning. What obvious solutions did we decide against and why? This section prevents scope creep.

## How We Know It Is Working
3 specific, measurable success metrics. Each metric must include: what we measure, how we measure it, and what the threshold for success is. "Increased engagement" is not a metric.

Return only the markdown.`;

    const result = await this.callGroq(prompt, "reasoning", userId, projectId);

    await db.aIPRD.create({
      data: {
        projectId,
        userId,
        title,
        content: result.content,
        modelUsed: result.modelUsed,
        tokensUsed: result.tokensUsed,
      },
    }).catch(() => undefined);

    return { content: result.content, tokensUsed: result.tokensUsed };
  },

  /**
   * Suggest tasks from PRD or notes. Returns frontend-shaped tasks: { title, priority, milestone? }.
   */
  async suggestTasks(
    prdContent: string,
    projectId: string,
    prdId: string | undefined,
    userId: string
  ) {
    const prompt = `You are a senior engineer breaking down a spec into the minimum viable set of tasks to ship the first working version.

Source:
${prdContent}

Rules:
- Suggest exactly 5 tasks. Not features — tasks. A task is something one person can complete in 1-5 days.
- Order them by dependency: tasks that must be done first come first.
- Each task must map to a specific capability in the source spec. Do not suggest tasks for capabilities not mentioned in the spec.
- Prioritize ruthlessly: high = blocks everything else or is the core user-facing feature; medium = important but not blocking; low = polish or nice-to-have that can ship later.
- Milestone labels should reflect the shipping phase, not just repeat the task title. Use: "Foundation", "Core Feature", "Integration", "Polish", "Validation".

Return ONLY a JSON array (no prose, no markdown fences):
[
  {
    "title": "Specific task title — verb + noun + scope (e.g. 'Build expense entry form with category picker')",
    "priority": "high" | "medium" | "low",
    "milestone": "Foundation" | "Core Feature" | "Integration" | "Polish" | "Validation"
  }
]`;

    const result = await this.callGroq(prompt, "fast", userId, projectId);
    const rawTasks = extractJsonArray(result.content);

    const allowedPriorities = new Set(["high", "medium", "low"]);
    const normalized: { title: string; priority: "high" | "medium" | "low"; milestone?: string }[] = [];
    for (const raw of rawTasks) {
      const item = raw as { title?: unknown; priority?: unknown; milestone?: unknown };
      const title = typeof item.title === "string" ? item.title.trim() : "";
      if (!title) continue;
      const priority: "high" | "medium" | "low" =
        typeof item.priority === "string" && allowedPriorities.has(item.priority)
          ? (item.priority as "high" | "medium" | "low")
          : "medium";
      const milestone = typeof item.milestone === "string" && item.milestone.trim().length > 0
        ? item.milestone.trim()
        : undefined;
      normalized.push({ title, priority, milestone });
    }

    for (const task of normalized) {
      await db.aISuggestedTask.create({
        data: {
          projectId,
          prdId,
          userId,
          title: task.title,
          description: task.milestone ?? null,
          priority: task.priority,
          reasoning: task.milestone ?? "",
          confidenceScore: deriveConfidenceFromSpecificity(`${task.title} ${task.milestone ?? ""}`),
          modelUsed: result.modelUsed,
          tokensUsed: result.tokensUsed,
        },
      }).catch(() => undefined);
    }

    return { tasks: normalized, tokensUsed: result.tokensUsed };
  },

  /**
   * Analyze patterns in real-time text
   * Fast response for live feedback
   */
  async analyzePatterns(
    content: string,
    projectId: string,
    noteId: string,
    userId: string
  ) {
    const prompt = `You are a research analyst doing a first-pass quality check on product notes before they go into an AI pipeline. Your job is to flag problems with the notes themselves, not to analyze the product idea.

Text:
${content}

Check for these specific problems:

keywords: Terms that appear multiple times but are never defined. These will confuse the AI downstream. List the undefined repeated terms.

weakSignals: Claims made without evidence. Phrases like "users want", "most people", "currently", "often" without specific support. List the specific weak claims.

gaps: Questions the notes raise but do not answer. What would a PM need to know before making a decision based on these notes? List specific unanswered questions, not generic gaps.

suggestions: Specific things the PM should add to make these notes more useful for AI analysis. Not "add more detail" — specific additions like "Define what 'affordable' means to your target user" or "Add sample size for the survey results mentioned on line 3".

Return ONLY this JSON, no other text:
{
  "keywords": ["undefined term 1", "undefined term 2"],
  "weakSignals": ["specific weak claim 1", "specific weak claim 2"],
  "gaps": ["specific unanswered question 1", "specific unanswered question 2"],
  "suggestions": ["specific addition 1", "specific addition 2"]
}`;

    const result = await this.callGroq(
      prompt,
      "fast",
      userId,
      projectId
    );

    try {
      const patterns = JSON.parse(result.content);

      db.patternAnalysis.create({
        data: {
          projectId,
          noteId,
          userId,
          patterns: JSON.stringify(patterns),
          modelUsed: result.modelUsed,
          tokensUsed: result.tokensUsed,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      }).catch((error) => warnDbDegraded("patternAnalysis.create", error));

      return {
        patterns,
        tokensUsed: result.tokensUsed,
      };
    } catch (error) {
      console.error("Failed to parse patterns JSON:", error);
      throw error;
    }
  },

  /**
   * Score decision confidence
   */
  async scoreDecision(
    decisionTitle: string,
    description: string,
    context: string,
    projectId: string,
    userId: string,
    decisionId: string
  ) {
    const prompt = `
You are a senior product manager doing ruthless prioritization. Score this decision honestly. Inflated scores destroy trust — most real decisions land between 40 and 70 on a final 0-100 score, NOT 90-100. Do not be generous.

Decision: ${decisionTitle}

Description: ${description}

Context: ${context}

Score the decision on four dimensions, each as an integer from 1 to 10. Use these calibration anchors strictly:

impact — how significantly does this move a key product metric?
  9-10: moves a core retention or revenue metric by more than 20%
  5-6:  noticeable improvement, hard to attribute directly
  1-2:  cosmetic or edge-case improvement

effort — how much engineering + design work is required? (higher = more effort)
  9-10: requires new infrastructure or more than 3 months of work
  5-6:  2-6 weeks of focused engineering
  1-2:  config change or less than 1 week of work

confidence — how much evidence supports this decision?
  9-10: validated by multiple user interviews and quantitative data
  5-6:  some qualitative signal, no hard data
  1-2:  assumption with no validation

demand — how clearly and frequently do users request or need this?
  9-10: top requested feature, mentioned unprompted by more than 30% of users
  5-6:  comes up when prompted, moderate signal
  1-2:  rarely mentioned, mostly internal assumption

Be ruthlessly honest. If evidence is thin, confidence and demand should be low — that is the whole point of this exercise. Vague descriptions deserve low confidence. Big-sounding ideas with no validation deserve low impact.

Return ONLY this JSON, with integer values 1-10 for all four dimensions:
{
  "impact": 4,
  "effort": 6,
  "confidence": 3,
  "demand": 4,
  "reasoning": "One short paragraph defending these scores against the anchors above.",
  "risks": ["short risk", "short risk"],
  "nextSteps": ["short next step", "short next step"]
}`;

    const result = await this.callGroq(
      prompt,
      "reasoning",
      userId,
      projectId
    );

    // Parse and store reasoning
    try {
      const evaluation = JSON.parse(result.content);

      const clamp = (raw: unknown): number => {
        const n = Math.round(Number(raw));
        if (!Number.isFinite(n)) return 0;
        return Math.max(1, Math.min(10, n));
      };
      const impact = clamp(evaluation.impact);
      const effort = clamp(evaluation.effort);
      const confidence = clamp(evaluation.confidence);
      const demand = clamp(evaluation.demand);
      const risks: string[] = Array.isArray(evaluation.risks) ? evaluation.risks : [];
      const nextSteps: string[] = Array.isArray(evaluation.nextSteps) ? evaluation.nextSteps : [];
      const reasoning: string = typeof evaluation.reasoning === "string" ? evaluation.reasoning : "";

      const stored = await db.decisionReasoning.create({
        data: {
          decisionId,
          projectId,
          userId,
          prompt,
          reasoning,
          // Schema's confidenceScore is a Float in the 0-1 range; normalize the
          // 1-10 confidence dimension into that scale for storage.
          confidenceScore: confidence / 10,
          confidenceReasoning: risks.join("; "),
          modelUsed: result.modelUsed,
          tokensUsed: result.tokensUsed,
        },
      });

      return {
        decision: stored,
        evaluation: {
          impact,
          effort,
          confidence,
          demand,
          reasoning,
          risks,
          nextSteps,
        },
        tokensUsed: result.tokensUsed,
      };
    } catch (error) {
      console.error("Failed to parse decision JSON:", error);
      throw error;
    }
  },

  /**
   * Hash prompt for cache key
   */
  hashPrompt(prompt: string): string {
    return crypto.createHash("sha256").update(prompt).digest("hex");
  },

  /**
   * Estimate cost based on model and tokens
   * Based on Groq pricing as of 2024
   */
  estimateCost(model: string, tokens: number): number {
    const rates: Record<string, number> = {
      "llama-3.3-70b-versatile": 0.59,
    };

    const rate = rates[model] ?? 0.59;
    return (tokens / 1_000_000) * rate;
  },

  /**
   * Get database reference (for routes)
   */
  getDb() {
    return db;
  },
};
