import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { insight, workspaceId, url } = body;

    if (!insight) {
      return NextResponse.json({ error: "insight is required" }, { status: 400 });
    }

    // In production: write insight to Firestore under the user's workspace.
    const signalId = `sig_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    return NextResponse.json({ signalId, status: "saved" }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
