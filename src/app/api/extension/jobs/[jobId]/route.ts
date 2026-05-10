import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, extractUidFromToken } from "@/lib/firebase/serverAuth";

// In production: proxy to a real job queue service (Fastify backend, Redis BullMQ, etc.)
// For now: return a plausible job status with progress and stage info.

const JOB_TTL_MS = 24 * 60 * 60 * 1000; // jobs expire after 24h

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const token = extractBearerToken(req.headers.get("Authorization"));
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const uid = extractUidFromToken(token);
  if (!uid) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { jobId } = await params;
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const now = Date.now();
  const expiresAt = new Date(now + JOB_TTL_MS).toISOString();

  return NextResponse.json({
    jobId,
    status: "completed",
    progress: 100,
    currentStage: "done",
    stages: [
      { name: "extracting",  label: "Extracting content", done: true  },
      { name: "processing",  label: "Processing with AI",  done: true  },
      { name: "classifying", label: "Classifying signal",  done: true  },
      { name: "done",        label: "Complete",             done: true  },
    ],
    insight: {
      id: jobId,
      type: "competitive_intelligence",
      summary: "Page analysed successfully.",
      evidence: [],
      tags: [],
      confidence: 0.85,
      sourceUrl: "",
      timestamp: new Date().toISOString(),
    },
    expiresAt,
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const token = extractBearerToken(req.headers.get("Authorization"));
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const uid = extractUidFromToken(token);
  if (!uid) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { jobId } = await params;
  return NextResponse.json({ jobId, status: "cancelled" });
}
