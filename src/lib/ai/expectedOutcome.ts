import { auth, db } from "@/lib/firebase/config";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import type { ExpectedOutcome } from "./outcomeTypes";

export type { ExpectedOutcome } from "./outcomeTypes";

export interface ExpectedOutcomeRecord {
  ideaId: string;
  expected: ExpectedOutcome;
}

const STORAGE_PREFIX = "Speckula-expected-outcome-v1";
const keyFor = (ideaId: string) => `${STORAGE_PREFIX}:${ideaId}`;

const writeLocal = (ideaId: string, record: ExpectedOutcomeRecord) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(ideaId), JSON.stringify(record));
  } catch {
    /* quota/full — silently drop the local cache */
  }
};

const readLocal = (ideaId: string): ExpectedOutcomeRecord | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(ideaId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as ExpectedOutcomeRecord;
  } catch {
    return null;
  }
};

const firestoreRef = (uid: string, ideaId: string) =>
  doc(db, "users", uid, "outcomes", `expected:${ideaId}`);

// Set the expected outcome. Persists to Firestore (so it syncs across
// devices) and mirrors to localStorage as a same-tab cache.
export async function setExpectedOutcome(
  ideaId: string,
  metric: string,
  target: number,
  timeframe: string,
  unit?: string
): Promise<void> {
  const record: ExpectedOutcomeRecord = {
    ideaId,
    expected: {
      metric,
      target_value: Number(target),
      timeframe,
      ...(unit ? { unit } : {}),
    },
  };
  writeLocal(ideaId, record);
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await setDoc(
      firestoreRef(uid, ideaId),
      { ...record, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (error) {
    console.error("setExpectedOutcome firestore write failed:", error);
  }
}

// Synchronous read for legacy callsites — uses localStorage cache only.
export function getExpectedOutcome(ideaId: string): ExpectedOutcomeRecord | null {
  return readLocal(ideaId);
}

// Async read that prefers Firestore (cross-device truth) but falls back
// to localStorage if Firestore is unreachable or the user is signed out.
export async function getExpectedOutcomeAsync(ideaId: string): Promise<ExpectedOutcomeRecord | null> {
  const uid = auth.currentUser?.uid;
  if (uid) {
    try {
      const snap = await getDoc(firestoreRef(uid, ideaId));
      if (snap.exists()) {
        const data = snap.data() as ExpectedOutcomeRecord;
        writeLocal(ideaId, data);
        return data;
      }
    } catch (error) {
      console.error("getExpectedOutcome firestore read failed:", error);
    }
  }
  return readLocal(ideaId);
}
