import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  addDoc,
  limit as firestoreLimit,
  onSnapshot,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./config";

function isPermissionDenied(error: unknown): boolean {
  return !!error && typeof error === "object" && (error as { code?: string }).code === "permission-denied";
}

function logFirestorePermissionHint(operation: string, error: unknown) {
  if (!isPermissionDenied(error)) return;

  console.error(
    `[${operation}] Firestore permission denied. Ensure firestore.rules are deployed to project '${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}'.`,
    error
  );
}

export interface SpeckulaDocument {
  id: string;
  title: string;
  content: unknown; // TipTap JSON
  userId: string;
  lastInsightExtractionHash?: string | null;
  updatedAt: Timestamp | null;
  createdAt: Timestamp | null;
}

export interface Insight {
  id?: string;
  category: "pain-point" | "opportunity" | "user-segment" | "pattern";
  title: string;
  description: string;
  sourceDocId?: string;
  userId: string;
  createdAt: Timestamp | null;
}

export interface PRD {
  id?: string;
  title: string;
  content: string; // Markdown or text
  status: "draft" | "complete";
  sourceDocId?: string;
  userId: string;
  updatedAt: Timestamp | null;
}

// Mirrors CaseBriefData from @/lib/ai/actions — duplicated here to avoid
// circular imports (actions.ts imports from this file).
export interface CaseBriefData {
  title: string;
  context: string;
  evidence: string[];
  insights: string[];
  decision: string;
  scoring: {
    impact: number;
    effort: number;
    confidence: number;
    demand: number;
    score: number;
    reasoning?: string;
  };
  risks: string[];
  verdict: {
    recommendation: "Build" | "Delay" | "Validate";
    rationale: string;
  };
}

