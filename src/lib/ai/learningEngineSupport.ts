import { auth } from "../firebase/config";

export async function callAI(prompt: string, context: string) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Authentication required.");
  }

  const token = await user.getIdToken();
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
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`AI call failed (${response.status}): ${errorBody || response.statusText}`);
  }

  return response.text();
}
