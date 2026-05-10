import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { content, pageType, selectedText } = body;

    if (!content || !pageType) {
      return NextResponse.json({ error: "content and pageType are required" }, { status: 400 });
    }

    // Generate a unique job ID and return immediately — actual processing
    // would be handled by an async worker writing to Firestore.
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    return NextResponse.json({ jobId, status: "queued" }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
