import { auth } from "../firebase/config";
import {
  createDocument,
  getUserDocuments,
  saveDocument,
  saveInsight,
  savePRD,
  saveTask,
} from "../firebase/db";
import { useAppStore } from "@/store/useAppStore";
import type { ExtractedEntities, HierarchicalContext, ThinkingGap } from "./aiContext";
import type { ProgressState } from "./progressTracker";
import { calculateScore, clampScoreValue } from "./scoreEngine";
import { updateConfidenceScore, persistOutcomeFeedback } from "./scoreFeedback";
import { generateLearningInsight } from "./learningEngine";
import type { OutcomeFeedback } from "./outcomeTypes";
import type { OpportunityScoreState } from "./scoreEvolution";

export interface ProactiveInsight {
  title: string;
  description: string;
  category: "pain-point" | "opportunity" | "pattern";
}

export interface ProactiveHint {
  text: string;
  confidence: number;
  why: string;
}

export interface ProactiveThinkingSignals {
  insights: ProactiveInsight[];
  suggestions: ProactiveHint[];
  challenges: ProactiveHint[];
  decisions?: ProactiveHint[];
}

export interface DecisionSuggestion {
  title: string;
  justification: string;
  priority: "high" | "medium" | "low";
  impact: number;
  effort: number;
  userStory: string;
  tradeoffs: string;
}

export interface StrategicGuidance {
  theme: string;
  rationale: string;
  gaps: string[];
  recommendation: string;
}

export interface OpportunityScoreBreakdown {
  impact: number;
  effort: number;
  confidence: number;
  demand: number;
}

export interface OpportunityScoreResult extends OpportunityScoreBreakdown {
  score: number;
  reasoning: string;
}

export interface InlineSuggestionPayload {
  stage: "problem" | "solution" | "metrics" | "exploration";
  next_steps: string[];
  suggestions?: string[];
}

export interface InlineLearningProfile {
  accepted: string[];
  dismissed: string[];
}

interface TipTapNode {
  type?: string;
  text?: string;
  content?: TipTapNode[];
}

interface TipTapDoc {
  content?: TipTapNode[];
}

/**
 * Simplistic helper to convert TipTap JSON to plain text for LLM context
 */
function tipTapToText(json: unknown): string {
  const doc = (json ?? {}) as TipTapDoc;
  if (!doc.content) return "";
  let text = "";
  
  const processNodes = (nodes: TipTapNode[]) => {
    nodes.forEach(node => {
      if (node.text) text += node.text;
      if (node.content) processNodes(node.content);
      if (node.type === 'paragraph' || node.type === 'heading') text += "\n";
    });
  };

  processNodes(doc.content);
  return text;
}

async function getAuthToken(forceRefresh = false) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Authentication required.");
  }

  return currentUser.getIdToken(forceRefresh);
}

