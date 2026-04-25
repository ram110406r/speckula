import Groq from "groq-sdk";
import { db } from "../lib/db.js";
import crypto from "crypto";
import { extractJsonArray } from "./jsonExtract.js";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

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

    // Check cache first
    const cached = await db.promptCache.findUnique({
      where: { promptHash },
    });

    if (cached && cached.expiresAt > new Date()) {
      // Log cache hit
      await db.promptLog.create({
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
      });

      // Update hit count
      await db.promptCache.update({
        where: { promptHash },
        data: { hitCount: { increment: 1 } },
      });

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

    // Log API usage
    await db.promptLog.create({
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
    });

    // Cache result
    const cacheTTLMinutes = parseInt(process.env.AI_CACHE_TTL_MINUTES || "60");
    await db.promptCache.upsert({
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
    });

    // Daily per-user usage aggregate
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await db.aPIUsage.upsert({
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
    });

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
    const prompt = `Extract exactly 4 key product insights from these notes.

Notes:
${noteContent}

Return ONLY a JSON array (no prose, no markdown fences) with this exact shape:
[
  { "title": "Short headline (max 8 words)", "description": "1-2 sentence explanation", "category": "pain-point" | "opportunity" | "user-segment" | "pattern" }
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
          confidenceScore: 0.7,
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
    const prompt = `Generate a professional, detailed PRD based on these notes.

Project Title: ${title}

Notes:
${projectNotes}

Key Decisions:
${decisions}

The PRD MUST include the following sections:
1. Problem Statement (Deep dive into current friction)
2. Target Users (Primary/Secondary segments)
3. Feature Breakdown (Core capabilities)
4. User Stories (As a... I want to... so that...)
5. Edge Cases (Potential pitfalls)
6. Success Metrics (KPIs to measure impact)

Format in clean Markdown with professional headings. Return only the markdown.`;

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
    const prompt = `Suggest 5 concrete execution tasks for this work.

Source:
${prdContent}

Return ONLY a JSON array (no prose, no markdown fences) with this exact shape:
[
  { "title": "Task title", "priority": "high" | "medium" | "low", "milestone": "Short milestone label" }
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
          confidenceScore: 0.7,
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
    const prompt = `
Analyze this text for patterns. Return as JSON.

Text:
${content}

Identify:
1. Repeated keywords or concepts
2. Weak or unclear definitions
3. Missing context or gaps
4. Suggestions for improvement

Return JSON:
{
  "keywords": ["keyword1", "keyword2"],
  "weakSignals": ["unclear concept 1"],
  "gaps": ["missing information 1"],
  "suggestions": ["suggestion 1"]
}

Only return the JSON, no other text.`;

    const result = await this.callGroq(
      prompt,
      "fast",
      userId,
      projectId
    );

    try {
      const patterns = JSON.parse(result.content);

      await db.patternAnalysis.create({
        data: {
          projectId,
          noteId,
          userId,
          patterns: JSON.stringify(patterns),
          modelUsed: result.modelUsed,
          tokensUsed: result.tokensUsed,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });

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
You are evaluating a product decision. Rate its confidence level and provide reasoning.

Decision: ${decisionTitle}

Description: ${description}

Context: ${context}

Provide:
1. Confidence score (0.0 to 1.0)
2. Key reasoning points
3. Potential risks
4. Recommended next steps

Return JSON:
{
  "confidenceScore": 0.75,
  "reasoning": "Clear reasoning...",
  "risks": ["risk1"],
  "nextSteps": ["step1"]
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

      const stored = await db.decisionReasoning.create({
        data: {
          decisionId,
          projectId,
          userId,
          prompt,
          reasoning: evaluation.reasoning,
          confidenceScore: evaluation.confidenceScore,
          confidenceReasoning: evaluation.risks.join("; "),
          modelUsed: result.modelUsed,
          tokensUsed: result.tokensUsed,
        },
      });

      return {
        decision: stored,
        evaluation,
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
