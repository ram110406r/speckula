import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, extractUidFromToken } from "@/lib/firebase/serverAuth";

const VALID_EVENTS = new Set([
  "analysis_started",
  "analysis_completed",
  "error_occurred",
  "offline_sync",
  "capture_saved",
  "batch_started",
  "batch_completed",
  "settings_changed",
  "extension_installed",
  "extension_updated",
]);

export async function POST(req: NextRequest) {
  try {
    const token = extractBearerToken(req.headers.get("Authorization"));
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const uid = extractUidFromToken(token);
    if (!uid) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await req.json();
    const { event, properties = {} } = body;

    if (!event || typeof event !== "string") {
      return NextResponse.json({ error: "event is required" }, { status: 400 });
    }

    if (!VALID_EVENTS.has(event)) {
      // Accept but ignore unknown events — don't error on new extension versions
      return NextResponse.json({ status: "ignored", reason: "unknown_event" });
    }

    // In production: write to an analytics sink (BigQuery, PostHog, etc.)
    // For now: log server-side and acknowledge
    console.info(`[extension-analytics] uid=${uid} event=${event}`, properties);

    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
