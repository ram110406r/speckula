import { auth, db } from "@/lib/firebase/config";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import type { OpportunityScoreBreakdown } from "./scoreEngine";

export interface OpportunityScoreHistoryEntry {
  timestamp: number;
  score: number;
  breakdown: OpportunityScoreBreakdown;
}

interface OpportunityScoreHistoryRecord {
  ideaId: string;
  history: OpportunityScoreHistoryEntry[];
}

const STORAGE_PREFIX = "Speckula-opportunity-score-v1";
const MAX_ENTRIES = 60;

const historyKey = (ideaId: string) => `${STORAGE_PREFIX}:${ideaId}`;

const writeLocal = (ideaId: string, history: OpportunityScoreHistoryEntry[]) => {
  if (typeof window === "undefined") return;
  try {
    const payload: OpportunityScoreHistoryRecord = { ideaId, history };
    window.localStorage.setItem(historyKey(ideaId), JSON.stringify(payload));
  } catch {
    /* quota — drop */
  }
};

const readLocal = (ideaId: string): OpportunityScoreHistoryEntry[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(historyKey(ideaId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<OpportunityScoreHistoryRecord>;
    return Array.isArray(parsed?.history) ? parsed.history : [];
  } catch {
    return [];
  }
};

const firestoreRef = (uid: string, ideaId: string) =>
  doc(db, "users", uid, "scoreHistory", ideaId);

// Synchronous, localStorage-backed reader for legacy callsites that render
// during SSR / before the user's auth state is known.
export function getScoreHistory(ideaId: string): OpportunityScoreHistoryEntry[] {
  return readLocal(ideaId);
}

// Cross-device read: prefer Firestore, fall back to localStorage.
export async function getScoreHistoryAsync(ideaId: string): Promise<OpportunityScoreHistoryEntry[]> {
  const uid = auth.currentUser?.uid;
  if (uid) {
    try {
      const snap = await getDoc(firestoreRef(uid, ideaId));
      if (snap.exists()) {
        const data = snap.data() as OpportunityScoreHistoryRecord;
        const history = Array.isArray(data.history) ? data.history : [];
        writeLocal(ideaId, history);
        return history;
      }
    } catch (error) {
      console.error("getScoreHistory firestore read failed:", error);
    }
  }
  return readLocal(ideaId);
}

export async function recordScoreHistory(
  ideaId: string,
  entry: OpportunityScoreHistoryEntry
): Promise<void> {
  // Append to local cache immediately so the UI has something to render.
  const localCurrent = readLocal(ideaId);
  const localNext = [...localCurrent, entry].slice(-MAX_ENTRIES);
  writeLocal(ideaId, localNext);

  const uid = auth.currentUser?.uid;
  if (!uid) return;
  // Firestore is the source of truth across devices. We do a read-merge-write
  // (not transactional) — the worst case under concurrent edits is one
  // duplicate entry, which is acceptable for an audit-history surface.
  try {
    const snap = await getDoc(firestoreRef(uid, ideaId));
    const existing = snap.exists()
      ? ((snap.data() as Partial<OpportunityScoreHistoryRecord>).history ?? [])
      : [];
    const merged = [...existing, entry].slice(-MAX_ENTRIES);
    await setDoc(
      firestoreRef(uid, ideaId),
      {
        ideaId,
        history: merged,
        updatedAt: serverTimestamp(),
      },
      { merge: false }
    );
    writeLocal(ideaId, merged);
  } catch (error) {
    console.error("recordScoreHistory firestore write failed:", error);
  }
}
