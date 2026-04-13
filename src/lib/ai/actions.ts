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

async function callAI(prompt: string, context: string) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  const prompt = `Generate a professional, detailed PRD based on these notes. Format in clean Markdown.`;
  
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
