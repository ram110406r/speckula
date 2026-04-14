import { auth } from "../firebase/config";
import { saveInsight, savePRD, saveTask } from "../firebase/db";

/**
 * Simplistic helper to convert TipTap JSON to plain text for LLM context
 */
function tipTapToText(json: any): string {
  if (!json || !json.content) return "";
  let text = "";
  
  const processNodes = (nodes: any[]) => {
    nodes.forEach(node => {
      if (node.text) text += node.text;
      if (node.content) processNodes(node.content);
      if (node.type === 'paragraph' || node.type === 'heading') text += "\n";
    });
  };

  processNodes(json.content);
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

export const extractInsightsAction = async (userId: string, docContent: any) => {
  const context = tipTapToText(docContent);
  const prompt = `Extract exactly 4 key product insights. Format as a JSON array of objects with keys: title, description, and category (one of: pain-point, opportunity, user-segment, pattern).`;
  
  const result = await callAI(prompt, context);
  try {
    // Regex out code blocks if AI included them
    const jsonStr = result.replace(/```json|```/g, "").trim();
    const insights = JSON.parse(jsonStr);
    
    for (const insight of insights) {
      await saveInsight(userId, insight);
    }
    return insights;
  } catch (e) {
    console.error("Failed to parse insights JSON:", e);
    throw e;
  }
};

export const generatePRDAction = async (userId: string, docContent: any, title: string) => {
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

export const suggestTasksAction = async (userId: string, docContent: any) => {
  const context = tipTapToText(docContent);
  const prompt = `Suggest 5 concrete execution tasks. Format as a JSON array of objects with keys: title, priority (high, medium, low), milestone (short string).`;
  
  const result = await callAI(prompt, context);
  try {
    const jsonStr = result.replace(/```json|```/g, "").trim();
    const tasks = JSON.parse(jsonStr);
    
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

export const suggestDirectionAction = async (userId: string, docContent: any) => {
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
    const jsonStr = result.replace(/```json|```/g, "").trim();
    const suggestions = JSON.parse(jsonStr);
    
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
