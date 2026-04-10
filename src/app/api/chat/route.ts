import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1]?.content || "";
    
    const text = `[MOCK AI]\nI got: "${lastMessage}".\nConfigure OPENAI_API_KEY in .env.local and use 'ai' SDK for real responses.`;
    
    // Simulate streaming data chunk expected by useChat hook
    return new Response(`0:"${text.replace(/\n/g, '\\n')}"\n`, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
