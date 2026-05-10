import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, extractUidFromToken } from "@/lib/firebase/serverAuth";
import { firestoreSet } from "@/lib/firebase/firestoreRest";

const ALLOWED_KEYS = new Set([
  "autoSave",
  "showNotifications",
  "captureOnShortcut",
  "defaultTags",
  "theme",
  "activeWorkspaceId",
]);

export async function PUT(req: NextRequest) {
  try {
    const token = extractBearerToken(req.headers.get("Authorization"));
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const uid = extractUidFromToken(token);
    if (!uid) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body: Record<string, unknown> = await req.json();

    // Whitelist fields — never let unknown keys through
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (ALLOWED_KEYS.has(k)) patch[k] = v;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const ok = await firestoreSet(
      `users/${uid}/settings/extensionPreferences`,
      patch,
      token,
      true
    );

    if (!ok) {
      return NextResponse.json({ error: "Failed to save preferences" }, { status: 502 });
    }

    return NextResponse.json({ updated: Object.keys(patch), status: "ok" });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
