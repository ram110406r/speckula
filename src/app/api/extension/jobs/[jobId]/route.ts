import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = params;
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  // In production this would read from Firestore / Redis.
  // Returning a stub completed response so the extension can poll successfully.
  return NextResponse.json({
    jobId,
    status: "completed",
    insight: {
      type: "competitive_intelligence",
      summary: "Page analysed successfully.",
      evidence: [],
      tags: [],
      confidence: 0.85,
    },
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ jobId: params.jobId, status: "cancelled" });
}
