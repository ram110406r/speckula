import { auth } from "../firebase/config";

const REQUEST_TIMEOUT_MS = 30000;

export async function callAI(prompt: string, context: string) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Authentication required.");
  }

  const token = await user.getIdToken();
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
            content: "You are an expert Product Manager. Use the provided product notes to fulfill the user request. Respond ONLY with the requested data in the specified format.",
          },
          {
            role: "user",
            content: `Product Notes:\n${context}\n\nTask: ${prompt}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`AI call failed (${response.status}): ${errorBody || response.statusText}`);
    }

    return response.text();
  } finally {
    window.clearTimeout(timeoutId);
  }
}