async function callAI(prompt: string, context: string) {
  const maxAttempts = 2;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const token = await getAuthToken(attempt > 0);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: "You are an expert Product Manager. Use the provided product notes to fulfill the user request. Respond ONLY with the requested data in the specified format."
            },
            {
              role: "user",
              content: `Product Notes:\n${context}\n\nTask: ${prompt}`
            }
          ]
        }),
        signal: controller.signal,
      });

      if (response.status === 401 && attempt === 0) {
        continue;
      }

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(`AI call failed (${response.status}): ${errorBody || response.statusText}`);
      }

      // We handle non-streaming for actions to get a clean structured result
      return await response.text();
    } catch (error) {
      const isAbortError = error instanceof DOMException && error.name === "AbortError";
      if (attempt === maxAttempts - 1 || isAbortError) {
        throw error;
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  throw new Error("AI call failed.");
}

interface BackendEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

/**
 * Call a dedicated Fastify route through the Next.js proxy.
 * Handles auth header, 30s timeout, 401 retry-with-refresh, and unwraps the { ok, data } envelope.
 */
async function callBackendRoute<T>(path: string, body: unknown): Promise<T> {
  const maxAttempts = 2;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const token = await getAuthToken(attempt > 0);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`/api/ai/${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.status === 401 && attempt === 0) {
        continue;
      }

      const envelope = await response.json().catch(() => null) as BackendEnvelope<T> | null;
      if (!response.ok || !envelope?.ok || envelope.data === undefined) {
        const message = envelope?.error || `Backend call failed (${response.status})`;
        throw new Error(message);
      }
      return envelope.data;
    } catch (error) {
      const isAbortError = error instanceof DOMException && error.name === "AbortError";
      if (attempt === maxAttempts - 1 || isAbortError) {
        throw error;
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
  }
  throw new Error(`Backend call to /ai/${path} failed.`);
}

function tryParseJson(candidate: string): unknown | null {
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function extractBalancedJsonCandidate(text: string): string | null {
  const starts: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{" || ch === "[") starts.push(i);
  }

  for (const start of starts) {
    const open = text[start];
    const close = open === "{" ? "}" : "]";

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (ch === open) depth++;
      if (ch === close) depth--;

      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function parseJsonPayload(raw: string): unknown {
  const trimmed = raw.trim();

  const direct = tryParseJson(trimmed);
  if (direct !== null) return direct;

  const fencedMatches = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/gi) ?? [];
  for (const block of fencedMatches) {
    const inner = block.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
    const parsed = tryParseJson(inner);
    if (parsed !== null) return parsed;
  }

  const balanced = extractBalancedJsonCandidate(trimmed);
  if (balanced) {
    const parsed = tryParseJson(balanced);
    if (parsed !== null) return parsed;
  }

  const preview = trimmed.slice(0, 160).replace(/\s+/g, " ");
  throw new Error(`AI did not return valid JSON. Preview: ${preview}`);
}

export function detectThinkingStage(context: string) {
  if (context.match(/drop|problem|issue|pain/i)) return "problem";
  if (context.match(/we will|build|solution|feature/i)) return "solution";
  if (context.match(/metric|conversion|rate|kpi/i)) return "metrics";
  return "exploration";
}

export const generateInlineSuggestion = async (
  context: HierarchicalContext,
  learning?: InlineLearningProfile
): Promise<InlineSuggestionPayload> => {
  const acceptedExamples = (learning?.accepted ?? []).slice(-3).join(" | ") || "none";
  const dismissedExamples = (learning?.dismissed ?? []).slice(-3).join(" | ") || "none";
  const stage = detectThinkingStage([context.documentIntent, context.section, context.block, context.sentence].filter(Boolean).join(" "));

  const prompt = `You are a senior product manager.

Rules:
* Do NOT give generic advice
* Challenge assumptions
* Identify missing thinking
* Be sharp and concise

User is currently in: ${stage} stage.

Progress state:
- hasProblem: ${context.documentIntent === "retention" ? "true" : "false"}
- hasSolution: ${context.documentIntent === "onboarding" ? "true" : "false"}
- hasMetrics: ${context.documentIntent === "metrics" ? "true" : "false"}

Preference signals:
- Previously accepted: ${acceptedExamples}
- Previously dismissed: ${dismissedExamples}

Based on this, provide the next logical steps.

Return JSON:
{
  "stage": "${stage}",
  "next_steps": ["...", "..."]
}

Rules:
* Be concise
* Avoid generic advice
* Focus on progression
* Return 2-3 steps max
* Do not include markdown`;

  const raw = await callAI(
    prompt,
    [
      `Document intent: ${context.documentIntent}`,
      `Section: ${context.section || "none"}`,
      `Active sentence: ${context.sentence || "none"}`,
      `Active block: ${context.block || "none"}`,
    ].join("\n")
  );
  const parsed = parseJsonPayload(raw) as Partial<InlineSuggestionPayload>;
  const allowedStages: InlineSuggestionPayload["stage"][] = ["problem", "solution", "metrics", "exploration"];
  const parsedStage = allowedStages.includes(parsed.stage as InlineSuggestionPayload["stage"]) ? parsed.stage as InlineSuggestionPayload["stage"] : stage;

  const nextSteps = Array.isArray(parsed.next_steps)
    ? parsed.next_steps
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .slice(0, 3)
    : [];

  if (nextSteps.length > 0) {
    return { stage: parsedStage, next_steps: nextSteps, suggestions: nextSteps };
  }

  return {
    stage: parsedStage,
    next_steps: [
      parsedStage === "problem" ? "What problem are you solving?" : "What is the user decision you are guiding?",
      parsedStage === "metrics" ? "Do you have a baseline and target metric?" : "How will you know this matters?",
      parsedStage === "solution" ? "What assumption needs validation first?" : "What is the next concrete product decision?",
    ],
    suggestions: [
      parsedStage === "problem" ? "What problem are you solving?" : "What is the user decision you are guiding?",
      parsedStage === "metrics" ? "Do you have a baseline and target metric?" : "How will you know this matters?",
      parsedStage === "solution" ? "What assumption needs validation first?" : "What is the next concrete product decision?",
    ],
  };
};

export const generateNextSteps = async (context: string, progress?: ProgressState): Promise<InlineSuggestionPayload> => {
  const stage = detectThinkingStage(context);
  const progressHint = progress
    ? `\nProgress history:\n- hasProblem: ${progress.hasProblem}\n- hasSolution: ${progress.hasSolution}\n- hasMetrics: ${progress.hasMetrics}\n`
    : "";

  const prompt = `
You are a senior product manager guiding structured thinking.

User is currently in: ${stage} stage.
${progressHint}
Based on this, provide the next logical steps.

Rules:
* Be concise
* Avoid generic advice
* Focus on progression

Return JSON:
{
  "stage": "${stage}",
  "next_steps": ["...", "..."]
}
`;

  const res = await callAI(prompt, context);
  const parsed = parseJsonPayload(res) as Partial<InlineSuggestionPayload>;
  const next_steps = Array.isArray(parsed.next_steps)
    ? parsed.next_steps.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 3)
    : [];

  return {
    stage: parsed.stage && ["problem", "solution", "metrics", "exploration"].includes(parsed.stage) ? parsed.stage as InlineSuggestionPayload["stage"] : stage,
    next_steps: next_steps.length > 0 ? next_steps : [
      stage === "problem" ? "What problem are you solving?" : "What is the next logical product question?",
      stage === "metrics" ? "What metric should change first?" : "How will you measure success?",
    ],
    suggestions: next_steps.length > 0 ? next_steps : [
      stage === "problem" ? "What problem are you solving?" : "What is the next logical product question?",
      stage === "metrics" ? "What metric should change first?" : "How will you measure success?",
    ],
  };
};

export const generateNextStepsWithSignals = async (
  context: string,
  entities: ExtractedEntities,
  gaps: ThinkingGap[],
  progress?: ProgressState
): Promise<InlineSuggestionPayload> => {
  const stage = detectThinkingStage(context);
  const prompt = `
You are a senior product manager.

Sentence:
${context}

Detected:
* Problem: ${entities.hasProblem}
* Metric: ${entities.hasMetric}
* Action: ${entities.hasAction}

Missing:
${gaps.join(", ") || "none"}

Progress:
* hasProblem: ${progress?.hasProblem ?? false}
* hasSolution: ${progress?.hasSolution ?? false}
* hasMetrics: ${progress?.hasMetrics ?? false}

Task:
Give sharp, non-generic next steps based on missing thinking.

Return JSON:
{
  "stage": "${stage}",
  "next_steps": ["...", "..."]
}
`;

  const res = await callAI(prompt, context);
  const parsed = parseJsonPayload(res) as Partial<InlineSuggestionPayload>;
  const next_steps = Array.isArray(parsed.next_steps)
    ? parsed.next_steps.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 3)
    : [];

  return {
    stage: parsed.stage && ["problem", "solution", "metrics", "exploration"].includes(parsed.stage) ? parsed.stage as InlineSuggestionPayload["stage"] : stage,
    next_steps: next_steps.length > 0 ? next_steps : [
      "What problem are you solving?",
      "How will you know it worked?",
    ],
    suggestions: next_steps.length > 0 ? next_steps : [
      "What problem are you solving?",
      "How will you know it worked?",
    ],
  };
};

interface ScoreDecisionResponse {
  impact?: unknown;
  effort?: unknown;
  confidence?: unknown;
  demand?: unknown;
  reasoning?: unknown;
  risks?: unknown;
  nextSteps?: unknown;
}

export const generateOpportunityScore = async (context: string): Promise<OpportunityScoreResult> => {
  const prompt = `
You are a senior product manager doing ruthless prioritization. Score this decision honestly. Inflated scores destroy trust — most real decisions land between 40 and 70 on the final 0-100 score, NOT 90-100. Do not be generous.

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

Be ruthlessly honest. If evidence is thin, confidence and demand should be low. Vague descriptions deserve low confidence. Big-sounding ideas with no validation deserve low impact.

Return ONLY this JSON, with integer values 1-10 for all four dimensions:
{
  "impact": 4,
  "effort": 6,
  "confidence": 3,
  "demand": 4,
  "reasoning": "One short paragraph defending these scores against the anchors above.",
  "risks": ["short risk", "short risk"],
  "nextSteps": ["short next step", "short next step"]
}
`;

  const res = await callAI(prompt, context);
  const parsed = parseJsonPayload(res) as ScoreDecisionResponse;

  const impact = clampScoreValue(Number(parsed.impact ?? 0));
  const effort = clampScoreValue(Number(parsed.effort ?? 0));
  const confidence = clampScoreValue(Number(parsed.confidence ?? 0));
  const demand = clampScoreValue(Number(parsed.demand ?? 0));

  const rawScore = effort === 0 ? 0 : Math.min(100, Math.round(((impact * demand * confidence) / effort) * 10));

  return {
    impact,
    effort,
    confidence,
    demand,
    score: rawScore,
    reasoning: typeof parsed.reasoning === "string" && parsed.reasoning.trim().length > 0
      ? parsed.reasoning.trim()
      : "The idea lacks enough signal to justify a higher score.",
  };
};

const INSIGHT_CATEGORIES = ["pain-point", "opportunity", "user-segment", "pattern"] as const;
type InsightCategory = (typeof INSIGHT_CATEGORIES)[number];

interface NormalizedInsight {
  title: string;
  description: string;
  category: InsightCategory;
}

function normalizeInsight(raw: unknown): NormalizedInsight | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as { title?: unknown; description?: unknown; category?: unknown };

  const title = typeof item.title === "string" ? item.title.trim() : "";
  const description = typeof item.description === "string" ? item.description.trim() : "";
  if (!title || !description) return null;

  const category = typeof item.category === "string" && (INSIGHT_CATEGORIES as readonly string[]).includes(item.category)
    ? (item.category as InsightCategory)
    : "pattern";

  return { title, description, category };
}

export const extractInsightsAction = async (userId: string, docContent: unknown, sourceDocId?: string) => {
  const context = tipTapToText(docContent);
  if (!context.trim()) return [];

  const data = await callBackendRoute<{ insights: NormalizedInsight[]; tokensUsed: number }>(
    "insights/generate",
    { content: context, noteId: sourceDocId ?? "default" }
  );

  const insights = (data.insights ?? [])
    .map(normalizeInsight)
    .filter((entry): entry is NormalizedInsight => entry !== null);

  for (const insight of insights) {
    await saveInsight(userId, { ...insight, sourceDocId });
  }

  return insights;
};

export const generatePRDAction = async (userId: string, docContent: unknown, title: string, sourceDocId?: string) => {
  const notes = tipTapToText(docContent);
  if (!notes.trim()) {
    throw new Error("Cannot generate a PRD from empty notes.");
  }

  const data = await callBackendRoute<{ content: string; tokensUsed: number }>(
    "prd/generate",
    { title, notes, decisions: "" }
  );

  await savePRD(userId, {
    title: `PRD: ${title}`,
    content: data.content,
    status: "draft",
    sourceDocId,
  });
  return data.content;
};

const TASK_PRIORITIES = ["high", "medium", "low"] as const;
type TaskPriorityValue = (typeof TASK_PRIORITIES)[number];

interface NormalizedSuggestedTask {
  title: string;
  priority: TaskPriorityValue;
  milestone?: string;
}

function normalizeSuggestedTask(raw: unknown): NormalizedSuggestedTask | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as { title?: unknown; priority?: unknown; milestone?: unknown };

  const title = typeof item.title === "string" ? item.title.trim() : "";
  if (!title) return null;

  const priority = typeof item.priority === "string" && (TASK_PRIORITIES as readonly string[]).includes(item.priority)
    ? (item.priority as TaskPriorityValue)
    : "medium";

  const milestone = typeof item.milestone === "string" && item.milestone.trim().length > 0
    ? item.milestone.trim()
    : undefined;

  return { title, priority, milestone };
}

export const suggestTasksAction = async (userId: string, docContent: unknown, sourceDocId?: string) => {
  const context = tipTapToText(docContent);
  if (!context.trim()) return [];

  const data = await callBackendRoute<{ tasks: NormalizedSuggestedTask[]; tokensUsed: number }>(
    "tasks/suggest",
    { prdContent: context }
  );

  const tasks = (data.tasks ?? [])
    .map(normalizeSuggestedTask)
    .filter((entry): entry is NormalizedSuggestedTask => entry !== null);

  for (const task of tasks) {
    await saveTask(userId, {
      ...task,
      status: "todo",
      sourceDocId,
    });
  }

  return tasks;
};

export const strategicGuidanceAction = async (docContent: unknown): Promise<StrategicGuidance> => {
  const context = tipTapToText(docContent);
  const prompt = `Analyze this product context and provide strategic guidance. Return JSON with:
{
  "theme": "One sentence strategic focus (e.g., 'Prioritize retention before expansion')",
  "rationale": "Why this is the right focus (1-2 sentences)",
  "gaps": ["Critical missing piece 1", "Critical missing piece 2"],
  "recommendation": "Top strategic priority (1 sentence)"
}`;

  const result = await callAI(prompt, context);
  try {
    const guidance = parseJsonPayload(result) as StrategicGuidance;
    return {
      theme: guidance.theme || "No clear theme identified",
      rationale: guidance.rationale || "Analyze your current priorities",
      gaps: Array.isArray(guidance.gaps) ? guidance.gaps.slice(0, 3) : [],
      recommendation: guidance.recommendation || "Document your product vision"
    };
  } catch (e) {
    console.error("[strategicGuidanceAction] Failed to parse guidance JSON:", e);
    throw e;
  }
};

export const suggestDirectionAction = async (userId: string, docContent: unknown): Promise<DecisionSuggestion[]> => {
  const context = tipTapToText(docContent);
  const prompt = `Based on these product notes, suggest what we should build next. 
  Extract 3 potential features/directions. 
  Format as a JSON array of objects with keys: 
  - title (The feature name)
  - justification (Why we should build it, data-backed)
  - priority (high, medium, low)
  - impact (1-10 score)
  - effort (1-10 score)
  - userStory (The primary user story for this feature)
  - tradeoffs (Trade-offs or limitations of this approach, e.g. "High effort but future-proof" or "Quick win but limited scope")`;
  
  const result = await callAI(prompt, context);
  try {
    const suggestions = parseJsonPayload(result);
    if (!Array.isArray(suggestions)) {
      throw new Error("Direction response was not an array.");
    }
    
    return suggestions as DecisionSuggestion[];
  } catch (e) {
    console.error("[suggestDirectionAction] Failed to parse decision JSON:", e);
    throw e;
  }
};

export const processEditorAction = async (userId: string, selectedText: string, action: 'improve' | 'expand' | 'challenge') => {
  const prompts = {
    improve: "Improve this text for clarity, flow, and professional product tone. Keep the same general meaning but make it sound like a senior PM wrote it.",
    expand: "Expand on this product idea. Add more detail, specific examples, or technical considerations that would help a team understand how to build it.",
    challenge: "Critically analyze this idea. Identify potential risks, edge cases, or reasons why it might fail. Be constructive but direct."
  };

  const prompt = `Action: ${prompts[action]}\n\nText to process:\n${selectedText}`;
  
  // Reuse callAI for consistency
  const result = await callAI(prompt, "You are a senior PM assistant assisting with inline editor improvements.");
  return result;
};

export const analyzeThinkingSignalsAction = async (contextText: string): Promise<ProactiveThinkingSignals> => {
  const boundedContext = contextText.length > 6000 ? contextText.slice(-6000) : contextText;
  const prompt = `Analyze the current product writing and return JSON only with this exact shape:
{
  "insights": [{ "title": string, "description": string, "category": "pain-point" | "opportunity" | "pattern" }],
  "suggestions": [{ "text": string, "confidence": number, "why": string }],
  "challenges": [{ "text": string, "confidence": number, "why": string }],
  "decisions": [{ "text": string, "confidence": number, "why": string }]
}

Rules:
- insights: max 3 items
- suggestions: max 3 items (feature ideas), each short and actionable
- challenges: max 2 items, direct but constructive
- decisions: max 2 items (strategic feature directions user should consider), low confidence (exploratory)
- confidence must be 1-10 (decisions typically 4-7 range)
- why must be a brief reason (max 100 chars)
- If context is weak, return empty arrays`;

  const raw = await callAI(prompt, boundedContext);
  const parsed = parseJsonPayload(raw);

  const normalizeHints = (input: unknown): ProactiveHint[] => {
    if (!Array.isArray(input)) return [];

    return input
      .map((item): ProactiveHint | null => {
        if (typeof item === "string") {
          return { text: item, confidence: 6, why: "Derived from recent context." };
        }

        if (!item || typeof item !== "object") return null;

        const maybe = item as { text?: unknown; confidence?: unknown; why?: unknown };
        const text = typeof maybe.text === "string" ? maybe.text.trim() : "";
        if (!text) return null;

        const rawConfidence = typeof maybe.confidence === "number" ? maybe.confidence : 6;
        const confidence = Math.max(1, Math.min(10, Math.round(rawConfidence)));
        const why = typeof maybe.why === "string" && maybe.why.trim().length > 0
          ? maybe.why.trim()
          : "Derived from recent context.";

        return { text, confidence, why };
      })
      .filter((item): item is ProactiveHint => item !== null);
  };

  return {
    insights: Array.isArray((parsed as { insights?: unknown[] })?.insights)
      ? ((parsed as { insights?: ProactiveInsight[] }).insights ?? []).slice(0, 3)
      : [],
    suggestions: normalizeHints((parsed as { suggestions?: unknown }).suggestions).slice(0, 3),
    challenges: normalizeHints((parsed as { challenges?: unknown }).challenges).slice(0, 2),
     decisions: normalizeHints((parsed as { decisions?: unknown }).decisions).slice(0, 2),
  };
};

export const generateFeatureFromInsightAction = async (insight: ProactiveInsight): Promise<string> => {
  const prompt = `Convert this insight into one concrete product feature proposal.

Insight Title: ${insight.title}
Insight Category: ${insight.category}
Insight Description: ${insight.description}

Return markdown with:
- Feature Name
- Problem it solves
- Scope (MVP)
- Primary user story
- Success metric`;

  return callAI(prompt, `${insight.title}\n${insight.description}`);
};

export const generatePRDFromDecisionAction = async (decision: DecisionSuggestion): Promise<string> => {
  const prompt = `Generate a professional PRD (Product Requirements Document) based on this strategic decision.

Feature: ${decision.title}
Justification: ${decision.justification}
User Story: ${decision.userStory}
Priority: ${decision.priority}
Estimated Impact: ${decision.impact}/10
Estimated Effort: ${decision.effort}/10
Trade-offs: ${decision.tradeoffs}

Return clean Markdown with these sections:
1. Overview (The feature in 1-2 sentences)
2. Problem Statement (What problem does this solve?)
3. User Story (As a... I want... so that...)
4. Goals (What success looks like)
5. Acceptance Criteria (How to know when it's done)
6. Technical Considerations (Any technical challenges or dependencies)
7. Trade-offs & Risks (Implementation trade-offs and potential risks)
8. Success Metrics (How to measure impact)

Be concise, specific, and actionable.`;

  const context = `${decision.title}\n${decision.justification}\n${decision.userStory}`;
  return callAI(prompt, context);
};

// --- PHASE 4: EXECUTION LAYER ---

export interface TaskWithMetadata {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  effort: number;
  category: string;
  prdSection: string;
  milestone?: string;
}

export interface TaskDependency {
  taskIndex: number;
  dependsOnIndices: number[];
  reason: string;
}

interface TaskDependencyPayload {
  taskIndex?: unknown;
  dependsOnIndices?: unknown;
  reason?: unknown;
}

interface TaskPriorityPayload {
  index?: unknown;
  priority?: unknown;
  reasoning?: unknown;
}

export const generateTasksFromPRDAction = async (prdContent: string, prdTitle?: string): Promise<TaskWithMetadata[]> => {
  const prompt = `Convert this PRD into 5-7 concrete, actionable implementation tasks.

PRD Title:
${prdTitle ?? "Untitled PRD"}

Instructions:
- Each task must be specific and measurable
- Include details about implementation approach
- Assign a category: backend, frontend, design, qa, integration, or devops
- For each task, identify which PRD section it relates to
- Estimate effort on 1-10 scale

Output ONLY a JSON array with this structure:
[
  {
    "title": "Task name",
    "description": "Detailed what to do and how",
    "priority": "high|medium|low",
    "effort": 1-10,
    "category": "backend|frontend|design|qa|integration|devops",
    "prdSection": "Which PRD section this implements",
    "milestone": "Optional milestone name"
  }
]`;

  const result = await callAI(prompt, prdContent);
  try {
    const tasks = parseJsonPayload(result);
    if (!Array.isArray(tasks)) {
      throw new Error("Tasks response was not an array.");
    }
    
    return tasks.map(t => {
      const rawEffort = Number(t.effort);
      const effort = Number.isFinite(rawEffort) ? Math.min(10, Math.max(1, Math.round(rawEffort))) : 5;
      return {
        title: t.title || "Untitled Task",
        description: t.description || t.title || "",
        priority: (["high", "medium", "low"].includes(t.priority) ? t.priority : "medium") as "high" | "medium" | "low",
        effort,
        category: t.category || "general",
        prdSection: t.prdSection || "General",
        milestone: t.milestone,
      };
    }) as TaskWithMetadata[];
  } catch (e) {
    console.error("[generateTasksFromPRDAction] Failed to parse tasks JSON:", e);
    throw e;
  }
};

export const analyzeDependenciesAction = async (tasks: TaskWithMetadata[], docContext: unknown): Promise<TaskDependency[]> => {
  const taskSummary = tasks.map((t, i) => `${i}. ${t.title} [${t.category}]`).join("\n");
  const contextText = typeof docContext === "string" ? docContext : JSON.stringify(docContext ?? "");
  
  const prompt = `Analyze these implementation tasks and identify dependencies.

Tasks:
${taskSummary}

Product Context:
${contextText}

Return JSON array showing which tasks depend on which:
[
  {
    "taskIndex": 0,
    "dependsOnIndices": [1, 2],
    "reason": "Why this task depends on those"
  }
]

Rules:
- Only include tasks that have dependencies
- dependsOnIndices lists 0-based indices of tasks this one depends on
- reason must be brief (max 100 chars)
- For example: frontend work often depends on backend API being ready
- Use your judgment to infer realistic dependencies from task descriptions`;

  const result = await callAI(prompt, `${taskSummary}\n\n${contextText}`);
  try {
    const dependencies = parseJsonPayload(result);
    if (!Array.isArray(dependencies)) {
      return [];
    }
    
    return dependencies.map((d: TaskDependencyPayload) => ({
      taskIndex: Number.parseInt(String(d.taskIndex ?? 0), 10) || 0,
      dependsOnIndices: Array.isArray(d.dependsOnIndices)
        ? d.dependsOnIndices.map((index: unknown) => Number.parseInt(String(index), 10))
        : [],
      reason: typeof d.reason === "string" ? d.reason : "Task dependency"
    })) as TaskDependency[];
  } catch (e) {
    console.error("[analyzeDependenciesAction] Failed to parse dependencies:", e);
    return [];
  }
};

export const intelligentPrioritizeAction = async (tasks: TaskWithMetadata[], dependencies: TaskDependency[]): Promise<TaskWithMetadata[]> => {
  const taskSummary = tasks.map((t, i) => {
    const deps = dependencies.find(d => d.taskIndex === i)?.dependsOnIndices || [];
    return `${i}. ${t.title} [${t.priority}, effort:${t.effort}, blocking: ${deps.length > 0 ? 'YES' : 'NO'}]`;
  }).join("\n");
  
  const prompt = `Re-evaluate task priorities based on dependencies and effort.

Tasks:
${taskSummary}

Dependency Context:
- Tasks that block others should have higher priority
- High-effort blocking tasks should be done first
- Quick wins (low effort, high-blocking) should be prioritized
- Balance between starting quickly and unblocking others

Return JSON with revised priorities:
[
  {
    "index": 0,
    "priority": "high|medium|low",
    "reasoning": "Why this priority"
  }
]`;

  const result = await callAI(prompt, taskSummary);
  try {
    const reprioritized = parseJsonPayload(result);
    if (!Array.isArray(reprioritized)) {
      return tasks;
    }
    
    const updatedTasks = [...tasks];
    for (const item of reprioritized as TaskPriorityPayload[]) {
      const idx = Number.parseInt(String(item.index ?? 0), 10);
      if (idx >= 0 && idx < updatedTasks.length && ["high", "medium", "low"].includes(String(item.priority))) {
        updatedTasks[idx] = {
          ...updatedTasks[idx],
          priority: item.priority as "high" | "medium" | "low"
        };
      }
    }
    
    return updatedTasks;
  } catch (e) {
    console.error("[intelligentPrioritizeAction] Failed to re-prioritize:", e);
    return tasks;
  }
};

interface SlackImportResult {
  content: string;
  metadata: {
    source: "slack";
    teamId: string;
    channelId: string;
    messageCount: number;
    truncated?: boolean;
  };
}

// Wrap raw text into the minimal TipTap document shape so it survives both the
// editor renderer and tipTapToText() in extractInsightsAction.
function textToTipTap(text: string) {
  const paragraphs = text.split(/\n+/).filter((line) => line.length > 0);
  return {
    type: "doc",
    content: paragraphs.map((line) => ({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    })),
  };
}

export const importFromSlack = async (
  userId: string,
  teamId: string,
  channelId: string,
  channelName?: string
): Promise<{ docId: string; insightsCount: number; messageCount: number }> => {
  const maxAttempts = 2;
  let result: SlackImportResult | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const token = await getAuthToken(attempt > 0);
    const response = await fetch("/api/import/slack", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ teamId, channelId }),
    });

    if (response.status === 401 && attempt === 0) continue;

    const envelope = (await response.json().catch(() => null)) as
      | BackendEnvelope<SlackImportResult>
      | null;
    if (!response.ok || !envelope?.ok || envelope.data === undefined) {
      const message = envelope?.error || `Slack import failed (${response.status})`;
      throw new Error(message);
    }
    result = envelope.data;
    break;
  }

  if (!result) throw new Error("Slack import failed.");

  const title = channelName ? `Slack #${channelName}` : `Slack channel ${channelId}`;
  const docContent = textToTipTap(result.content);

  const docId = await createDocument(userId, title);
  await saveDocument(userId, docId, { title, content: docContent });

  // Refresh the sidebar's document list and select the new doc so the user
  // sees it after we land them on the insights view.
  const docs = await getUserDocuments(userId);
  const store = useAppStore.getState();
  store.setDocuments(docs);
  store.setCurrentDocId(docId);

  const insights = await extractInsightsAction(userId, docContent, docId);

  return {
    docId,
    insightsCount: insights.length,
    messageCount: result.metadata.messageCount,
  };
};

export const submitOutcomeFeedback = async (
  decisionId: string,
  feedback: OutcomeFeedback,
  currentScore: OpportunityScoreState
): Promise<{ updatedScore: OpportunityScoreState; insight: string }> => {
  const adjusted = updateConfidenceScore(currentScore, feedback.success);
  const recalculated = calculateScore(adjusted);
  const updatedScore: OpportunityScoreState = { ...adjusted, score: recalculated };

  await persistOutcomeFeedback(feedback, updatedScore);

  const insight = await generateLearningInsight(decisionId, feedback.expected, feedback.actual);

  return { updatedScore, insight };
};
