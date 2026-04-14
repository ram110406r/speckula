import { auth } from "../firebase/config";
import { saveInsight, savePRD, saveTask } from "../firebase/db";

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

async function getAuthToken() {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Authentication required.");
  }

  return currentUser.getIdToken();
}

async function callAI(prompt: string, context: string) {
  const token = await getAuthToken();
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
  });

  if (!response.ok) throw new Error("AI call failed");
  
  // We handle non-streaming for actions to get a clean structured result
  const raw = await response.text();
  return raw;
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

export const extractInsightsAction = async (userId: string, docContent: unknown) => {
  const context = tipTapToText(docContent);
  const prompt = `Extract exactly 4 key product insights. Format as a JSON array of objects with keys: title, description, and category (one of: pain-point, opportunity, user-segment, pattern).`;
  
  const result = await callAI(prompt, context);
  try {
    const insights = parseJsonPayload(result);
    if (!Array.isArray(insights)) {
      throw new Error("Insights response was not an array.");
    }
    
    for (const insight of insights) {
      await saveInsight(userId, insight);
    }
    return insights;
  } catch (e) {
    console.error("Failed to parse insights JSON:", e);
    throw e;
  }
};

export const generatePRDAction = async (userId: string, docContent: unknown, title: string) => {
  const context = tipTapToText(docContent);
  const prompt = `Generate a professional, detailed PRD based on these notes. 
  The PRD MUST include the following sections:
  1. Problem Statement (Deep dive into current friction)
  2. Target Users (Primary/Secondary segments)
  3. Feature Breakdown (Core capabilities)
  4. User Stories (As a... I want to... so that...)
  5. Edge Cases (Potential pitfalls)
  6. Success Metrics (KPIs to measure impact)
  
  Format in clean Markdown with professional headings.`;
  
  const content = await callAI(prompt, context);
  await savePRD(userId, {
    title: `PRD: ${title}`,
    content,
    status: "draft"
  });
  return content;
};

export const suggestTasksAction = async (userId: string, docContent: unknown) => {
  const context = tipTapToText(docContent);
  const prompt = `Suggest 5 concrete execution tasks. Format as a JSON array of objects with keys: title, priority (high, medium, low), milestone (short string).`;
  
  const result = await callAI(prompt, context);
  try {
    const tasks = parseJsonPayload(result);
    if (!Array.isArray(tasks)) {
      throw new Error("Tasks response was not an array.");
    }
    
    for (const task of tasks) {
      await saveTask(userId, {
        ...task,
        status: "todo"
      });
    }
    return tasks;
  } catch (e) {
    console.error("Failed to parse tasks JSON:", e);
    throw e;
  }
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