export interface DecisionRecord {
  id?: string;
  title: string;
  justification: string;
  priority: "high" | "medium" | "low";
  impact: number;
  effort: number;
  confidence?: number;
  demand?: number;
  score?: number;
  reasoning?: string;
  userStory: string;
  tradeoffs: string;
  summary?: string;
  keyInsight?: string;
  recommendation?: string;
  risks?: string[];
  strategyTheme?: string | null;
  sourceDocId?: string;
  published?: boolean;
  caseBrief?: CaseBriefData | null;
  // v2.1: persisted 0–1 accuracy of expected vs actual outcomes for this
  // decision. Populated by persistOutcomeFeedback. Read by the agent's
  // feedback layer so future runs can bias scoring.
  accuracyNorm?: number;
  // v2.2: prediction-quality (0.5–2) penalizes low-ambition predictions and
  // rewards ambitious targets. finalAccuracy = clamp(accuracyNorm × quality, 0, 1)
  // is what the feedback loop actually consumes.
  predictionQuality?: number;
  finalAccuracy?: number;
  // v2.2: |confidence/9 − accuracyNorm|. High calibrationError means the user
  // was overconfident. Used to add an extra confidence penalty on the next run.
  calibrationError?: number;
  // v2.2: snapshot of the prediction at save time so outcome-record + pattern
  // queries can read it without joining.
  expectedOutcome?: {
    metric: string;
    target_value: number;
    baseline?: number | null;
    unit?: string;
    timeframe: string;
  };
  // v2.2: indexable copy of the predicted metric (lowercase) for pattern lookups.
  metric?: string;
  // v2.4: snapshot of the prompt that produced this decision's prediction.
  // Lets the empirical optimization layer aggregate accuracy by (promptId,
  // version) without re-querying pastRuns and matching by title.
  predictionPromptRef?: { id: string; version: string; hash: string };
  // v2.5: explicit success flag (actual ≥ target) replaces the old
  // `accuracyNorm ≥ 0.5` proxy for hitRate. outcomeRecordedAt anchors the
  // rolling-window rollback so we compare recent vs prior batches by the
  // moment outcomes were recorded, not when the decision was first saved.
  success?: boolean;
  outcomeRecordedAt?: Timestamp | null;
  userId: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface PublicCase {
  id?: string;
  userId: string;
  decisionId: string;
  visibility: "public" | "private" | "unlisted";
  brief: CaseBriefData;
  decisionTitle: string;
  score?: number;
  priority?: "high" | "medium" | "low";
  publishedAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface ExecutionTask {
  id?: string;
  title: string;
  description?: string;
  status: "todo" | "in-progress" | "done";
  priority: "high" | "medium" | "low";
  milestone?: string;
  effort?: number; // 1-10 scale
  category?: string; // backend, frontend, design, qa, integration
  prdSection?: string; // Reference to which PRD section this came from
  prdId?: string; // Reference to PRD document
  sourceDocId?: string; // Reference to source editor document
  dependsOn?: string[]; // Array of task IDs this task depends on
  assignee?: string; // User ID or email of assigned team member
  dueDate?: string; // ISO date string YYYY-MM-DD
  userId: string;
  createdAt?: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface PublicProfile {
  userId: string;
  name: string;
  bio: string;
  skills: string[];
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface WorkspaceMember {
  userId: string;
  role: "owner" | "editor" | "viewer";
}

export interface TeamWorkspace {
  id?: string;
  workspaceId?: string;
  name: string;
  members: WorkspaceMember[];
  memberIds?: string[];
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

// Path Helpers
const userDocsCollection = (userId: string) => collection(db, "users", userId, "documents");
const userInsightsCollection = (userId: string) => collection(db, "users", userId, "insights");
const userDecisionsCollection = (userId: string) => collection(db, "users", userId, "decisions");
const userPrdsCollection = (userId: string) => collection(db, "users", userId, "prds");
const userTasksCollection = (userId: string) => collection(db, "users", userId, "tasks");
const userPastRunsCollection = (userId: string) => collection(db, "users", userId, "pastRuns");
const userPromptOverridesCollection = (userId: string) => collection(db, "users", userId, "promptOverrides");
const userPromptOverrideRef = (userId: string, promptId: string) =>
  doc(db, "users", userId, "promptOverrides", promptId);
const publicProfilesCollection = () => collection(db, "publicProfiles");
const workspacesCollection = () => collection(db, "workspaces");

const userDocRef = (userId: string, docId: string) => doc(db, "users", userId, "documents", docId);
const publicProfileRef = (userId: string) => doc(db, "publicProfiles", userId);
const publicCaseRef = (caseId: string) => doc(db, "publicCases", caseId);
const workspaceRef = (workspaceId: string) => doc(db, "workspaces", workspaceId);

// --- DOCUMENT ACTIONS ---

export const createDocument = async (userId: string, title: string = "Untitled Document") => {
  try {
    const ref = userDocsCollection(userId);
    const docRef = await addDoc(ref, {
      title,
      content: {
        type: "doc",
        content: [{ type: "paragraph" }],
      },
      userId,
      lastInsightExtractionHash: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    logFirestorePermissionHint("createDocument", error);
    throw error;
  }
};

export const saveDocument = async (userId: string, docId: string, data: Partial<SpeckulaDocument>) => {
  try {
    const ref = userDocRef(userId, docId);
    await setDoc(ref, { ...data, userId, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    logFirestorePermissionHint("saveDocument", error);
    throw error;
  }
};

export const getDocument = async (userId: string, docId: string) => {
  try {
    const ref = userDocRef(userId, docId);
    const snap = await getDoc(ref);
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as SpeckulaDocument) : null;
  } catch (error) {
    logFirestorePermissionHint("getDocument", error);
    throw error;
  }
};

export const deleteDocument = async (userId: string, docId: string) => {
  try {
    await deleteDoc(userDocRef(userId, docId));
  } catch (error) {
    logFirestorePermissionHint("deleteDocument", error);
    throw error;
  }
};

export const getUserDocuments = async (userId: string) => {
  try {
    const q = query(userDocsCollection(userId), orderBy("updatedAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as SpeckulaDocument[];
  } catch (error) {
    console.error("Error fetching documents:", error);
    // Return empty array instead of throwing to allow graceful degradation
    return [];
  }
};

// --- INSIGHTS ACTIONS ---

// Stable fingerprint for insight-dedup. Insights with the same title+
// description+sourceDocId are treated as duplicates and skipped on subsequent
// saves so re-extraction doesn't pollute the user's collection.
const insightFingerprint = (i: Pick<Insight, "title" | "description" | "category" | "sourceDocId">): string => {
  const norm = (s?: string) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  return `${norm(i.title)}::${norm(i.description)}::${norm(i.category)}::${i.sourceDocId ?? ""}`;
};

export const saveInsight = async (userId: string, data: Omit<Insight, "userId" | "createdAt">) => {
  try {
    // Cheap dedup: pull the latest 50 and compare fingerprints. We don't
    // need a perfect dedup — just to stop the most common case of the
    // same auto-extraction running twice.
    const recent = await getDocs(query(userInsightsCollection(userId), orderBy("createdAt", "desc"), firestoreLimit(50)));
    const fp = insightFingerprint(data);
    const seen = recent.docs.some((d) => {
      const r = d.data() as Insight;
      return insightFingerprint(r) === fp;
    });
    if (seen) return;
    await addDoc(userInsightsCollection(userId), { ...data, userId, createdAt: serverTimestamp() });
  } catch (error) {
    logFirestorePermissionHint("saveInsight", error);
    throw error;
  }
};

export const getInsights = async (userId: string) => {
  try {
    const q = query(userInsightsCollection(userId), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Insight[];
  } catch (error) {
    logFirestorePermissionHint("getInsights", error);
    throw error;
  }
};

export const deleteInsight = async (userId: string, insightId: string) => {
  try {
    await deleteDoc(doc(userInsightsCollection(userId), insightId));
  } catch (error) {
    logFirestorePermissionHint("deleteInsight", error);
    throw error;
  }
};

export const updateInsight = async (userId: string, insightId: string, data: Partial<Pick<Insight, "title" | "description">>) => {
  try {
    await setDoc(doc(userInsightsCollection(userId), insightId), data, { merge: true });
  } catch (error) {
    logFirestorePermissionHint("updateInsight", error);
    throw error;
  }
};

// --- DECISION ACTIONS ---

// Returns the Firestore-assigned document id so callers can link in-memory
// decision objects to the persisted record. Previously the function
// discarded the ref, leaving outcome feedback to write under an ephemeral
// client-only UUID that didn't match anything in Firestore.
export const saveDecision = async (userId: string, data: Omit<DecisionRecord, "userId" | "createdAt" | "updatedAt">): Promise<string> => {
  try {
    const ref = await addDoc(userDecisionsCollection(userId), {
      ...data,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    logFirestorePermissionHint("saveDecision", error);
    throw error;
  }
};

export const getDecisions = async (userId: string) => {
  try {
    const q = query(userDecisionsCollection(userId), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as DecisionRecord[];
  } catch (error) {
    logFirestorePermissionHint("getDecisions", error);
    throw error;
  }
};

export const deleteDecision = async (userId: string, decisionId: string) => {
  try {
    await deleteDoc(doc(userDecisionsCollection(userId), decisionId));
  } catch (error) {
    logFirestorePermissionHint("deleteDecision", error);
    throw error;
  }
};

export const updateDecision = async (
  userId: string,
  decisionId: string,
  data: Partial<Omit<DecisionRecord, "id" | "userId" | "createdAt">>
) => {
  try {
    await setDoc(doc(userDecisionsCollection(userId), decisionId), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    logFirestorePermissionHint("updateDecision", error);
    throw error;
  }
};

export const publishCase = async (
  userId: string,
  decisionId: string,
  brief: CaseBriefData,
  meta: Pick<DecisionRecord, "title" | "score" | "priority">
): Promise<void> => {
  try {
    await setDoc(publicCaseRef(decisionId), {
      userId,
      decisionId,
      visibility: "unlisted",
      brief,
      decisionTitle: meta.title,
      score: meta.score,
      priority: meta.priority,
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await updateDecision(userId, decisionId, { published: true, caseBrief: brief });
  } catch (error) {
    logFirestorePermissionHint("publishCase", error);
    throw error;
  }
};

export const unpublishCase = async (userId: string, decisionId: string): Promise<void> => {
  try {
    await deleteDoc(publicCaseRef(decisionId));
    await updateDecision(userId, decisionId, { published: false });
  } catch (error) {
    logFirestorePermissionHint("unpublishCase", error);
    throw error;
  }
};

export const getPublicCase = async (caseId: string): Promise<PublicCase | null> => {
  try {
    const snap = await getDoc(publicCaseRef(caseId));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as PublicCase & { id: string }) : null;
  } catch (error) {
    console.error("Error fetching public case:", error);
    return null;
  }
};

export const renameDocument = async (userId: string, docId: string, title: string) => {
  try {
    await setDoc(userDocRef(userId, docId), { title, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    logFirestorePermissionHint("renameDocument", error);
    throw error;
  }
};

// --- AUTONOMOUS-MODE PAST RUNS (lightweight memory) ---
// Stores the user's recent autonomous runs so the next run can be primed with
// "you've already explored these — push for sharper angles." Intentionally
// minimal: we keep the idea text, top decision titles, and verdict. Full
// decisions live elsewhere; we don't duplicate them here.

export interface PastRunRecord {
  id?: string;
  idea: string;
  topDecisions: string[];
  verdictLabel: string;
  verdictReason: string;
  // v2.1: structured prediction emitted DURING the run. Lets future runs
  // surface "you predicted X for a similar idea — actual was Y" and seeds the
  // outcome-comparison flow when the user later records actuals.
  predictedOutcome?: {
    metric: string;
    baseline: number | null;
    target: number;
    timeframeDays: number;
    confidence: number;
    unit?: string;
  };
  // Snapshot of the user's rolling accuracy at run time, for trend analysis.
  userAccuracyAtRun?: number;
  // v2.3 forensic prompt snapshots. Refs let us prove which exact prompt
  // version + content produced this run's decisions and prediction without
  // having to retain the full prompt text.
  directionsPromptRef?: { id: string; version: string; hash: string };
  predictionPromptRef?: { id: string; version: string; hash: string };
  createdAt: Timestamp | null;
}

export const savePastRun = async (
  userId: string,
  data: Omit<PastRunRecord, "id" | "createdAt">
) => {
  try {
    await addDoc(userPastRunsCollection(userId), {
      ...data,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    logFirestorePermissionHint("savePastRun", error);
    // Memory is non-critical — never let a failure to remember block the run.
  }
};

export const getRecentPastRuns = async (userId: string, max = 3): Promise<PastRunRecord[]> => {
  try {
    const q = query(
      userPastRunsCollection(userId),
      orderBy("createdAt", "desc"),
      firestoreLimit(max)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PastRunRecord[];
  } catch (error) {
    logFirestorePermissionHint("getRecentPastRuns", error);
    return [];
  }
};

// v2.2 feedback loop signals (Stages 11 + prediction-quality + calibration).
// One Firestore query → three derived signals so the autonomous agent doesn't
// fan out three independent reads at startup.
//   userAccuracy       : avg finalAccuracy (or accuracyNorm fallback) across
//                        the most recent N decisions with recorded outcomes.
//   calibrationError   : avg |confidenceNorm − accuracyNorm|, 0–1.
//   patternAccuracies  : map of normalized metric → avg accuracy. Lookups are
//                        case-insensitive and trimmed.
export interface UserFeedbackSignals {
  userAccuracy: number | null;
  calibrationError: number | null;
  patternAccuracies: Record<string, number>;
  // v2.4: same shape, keyed by lowercased strategicTheme.
  themeAccuracies: Record<string, number>;
  // v2.6 calibration intelligence layer.
  // calibrationBias is signed: > 0 = overconfident, < 0 = underconfident.
  // pattern/theme variants narrow that signal so we can downweight only the
  // categories the user systematically misjudges.
  calibrationBias: number | null;
  patternBiases: Record<string, number>;
  themeBiases: Record<string, number>;
  calibrationBuckets: CalibrationBucket[];
}

// v2.6 — predicted-confidence vs realised-accuracy buckets, used for the
// internal calibration curve and (eventually) for non-binary bias correction.
export interface CalibrationBucket {
  range: [number, number]; // [lo, hi) on the 0–1 confidence axis
  avgConfidence: number;   // 0–1, average normalised confidence in the bucket
  avgAccuracy: number;     // 0–1, average accuracyNorm in the bucket
  count: number;
}

// Five equal-width buckets across [0, 1]. The last bucket is closed on the
// right so confidence == 1.0 has somewhere to land.
const CALIBRATION_BUCKET_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0.0, 0.2],
  [0.2, 0.4],
  [0.4, 0.6],
  [0.6, 0.8],
  [0.8, 1.0],
];

export const getUserFeedbackSignals = async (userId: string, max = 12): Promise<UserFeedbackSignals> => {
  const empty: UserFeedbackSignals = {
    userAccuracy: null,
    calibrationError: null,
    patternAccuracies: {},
    themeAccuracies: {},
    calibrationBias: null,
    patternBiases: {},
    themeBiases: {},
    calibrationBuckets: [],
  };
  try {
    const q = query(
      userDecisionsCollection(userId),
      orderBy("updatedAt", "desc"),
      firestoreLimit(max * 3)
    );
    const snap = await getDocs(q);
    const accuracies: number[] = [];
    const errors: number[] = [];
    const patternBuckets: Record<string, number[]> = {};
    const themeBuckets: Record<string, number[]> = {};

    // v2.6 calibration aggregation.
    //   biasValues: signed (confidenceNorm − accuracyNorm) for global average
    //   patternBias / themeBias: same signal, narrowed by metric / theme
    //   confAccPairs: bucketed for the calibration curve
    const biasValues: number[] = [];
    const patternBiasBuckets: Record<string, number[]> = {};
    const themeBiasBuckets: Record<string, number[]> = {};
    const bucketTotals = CALIBRATION_BUCKET_RANGES.map(() => ({ confSum: 0, accSum: 0, count: 0 }));

    for (const d of snap.docs) {
      const data = d.data() as {
        finalAccuracy?: unknown;
        accuracyNorm?: unknown;
        calibrationError?: unknown;
        confidence?: unknown;
        metric?: unknown;
        strategyTheme?: unknown;
      };

      const accRaw = Number(data.finalAccuracy ?? data.accuracyNorm);
      const accValid = Number.isFinite(accRaw) && accRaw >= 0 && accRaw <= 1;
      const m = typeof data.metric === "string" ? data.metric.trim().toLowerCase() : "";
      const t = typeof data.strategyTheme === "string" ? data.strategyTheme.trim().toLowerCase() : "";

      if (accValid) {
        accuracies.push(accRaw);
        if (m) (patternBuckets[m] ??= []).push(accRaw);
        if (t) (themeBuckets[t] ??= []).push(accRaw);
      }

      const errRaw = Number(data.calibrationError);
      if (Number.isFinite(errRaw) && errRaw >= 0 && errRaw <= 1) errors.push(errRaw);

      // Calibration bias requires both a confidence (1–10) and a valid
      // accuracyNorm. Normalise confidence to 0–1 before subtracting.
      const confRaw = Number(data.confidence);
      if (accValid && Number.isFinite(confRaw)) {
        const confNorm = Math.max(0, Math.min(1, (confRaw - 1) / 9));
        const bias = confNorm - accRaw;
        biasValues.push(bias);
        if (m) (patternBiasBuckets[m] ??= []).push(bias);
        if (t) (themeBiasBuckets[t] ??= []).push(bias);

        // Bin the (confidence, accuracy) pair for the curve. Last bucket is
        // closed on the right so confidence == 1.0 still lands somewhere.
        for (let i = 0; i < CALIBRATION_BUCKET_RANGES.length; i++) {
          const [lo, hi] = CALIBRATION_BUCKET_RANGES[i];
          const isLast = i === CALIBRATION_BUCKET_RANGES.length - 1;
          if (confNorm >= lo && (confNorm < hi || (isLast && confNorm <= hi))) {
            bucketTotals[i].confSum += confNorm;
            bucketTotals[i].accSum += accRaw;
            bucketTotals[i].count += 1;
            break;
          }
        }
      }

      if (accuracies.length >= max && errors.length >= max) break;
    }

    const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
    const userAccuracy = accuracies.length > 0 ? avg(accuracies.slice(0, max)) : null;
    const calibrationError = errors.length > 0 ? avg(errors.slice(0, max)) : null;
    const patternAccuracies: Record<string, number> = {};
    for (const [m, vals] of Object.entries(patternBuckets)) {
      if (vals.length > 0) patternAccuracies[m] = avg(vals);
    }
    const themeAccuracies: Record<string, number> = {};
    for (const [t, vals] of Object.entries(themeBuckets)) {
      if (vals.length > 0) themeAccuracies[t] = avg(vals);
    }

    const calibrationBias = biasValues.length > 0 ? avg(biasValues) : null;
    const patternBiases: Record<string, number> = {};
    for (const [m, vals] of Object.entries(patternBiasBuckets)) {
      if (vals.length > 0) patternBiases[m] = avg(vals);
    }
    const themeBiases: Record<string, number> = {};
    for (const [t, vals] of Object.entries(themeBiasBuckets)) {
      if (vals.length > 0) themeBiases[t] = avg(vals);
    }
    const calibrationBuckets: CalibrationBucket[] = CALIBRATION_BUCKET_RANGES.map(([lo, hi], i) => {
      const t = bucketTotals[i];
      return {
        range: [lo, hi],
        avgConfidence: t.count > 0 ? t.confSum / t.count : 0,
        avgAccuracy: t.count > 0 ? t.accSum / t.count : 0,
        count: t.count,
      };
    });

    return {
      userAccuracy,
      calibrationError,
      patternAccuracies,
      themeAccuracies,
      calibrationBias,
      patternBiases,
      themeBiases,
      calibrationBuckets,
    };
  } catch (error) {
    logFirestorePermissionHint("getUserFeedbackSignals", error);
    return empty;
  }
};

// Back-compat shim. Prefer getUserFeedbackSignals.
export const getUserAccuracySignal = async (userId: string, max = 10): Promise<number | null> => {
  const signals = await getUserFeedbackSignals(userId, max);
  return signals.userAccuracy;
};

// v2.4 empirical optimization layer (Step 1 + 6).
// Aggregates per-(promptId, promptVersion) outcome metrics from saved
// decisions. Source = Firestore (decisions carry expectedOutcome + actuals
// via the sub-collection feedback flow). Backend PromptLog already provides
// the cost / latency side; this fills in the accuracy side.
export interface PromptOutcomeMetricsRow {
  promptId: string;
  promptVersion: string;
  runs: number;
  avgAccuracyNorm: number | null;
  avgFinalAccuracy: number | null;
  avgCalibrationError: number | null;
  avgPredictionConfidence: number | null;
  // v2.5: hitRate now derives from the explicit `success` flag persisted on
  // each decision. Falls back to accuracyNorm >= 0.5 when older records
  // didn't record a success boolean.
  hitRate: number | null;
  outcomesRecorded: number;
}

// v2.5: per-decision sample used by the rolling-window rollback algorithm.
// Sorted DESC by recordedAt by getPromptOutcomeMetrics so consumers can
// slice the recent window without re-sorting.
export interface OutcomeSample {
  promptId: string;
  promptVersion: string;
  accuracyNorm: number;
  success: boolean;
  recordedAt: number; // ms epoch
}

export interface PromptOutcomeMetricsResult {
  rows: PromptOutcomeMetricsRow[];
  samplesByPromptId: Record<string, OutcomeSample[]>;
}

export const getPromptOutcomeMetrics = async (
  userId: string,
  windowDays = 30
): Promise<PromptOutcomeMetricsResult> => {
  try {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    // Pull recent decisions; we filter by predictionPromptRef.id presence
    // client-side because composite-field filters on nested fields require
    // a Firestore index we don't want to demand.
    const q = query(userDecisionsCollection(userId), orderBy("updatedAt", "desc"), firestoreLimit(500));
    const snap = await getDocs(q);

    interface Bucket {
      runs: number;
      accSum: number; accCount: number;
      finalSum: number; finalCount: number;
      calibSum: number; calibCount: number;
      confSum: number; confCount: number;
      hits: number; outcomes: number;
    }
    const buckets = new Map<string, Bucket & { promptId: string; promptVersion: string }>();
    const samplesByPromptId: Record<string, OutcomeSample[]> = {};
    const bucketKey = (id: string, v: string) => `${id}::${v}`;

    for (const d of snap.docs) {
      const data = d.data() as DecisionRecord;
      const ref = data.predictionPromptRef;
      if (!ref?.id || !ref.version) continue;

      // updatedAt is the agent-bumped timestamp; outcomeRecordedAt is the
      // explicit feedback time. Prefer the latter when present so the
      // rolling-window rollback partitions by *outcome* time, not by save.
      const ts =
        data.outcomeRecordedAt?.toDate?.() ??
        data.updatedAt?.toDate?.() ??
        null;
      if (ts && ts < since) continue;

      const key = bucketKey(ref.id, ref.version);
      const b = buckets.get(key) ?? {
        promptId: ref.id, promptVersion: ref.version,
        runs: 0,
        accSum: 0, accCount: 0,
        finalSum: 0, finalCount: 0,
        calibSum: 0, calibCount: 0,
        confSum: 0, confCount: 0,
        hits: 0, outcomes: 0,
      };
      b.runs += 1;

      const acc = Number(data.accuracyNorm);
      const accValid = Number.isFinite(acc);
      if (accValid) { b.accSum += acc; b.accCount += 1; }
      const fin = Number(data.finalAccuracy);
      if (Number.isFinite(fin)) { b.finalSum += fin; b.finalCount += 1; }
      const cal = Number(data.calibrationError);
      if (Number.isFinite(cal)) { b.calibSum += cal; b.calibCount += 1; }
      const conf = Number(data.confidence);
      if (Number.isFinite(conf)) { b.confSum += conf / 10; b.confCount += 1; }

      // v2.5: prefer the explicit `success` boolean. Legacy records without
      // it fall back to the accuracyNorm >= 0.5 proxy so historical data
      // still contributes a hit-rate signal.
      const explicitSuccess = typeof data.success === "boolean" ? data.success : null;
      const success = explicitSuccess ?? (accValid ? acc >= 0.5 : null);
      if (success !== null) {
        b.outcomes += 1;
        if (success) b.hits += 1;
      }

      buckets.set(key, b);

      // Push a sample for rolling-window rollback. We require accuracy +
      // a usable success bool; without those the sample has no signal.
      if (accValid && success !== null && ts) {
        (samplesByPromptId[ref.id] ??= []).push({
          promptId: ref.id,
          promptVersion: ref.version,
          accuracyNorm: acc,
          success,
          recordedAt: ts.getTime(),
        });
      }
    }

    // Each promptId's samples already arrive in DESC-by-updatedAt order from
    // the Firestore query. Re-sort defensively since outcomeRecordedAt may
    // diverge from updatedAt for legacy rows.
    for (const pid of Object.keys(samplesByPromptId)) {
      samplesByPromptId[pid].sort((a, b) => b.recordedAt - a.recordedAt);
    }

    const rows: PromptOutcomeMetricsRow[] = Array.from(buckets.values()).map((b) => ({
      promptId: b.promptId,
      promptVersion: b.promptVersion,
      runs: b.runs,
      avgAccuracyNorm: b.accCount > 0 ? b.accSum / b.accCount : null,
      avgFinalAccuracy: b.finalCount > 0 ? b.finalSum / b.finalCount : null,
      avgCalibrationError: b.calibCount > 0 ? b.calibSum / b.calibCount : null,
      avgPredictionConfidence: b.confCount > 0 ? b.confSum / b.confCount : null,
      hitRate: b.outcomes > 0 ? b.hits / b.outcomes : null,
      outcomesRecorded: b.outcomes,
    }));

    return { rows, samplesByPromptId };
  } catch (error) {
    logFirestorePermissionHint("getPromptOutcomeMetrics", error);
    return { rows: [], samplesByPromptId: {} };
  }
};

// v2.5 — per-user prompt version overrides persisted in Firestore.
// users/{uid}/promptOverrides/{promptId} — { version, source, decidedAt }
//
// Authority order at version-resolve time:
//   1. Firestore override (this collection)
//   2. localStorage rollback override (offline fallback)
//   3. PINNED_VERSIONS default
//
// Source values:
//   - "rollback"  — auto-rollback decided by computeAndApplyRollbacks
//   - "manual"    — admin / experiment toggle (future)
export interface PromptOverrideRecord {
  version: string;
  source: "rollback" | "manual";
  decidedAt: Timestamp | null;
  // Optional metadata: which decision led to this override
  fromVersion?: string;
  recentAccuracy?: number;
  previousAccuracy?: number;
}

export const getPromptOverrides = async (userId: string): Promise<Record<string, PromptOverrideRecord>> => {
  try {
    const snap = await getDocs(userPromptOverridesCollection(userId));
    const out: Record<string, PromptOverrideRecord> = {};
    for (const d of snap.docs) {
      out[d.id] = d.data() as PromptOverrideRecord;
    }
    return out;
  } catch (error) {
    logFirestorePermissionHint("getPromptOverrides", error);
    return {};
  }
};

export const setPromptOverride = async (
  userId: string,
  promptId: string,
  data: Omit<PromptOverrideRecord, "decidedAt">
): Promise<void> => {
  try {
    await setDoc(userPromptOverrideRef(userId, promptId), {
      ...data,
      decidedAt: serverTimestamp(),
    });
  } catch (error) {
    logFirestorePermissionHint("setPromptOverride", error);
    // Non-blocking: agent flow should continue even if override write fails.
  }
};

export const clearPromptOverride = async (userId: string, promptId: string): Promise<void> => {
  try {
    await deleteDoc(userPromptOverrideRef(userId, promptId));
  } catch (error) {
    logFirestorePermissionHint("clearPromptOverride", error);
  }
};

// --- PRD ACTIONS ---

export const savePRD = async (userId: string, data: Omit<PRD, "userId" | "updatedAt">) => {
  try {
    await addDoc(userPrdsCollection(userId), { ...data, userId, updatedAt: serverTimestamp() });
  } catch (error) {
    logFirestorePermissionHint("savePRD", error);
    throw error;
  }
};

export const getPRDs = async (userId: string) => {
  try {
    const q = query(userPrdsCollection(userId), orderBy("updatedAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as PRD[];
  } catch (error) {
    logFirestorePermissionHint("getPRDs", error);
    throw error;
  }
};

// --- TASKS ACTIONS ---

export const saveTask = async (userId: string, data: Omit<ExecutionTask, "userId" | "updatedAt">) => {
  try {
    const docRef = await addDoc(userTasksCollection(userId), { ...data, userId, updatedAt: serverTimestamp() });
    return docRef;
  } catch (error) {
    logFirestorePermissionHint("saveTask", error);
    throw error;
  }
};

export const updateTask = async (userId: string, taskId: string, data: Partial<ExecutionTask>) => {
  try {
    const ref = doc(db, "users", userId, "tasks", taskId);
    await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    logFirestorePermissionHint("updateTask", error);
    throw error;
  }
};

export const deleteTask = async (userId: string, taskId: string) => {
  try {
    const ref = doc(db, "users", userId, "tasks", taskId);
    await deleteDoc(ref);
  } catch (error) {
    logFirestorePermissionHint("deleteTask", error);
    throw error;
  }
};

export const getTasks = async (userId: string) => {
  try {
    const q = query(userTasksCollection(userId), orderBy("updatedAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as ExecutionTask[];
  } catch (error) {
    logFirestorePermissionHint("getTasks", error);
    throw error;
  }
};

export const getTaskById = async (userId: string, taskId: string): Promise<ExecutionTask | null> => {
  try {
    const ref = doc(db, "users", userId, "tasks", taskId);
    const snap = await getDoc(ref);
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as ExecutionTask) : null;
  } catch (error) {
    logFirestorePermissionHint("getTaskById", error);
    throw error;
  }
};

export const getTasksByPRD = async (userId: string, prdId: string): Promise<ExecutionTask[]> => {
  try {
    const tasks = await getTasks(userId);
    const priorityRank: Record<NonNullable<ExecutionTask["priority"]>, number> = {
      high: 0,
      medium: 1,
      low: 2,
    };

    return tasks
      .filter((task) => task.prdId === prdId)
      .sort((left, right) => {
        const priorityDelta = priorityRank[left.priority] - priorityRank[right.priority];
        if (priorityDelta !== 0) return priorityDelta;

        const leftUpdated = left.updatedAt?.toMillis?.() ?? 0;
        const rightUpdated = right.updatedAt?.toMillis?.() ?? 0;
        return rightUpdated - leftUpdated;
      });
  } catch (error) {
    logFirestorePermissionHint("getTasksByPRD", error);
    throw error;
  }
};

// --- USER INITIALIZATION ---

export const initializeUser = async (userId: string) => {
  try {
    const userRef = doc(db, "users", userId);
    const profileRef = publicProfileRef(userId);

    // Avoid read-before-write during initial sign-in because auth propagation can be briefly delayed.
    // A merge upsert minimizes first-load permission races and keeps existing fields untouched.
    await setDoc(userRef, {
      userId,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // `published: false` keeps the auto-created profile out of the public
    // read rule — the user must explicitly publish before strangers can
    // enumerate the doc by UID. We use a guarded merge: only set the field
    // if the doc doesn't already exist, so re-initialize never demotes a
    // published profile back to private.
    const profileSnap = await getDoc(profileRef);
    if (!profileSnap.exists()) {
      await setDoc(profileRef, {
        userId,
        published: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(profileRef, {
        userId,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    console.log(`[initializeUser] Initialized user document for ${userId}`);
  } catch (error) {
    logFirestorePermissionHint("initializeUser", error);
    console.error(`[initializeUser] Failed to initialize user ${userId}:`, error);
    throw error;
  }
};

// --- PLATFORM ACTIONS ---

export const getPublicProfile = async (userId: string): Promise<PublicProfile | null> => {
  try {
    const snap = await getDoc(publicProfileRef(userId));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as PublicProfile & { id: string }) : null;
  } catch (error) {
    console.error("Error fetching public profile:", error);
    return null;
  }
};

export const savePublicProfile = async (userId: string, data: Partial<PublicProfile>) => {
  try {
    await setDoc(
      publicProfileRef(userId),
      {
        ...data,
        userId,
        updatedAt: serverTimestamp(),
        ...(data.createdAt ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true }
    );
  } catch (error) {
    logFirestorePermissionHint("savePublicProfile", error);
    throw error;
  }
};

export const getPublicProfiles = async () => {
  try {
    const snap = await getDocs(publicProfilesCollection());
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as (PublicProfile & { id: string })[];
  } catch (error) {
    console.error("Error fetching public profiles:", error);
    return [];
  }
};

export const saveWorkspace = async (userId: string, name: string) => {
  try {
    const ref = await addDoc(workspacesCollection(), {
      name,
      members: [{ userId, role: "owner" as const }],
      memberIds: [userId],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(ref, { workspaceId: ref.id }, { merge: true });
    return ref.id;
  } catch (error) {
    logFirestorePermissionHint("saveWorkspace", error);
    throw error;
  }
};

export const getWorkspacesForUser = async (userId: string) => {
  try {
    const q = query(workspacesCollection(), where("memberIds", "array-contains", userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as (TeamWorkspace & { id: string })[];
  } catch (error) {
    if (!isPermissionDenied(error)) {
      console.error("Error fetching workspaces:", error);
    }
    return [];
  }
};

export const updateWorkspace = async (workspaceId: string, data: Partial<TeamWorkspace>) => {
  try {
    await setDoc(workspaceRef(workspaceId), { ...data, workspaceId, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    logFirestorePermissionHint("updateWorkspace", error);
    throw error;
  }
};

export const inviteWorkspaceMember = async (workspaceId: string, member: WorkspaceMember) => {
  try {
    const snap = await getDoc(workspaceRef(workspaceId));
    if (!snap.exists()) return;
    const current = snap.data() as TeamWorkspace;
    const members = Array.isArray(current.members) ? current.members : [];
    const memberIds = Array.isArray(current.memberIds) ? current.memberIds : [];
    const nextMembers = members.some((entry) => entry.userId === member.userId)
      ? members.map((entry) => (entry.userId === member.userId ? member : entry))
      : [...members, member];
    const nextMemberIds = Array.from(new Set([...memberIds, member.userId]));

    await setDoc(workspaceRef(workspaceId), { members: nextMembers, memberIds: nextMemberIds, workspaceId, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    logFirestorePermissionHint("inviteWorkspaceMember", error);
    throw error;
  }
};

// ── Slack Messages ────────────────────────────────────────────────────────
export interface SlackMessage {
  id: string;
  teamId: string;
  channelId: string | null;
  userId: string | null;
  text: string;
  slackTs: string;
  threadTs: string | null;
  eventType: string;
  eventId?: string;
  ownerUserId?: string;
  source?: "event" | "backfill";
  createdAt: Timestamp | null;
}

export interface SlackWorkspace {
  teamId: string;
  teamName: string;
  botUserId: string;
  installedBy: string;
  scope: string;
  selectedChannels: string[];
  backfillCompleted: boolean;
  installedAt: Timestamp | null;
  updatedAt: Timestamp | null;
  lastBackfillAt?: Timestamp | null;
}

export const subscribeToSlackWorkspaces = (
  userId: string,
  onUpdate: (workspaces: SlackWorkspace[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, "users", userId, "slackWorkspaces"),
    orderBy("installedAt", "desc")
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const workspaces = snapshot.docs.map((d) => d.data()) as SlackWorkspace[];
      onUpdate(workspaces);
    },
    (error) => {
      logFirestorePermissionHint("subscribeToSlackWorkspaces", error);
    }
  );
};

export const subscribeToSlackMessages = (
  ownerUserId: string,
  onUpdate: (messages: SlackMessage[]) => void,
  options: { limit?: number; teamId?: string; channelId?: string } = {}
): Unsubscribe => {
  const { limit = 100, teamId, channelId } = options;
  const constraints: Parameters<typeof query>[1][] = [
    where("ownerUserId", "==", ownerUserId),
  ];
  if (teamId) constraints.push(where("teamId", "==", teamId));
  if (channelId) constraints.push(where("channelId", "==", channelId));
  constraints.push(orderBy("slackTs", "desc"));
  constraints.push(firestoreLimit(limit));

  const q = query(collection(db, "slackMessages"), ...constraints);
  return onSnapshot(
    q,
    (snapshot) => {
      const messages = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as SlackMessage[];
      onUpdate(messages);
    },
    (error) => {
      logFirestorePermissionHint("subscribeToSlackMessages", error);
    }
  );
};


