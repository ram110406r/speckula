import { createGroq } from '@ai-sdk/groq';
import { streamText } from 'ai';

// Initialize Groq provider
const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

// Set to edge runtime for faster streaming
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const result = await streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: `You are Buildcase AI, a senior product management assistant. 
      Your goal is to help product managers discover insights, define product strategy, and build PRDs.
      Be concise, structured, and professional. Use markdown for all responses.
      Focus on product thinking: pain points, user segments, and business impact.`,
      messages,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('AI Error:', error);
    return new Response(JSON.stringify({ error: "Intelligence Engine encountered an error." }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
