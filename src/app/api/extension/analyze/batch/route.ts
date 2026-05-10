import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items array is required" }, { status: 400 });
    }

    if (items.length > 50) {
      return NextResponse.json({ error: "Maximum 50 items per batch" }, { status: 400 });
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const jobIds  = items.map((_, i) => `job_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`);

    return NextResponse.json({ batchId, jobIds, status: "queued" }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
