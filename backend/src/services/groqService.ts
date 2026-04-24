import Groq from "groq-sdk";
import { db } from "../lib/db.js";
import crypto from "crypto";

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
    await db.promptCache.create({
      data: {
        promptHash,
        result: content,
        modelUsed: modelName,
        expiresAt: new Date(Date.now() + cacheTTLMinutes * 60 * 1000),
      },
    });

    return {
      content,
      tokensUsed: totalTokens,
      modelUsed: modelName,
    };
  },

  /**
   * Generate insights from note content
   */
  async generateInsights(
    noteContent: string,
    projectId: string,
    noteId: string,
    userId: string
  ) {
    const prompt = `
Analyze the following note and extract key insights. Return as JSON.

Note:
${noteContent}

Return JSON with this structure:
{
  "insights": [
    {
      "insight": "The actual insight text",
      "confidence": 0.85,
      "category": "opportunity|risk|trend|observation"
    }
  ],
  "summary": "Brief summary of all insights"
}

Only return the JSON, no other text.`;

    const result = await this.callGroq(
      prompt,
      "reasoning",
      userId,
      projectId
    );

    // Parse and store insights
    try {
      const parsed = JSON.parse(result.content);
      const insights = [];

      for (const insight of parsed.insights || []) {
        const stored = await db.aIInsight.create({
          data: {
            projectId,
            noteId,
            userId,
            content: insight.insight,
            confidenceScore: insight.confidence,
            modelUsed: result.modelUsed,
            tokensUsed: result.tokensUsed,
          },
        });
        insights.push(stored);
      }

      return {
        insights,
        summary: parsed.summary,
        tokensUsed: result.tokensUsed,
      };
    } catch (error) {
      console.error("Failed to parse insights JSON:", error);
      throw error;
    }
  },

  /**
   * Generate PRD from notes + decisions
   */
  async generatePRD(
    title: string,
    projectNotes: string,
    decisions: string,
    projectId: string,
    userId: string
  ) {
    const prompt = `
You are a product strategist. Create a comprehensive PRD (Product Requirements Document) based on the following context.

Project Title: ${title}

Notes:
${projectNotes}

Key Decisions:
${decisions}

Generate a complete PRD with:
- Executive Summary
- Problem Statement
- Proposed Solution
- Key Features
- Success Metrics
- Timeline
- Dependencies
- Risks & Mitigations

Format as markdown.`;

    const result = await this.callGroq(prompt, "reasoning", userId, projectId);

    // Store PRD
    const prd = await db.aIPRD.create({
      data: {
        projectId,
        userId,
        title,
        content: result.content,
        modelUsed: result.modelUsed,
        tokensUsed: result.tokensUsed,
      },
    });

    return {
      prd,
      tokensUsed: result.tokensUsed,
    };
  },

  /**
   * Suggest tasks from PRD
   */
  async suggestTasks(
    prdContent: string,
    projectId: string,
    prdId: string | undefined,
    userId: string
  ) {
    const prompt = `
Based on this PRD, suggest concrete tasks for implementation. Return as JSON.

PRD:
${prdContent}

Return JSON with this structure:
{
  "tasks": [
    {
      "title": "Task title",
      "description": "What needs to be done",
      "priority": "high|medium|low",
      "estimatedDays": 3,
      "reasoning": "Why this task is important"
    }
  ]
}

Only return the JSON, no other text.`;

    const result = await this.callGroq(
      prompt,
      "fast",
      userId,
      projectId
    );

    // Parse and store suggestions
    try {
      const parsed = JSON.parse(result.content);
      const tasks = [];

      for (const task of parsed.tasks || []) {
        const stored = await db.aISuggestedTask.create({
          data: {
            projectId,
            prdId,
            userId,
            title: task.title,
            description: task.description,
            priority: task.priority,
            reasoning: task.reasoning,
            confidenceScore: 0.8,
            modelUsed: result.modelUsed,
            tokensUsed: result.tokensUsed,
          },
        });
        tasks.push(stored);
      }

      return {
        tasks,
        tokensUsed: result.tokensUsed,
      };
    } catch (error) {
      console.error("Failed to parse tasks JSON:", error);
      throw error;
    }
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
