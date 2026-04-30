import { auth, db } from "@/lib/firebase/config";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import type { ActualOutcome } from "./outcomeTypes";

export type { ActualOutcome } from "./outcomeTypes";

export interface ActualOutcomeRecord {
  ideaId: string;
  actual: ActualOutcome;
}

const STORAGE_PREFIX = "Speckula-actual-outcome-v1";
const keyFor = (ideaId: string) => `${STORAGE_PREFIX}:${ideaId}`;

const writeLocal = (ideaId: string, record: ActualOutcomeRecord) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(ideaId), JSON.stringify(record));
  } catch {
    /* quota/full */
  }
};

const readLocal = (ideaId: string): ActualOutcomeRecord | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(ideaId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as ActualOutcomeRecord;
  } catch {
    return null;
  }
};

const firestoreRef = (uid: string, ideaId: string) =>
  doc(db, "users", uid, "outcomes", `actual:${ideaId}`);

export async function recordActualOutcome(
  ideaId: string,
  metric: string,
  value: number,
  unit?: string
): Promise<void> {
  const record: ActualOutcomeRecord = {
    ideaId,
    actual: {
      metric,
      value: Number(value),
      observedAt: new Date().toISOString(),
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
    console.error("recordActualOutcome firestore write failed:", error);
  }
}

export function getActualOutcome(ideaId: string): ActualOutcomeRecord | null {
  return readLocal(ideaId);
}

export async function getActualOutcomeAsync(ideaId: string): Promise<ActualOutcomeRecord | null> {
  const uid = auth.currentUser?.uid;
  if (uid) {
    try {
      const snap = await getDoc(firestoreRef(uid, ideaId));
      if (snap.exists()) {
        const data = snap.data() as ActualOutcomeRecord;
        writeLocal(ideaId, data);
        return data;
      }
    } catch (error) {
      console.error("getActualOutcome firestore read failed:", error);
    }
  }
  return readLocal(ideaId);
}
