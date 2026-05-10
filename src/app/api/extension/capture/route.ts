import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, extractUidFromToken } from "@/lib/firebase/serverAuth";
import { firestoreGet, firestoreSet } from "@/lib/firebase/firestoreRest";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24h dedup window

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
    const {
      insight,
      workspaceId,
      sourceUrl,
      pageType,
      capturedAt,
      idempotencyKey,
    } = body;

    if (!insight) {
      return NextResponse.json({ error: "insight is required" }, { status: 400 });
    }

    // ── Idempotency check ────────────────────────────────────────────────────
    if (idempotencyKey) {
      const existing = await firestoreGet(
        `users/${uid}/captureKeys/${encodeURIComponent(idempotencyKey)}`,
        token
      );
      if (existing && typeof existing.signalId === "string") {
        // Already captured — return the original signalId
        return NextResponse.json({
          signalId: existing.signalId,
          status: "duplicate",
          conflictDetected: false,
        });
      }
    }

    // ── Conflict detection: same URL captured in the last 5 minutes ──────────
    let conflictDetected = false;
    let conflictDetails: { signalId: string; capturedAt: string } | undefined;

    if (sourceUrl) {
      const recentKey = `users/${uid}/captureKeys/url__${encodeURIComponent(sourceUrl).slice(0, 200)}`;
      const recent = await firestoreGet(recentKey, token);
      if (recent && typeof recent.capturedAt === "string") {
        const recentTs = new Date(recent.capturedAt).getTime();
        if (Date.now() - recentTs < 5 * 60 * 1000) {
          conflictDetected = true;
          conflictDetails = {
            signalId: String(recent.signalId ?? ""),
            capturedAt: String(recent.capturedAt),
          };
        }
      }
    }

    // ── Persist insight to Firestore ─────────────────────────────────────────
    const signalId = `sig_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();

    const insightDoc = {
      id: signalId,
      category: insight.type === "market_signal" ? "opportunity" : "pattern",
      title: insight.summary ?? "Captured signal",
      description: Array.isArray(insight.evidence) ? insight.evidence.join(" ") : "",
      sourceUrl: sourceUrl ?? insight.sourceUrl ?? "",
      sourceDocId: null,
      userId: uid,
      workspaceId: workspaceId ?? null,
      pageType: pageType ?? null,
      capturedAt: capturedAt ?? now,
      tags: Array.isArray(insight.tags) ? insight.tags : [],
      confidence: typeof insight.confidence === "number" ? insight.confidence : 0,
      capturedVia: "extension",
      createdAt: now,
    };

    await firestoreSet(`users/${uid}/insights/${signalId}`, insightDoc, token, false);

    // Store idempotency key
    if (idempotencyKey) {
      await firestoreSet(
        `users/${uid}/captureKeys/${encodeURIComponent(idempotencyKey)}`,
        { signalId, capturedAt: now, expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS).toISOString() },
        token,
        false
      );
    }

    // Store URL-based dedup key
    if (sourceUrl) {
      const urlKey = `users/${uid}/captureKeys/url__${encodeURIComponent(sourceUrl).slice(0, 200)}`;
      await firestoreSet(urlKey, { signalId, capturedAt: now }, token, false);
    }

    return NextResponse.json(
      {
        signalId,
        status: "saved",
        conflictDetected,
        ...(conflictDetails ? { conflictDetails } : {}),
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
