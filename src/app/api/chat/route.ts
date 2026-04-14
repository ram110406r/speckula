import { createGroq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { createRemoteJWKSet, jwtVerify } from 'jose';

// Initialize Groq provider
const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const firebaseJwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

async function verifyFirebaseToken(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing authorization token.");
  }

  if (!firebaseProjectId) {
    throw new Error("Missing Firebase project configuration.");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const { payload } = await jwtVerify(token, firebaseJwks, {
    issuer: `https://securetoken.google.com/${firebaseProjectId}`,
    audience: firebaseProjectId,
  });

  if (!payload.sub) {
    throw new Error("Invalid Firebase token.");
  }

  return payload;
}

// Remove edge runtime — the WASM Next.js build doesn't handle it properly
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    await verifyFirebaseToken(req.headers.get("authorization"));
    const { messages } = await req.json();

    const result = streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: `You are Buildcase AI, a senior product management assistant. 
      Your goal is to help product managers discover insights, define product strategy, and build PRDs.
      Be concise, structured, and professional. Use markdown for all responses.
      Focus on product thinking: pain points, user segments, and business impact.`,
      messages,
    });

    // Stream back as plain text for compatibility
    return result.toTextStreamResponse({
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('AI Error:', error);
    return new Response(JSON.stringify({ error: "Intelligence Engine encountered an error." }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
