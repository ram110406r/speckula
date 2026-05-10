import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, extractUidFromToken } from "@/lib/firebase/serverAuth";
import { firestoreGet } from "@/lib/firebase/firestoreRest";

const EXT_VERSION = "1.0.0";

const DEFAULT_PREFS = {
  autoSave: true,
  showNotifications: true,
  captureOnShortcut: false,
  defaultTags: [] as string[],
  theme: "auto" as const,
};

export async function GET(req: NextRequest) {
  try {
    const token = extractBearerToken(req.headers.get("Authorization"));
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const uid = extractUidFromToken(token);
    if (!uid) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Fetch preferences from Firestore (scoped to user via their own token)
    const prefsDoc = await firestoreGet(
      `users/${uid}/settings/extensionPreferences`,
      token
    );

    const rawPrefs: Record<string, unknown> = prefsDoc ?? {};
    const preferences = { ...DEFAULT_PREFS, ...rawPrefs };

    const activeWorkspaceId = typeof rawPrefs.activeWorkspaceId === "string"
      ? rawPrefs.activeWorkspaceId
      : undefined;

    // Build workspace list — primary workspace derived from uid, others from Firestore if present
    const workspaces = [
      {
        workspaceId: activeWorkspaceId ?? `ws_${uid.slice(0, 8)}`,
        name: typeof prefsDoc?.workspaceName === "string" ? prefsDoc.workspaceName : "My Workspace",
        role: "admin" as const,
        isPrimary: true,
      },
    ];

    // Rate limit stubs — replace with real DB counters in production
    const rateLimitStatus = {
      capturesThisMonth: 0,
      monthlyQuota: 100,
      capturesThisMinute: 0,
      minuteQuota: 10,
      resetAt: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString(),
    };

    return NextResponse.json({
      userId: uid,
      workspaceId: activeWorkspaceId ?? `ws_${uid.slice(0, 8)}`,
      workspaces,
      preferences: {
        autoSave:            Boolean(preferences.autoSave),
        showNotifications:   Boolean(preferences.showNotifications),
        captureOnShortcut:   Boolean(preferences.captureOnShortcut),
        defaultTags:         Array.isArray(preferences.defaultTags) ? preferences.defaultTags : [],
        theme:               typeof preferences.theme === "string" ? preferences.theme : "auto",
      },
      rateLimitStatus,
      extensionVersion: EXT_VERSION,
      hasUpdateAvailable: false,
      cachedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
