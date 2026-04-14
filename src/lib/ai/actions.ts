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

function parseJsonPayload(raw: string): unknown {
  const stripped = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(stripped);
}

export const extractInsightsAction = async (userId: string, docContent: unknown) => {
  const context = tipTapToText(docContent);
  const prompt = `Extract exactly 4 key product insights. Format as a JSON array of objects with keys: title, description, and category (one of: pain-point, opportunity, user-segment, pattern).`;
  
  const result = await callAI(prompt, context);
  try {
    const insights = parseJsonPayload(result);
    
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

export const suggestDirectionAction = async (userId: string, docContent: unknown) => {
  const context = tipTapToText(docContent);
  const prompt = `Based on these product notes, suggest what we should build next. 
  Extract 3 potential features/directions. 
  Format as a JSON array of objects with keys: 
  - title (The feature name)
  - justification (Why we should build it, data-backed)
  - priority (high, medium, low)
  - impact (1-10 score)
  - effort (1-10 score)
  - userStory (The primary user story for this feature)`;
  
  const result = await callAI(prompt, context);
  try {
    const suggestions = parseJsonPayload(result);
    
    // We'll return these for the view to handle or save as "Decisions" if needed
    // For MVP, we'll return them directly to the view state
    return suggestions;
  } catch (e) {
    console.error("Failed to parse decision JSON:", e);
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
  "challenges": [{ "text": string, "confidence": number, "why": string }]
}

Rules:
- insights: max 3 items
- suggestions: max 3 items, each short and actionable
- challenges: max 2 items, direct but constructive
- confidence must be 1-10
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
