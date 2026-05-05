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
  Timestamp as FsTimestamp,
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
  // v2.7: which decision mode produced this record. Persisted alongside so
  // getPromptOutcomeMetrics can group by mode and surface "performance by
  // mode" in the internal panel without a new collection.
  decisionMode?: DecisionMode;
  // v2.5: explicit success flag (actual ≥ target) replaces the old
  // `accuracyNorm ≥ 0.5` proxy for hitRate. outcomeRecordedAt anchors the
  // rolling-window rollback so we compare recent vs prior batches by the
  // moment outcomes were recorded, not when the decision was first saved.
  success?: boolean;
  outcomeRecordedAt?: Timestamp | null;
  // v2.9 stability guard. False = the outcome was recorded against an
  // unreliable setup (timeframe too short, missing baseline + tiny target,
  // or observation logged before the timeframe elapsed). Aggregations skip
  // these rows. Legacy records without the field default to "include" so
  // historical data still contributes.
  isValid?: boolean;
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
const userSettingRef = (userId: string, settingId: string) =>
  doc(db, "users", userId, "settings", settingId);
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
  // v2.9 drift detection. shortTerm = last 14 days, longTerm = last 60 days.
  // driftDetected = true when shortTerm < longTerm − 0.05 — early warning
  // that a prompt's quality is degrading even before rollback thresholds fire.
  shortTermAccuracy: number | null;
  longTermAccuracy: number | null;
  driftDetected: boolean;
  // v3.0 anomaly. Same direction as drift but at a much higher magnitude
  // (10%) — an alert-worthy sudden drop, not a trend.
  anomaly: boolean;
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
  // v2.7: per-decision-mode rollup. Lets the internal panel compare how the
  // three modes perform without joining anything new — derived from
  // DecisionRecord.decisionMode.
  modeBreakdown: ModeBreakdownRow[];
}

export interface ModeBreakdownRow {
  mode: DecisionMode;
  runs: number;
  outcomesRecorded: number;
  avgAccuracyNorm: number | null;
  hitRate: number | null;
  avgCalibrationError: number | null;
}

export const getPromptOutcomeMetrics = async (
  userId: string,
  windowDays = 30
): Promise<PromptOutcomeMetricsResult> => {
  try {
    // v2.9: pull at least 60 days of data so drift detection (14d vs 60d)
    // always has the long-window context, even when the caller asked for a
    // shorter primary window.
    const DAY_MS = 24 * 60 * 60 * 1000;
    const DRIFT_LONG_DAYS = 60;
    const DRIFT_SHORT_DAYS = 14;
    const DRIFT_THRESHOLD = 0.05;
    const now = Date.now();
    const queryWindowDays = Math.max(windowDays, DRIFT_LONG_DAYS);
    const since = new Date(now - queryWindowDays * DAY_MS);
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
      // v2.9 drift accumulators (always run independent of windowDays).
      shortAccSum: number; shortAccCount: number;
      longAccSum: number;  longAccCount: number;
    }
    const buckets = new Map<string, Bucket & { promptId: string; promptVersion: string }>();
    const samplesByPromptId: Record<string, OutcomeSample[]> = {};
    const bucketKey = (id: string, v: string) => `${id}::${v}`;

    // v2.7 mode buckets — same shape as a per-version bucket but keyed by the
    // saved DecisionRecord.decisionMode. Only seeded for the three known
    // modes; legacy decisions without the field are excluded.
    const emptyBucket = (): Bucket => ({
      runs: 0, accSum: 0, accCount: 0, finalSum: 0, finalCount: 0,
      calibSum: 0, calibCount: 0, confSum: 0, confCount: 0,
      hits: 0, outcomes: 0,
      shortAccSum: 0, shortAccCount: 0, longAccSum: 0, longAccCount: 0,
    });
    const modeBuckets: Record<DecisionMode, Bucket> = {
      conservative: emptyBucket(),
      balanced:     emptyBucket(),
      aggressive:   emptyBucket(),
    };

    for (const d of snap.docs) {
      const data = d.data() as DecisionRecord;
      const ref = data.predictionPromptRef;
      if (!ref?.id || !ref.version) continue;

      // v2.9 stability guard: skip explicitly-invalid outcomes so degraded
      // data points don't pollute averages. Legacy records without the flag
      // (undefined) keep contributing — backward compatibility.
      if (data.isValid === false) continue;

      // updatedAt is the agent-bumped timestamp; outcomeRecordedAt is the
      // explicit feedback time. Prefer the latter when present so the
      // rolling-window rollback partitions by *outcome* time, not by save.
      const ts =
        data.outcomeRecordedAt?.toDate?.() ??
        data.updatedAt?.toDate?.() ??
        null;
      if (ts && ts < since) continue;

      // Window membership: drift accumulators always run within 60d. Primary
      // metrics gate on the caller-supplied windowDays.
      const ageMs = ts ? now - ts.getTime() : Infinity;
      const inLongWindow = ageMs <= DRIFT_LONG_DAYS * DAY_MS;
      const inShortWindow = ageMs <= DRIFT_SHORT_DAYS * DAY_MS;
      const inPrimary = ageMs <= windowDays * DAY_MS;
      // Skip if outside both — nothing to record.
      if (!inLongWindow && !inPrimary) continue;

      const key = bucketKey(ref.id, ref.version);
      const b = buckets.get(key) ?? {
        promptId: ref.id, promptVersion: ref.version,
        ...emptyBucket(),
      };
      if (inPrimary) b.runs += 1;

      const acc = Number(data.accuracyNorm);
      const accValid = Number.isFinite(acc);

      // v2.9 drift accumulators run regardless of windowDays so the 14d/60d
      // comparison stays absolute even when the caller asks for a smaller
      // primary window.
      if (accValid && inLongWindow) {
        b.longAccSum += acc; b.longAccCount += 1;
      }
      if (accValid && inShortWindow) {
        b.shortAccSum += acc; b.shortAccCount += 1;
      }

      const fin = Number(data.finalAccuracy);
      const cal = Number(data.calibrationError);
      const conf = Number(data.confidence);
      const explicitSuccess = typeof data.success === "boolean" ? data.success : null;
      // v2.5: prefer the explicit `success` boolean. Legacy records without
      // it fall back to the accuracyNorm >= 0.5 proxy so historical data
      // still contributes a hit-rate signal.
      const success = explicitSuccess ?? (accValid ? acc >= 0.5 : null);

      if (inPrimary) {
        if (accValid) { b.accSum += acc; b.accCount += 1; }
        if (Number.isFinite(fin)) { b.finalSum += fin; b.finalCount += 1; }
        if (Number.isFinite(cal)) { b.calibSum += cal; b.calibCount += 1; }
        if (Number.isFinite(conf)) { b.confSum += conf / 10; b.confCount += 1; }
        if (success !== null) {
          b.outcomes += 1;
          if (success) b.hits += 1;
        }
      }

      buckets.set(key, b);

      // v2.7: also fan out into the per-mode rollup. Using the same Bucket
      // shape lets us reuse the averaging code below without copy-pasting.
      // Mode buckets only count primary-window decisions to match the user-
      // facing semantics of windowDays.
      if (inPrimary) {
        const mode = data.decisionMode;
        if (mode && (DECISION_MODE_VALUES as readonly string[]).includes(mode)) {
          const mb = modeBuckets[mode as DecisionMode];
          mb.runs += 1;
          if (accValid) { mb.accSum += acc; mb.accCount += 1; }
          if (Number.isFinite(fin)) { mb.finalSum += fin; mb.finalCount += 1; }
          if (Number.isFinite(cal)) { mb.calibSum += cal; mb.calibCount += 1; }
          if (Number.isFinite(conf)) { mb.confSum += conf / 10; mb.confCount += 1; }
          if (success !== null) {
            mb.outcomes += 1;
            if (success) mb.hits += 1;
          }
        }
      }

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

    const ANOMALY_THRESHOLD = 0.10;
    const rows: PromptOutcomeMetricsRow[] = Array.from(buckets.values()).map((b) => {
      const shortTermAccuracy = b.shortAccCount > 0 ? b.shortAccSum / b.shortAccCount : null;
      const longTermAccuracy = b.longAccCount > 0 ? b.longAccSum / b.longAccCount : null;
      const dropFromLong =
        shortTermAccuracy !== null && longTermAccuracy !== null
          ? longTermAccuracy - shortTermAccuracy
          : null;
      const driftDetected = dropFromLong !== null && dropFromLong > DRIFT_THRESHOLD;
      const anomaly = dropFromLong !== null && dropFromLong > ANOMALY_THRESHOLD;
      return {
        promptId: b.promptId,
        promptVersion: b.promptVersion,
        runs: b.runs,
        avgAccuracyNorm: b.accCount > 0 ? b.accSum / b.accCount : null,
        avgFinalAccuracy: b.finalCount > 0 ? b.finalSum / b.finalCount : null,
        avgCalibrationError: b.calibCount > 0 ? b.calibSum / b.calibCount : null,
        avgPredictionConfidence: b.confCount > 0 ? b.confSum / b.confCount : null,
        hitRate: b.outcomes > 0 ? b.hits / b.outcomes : null,
        outcomesRecorded: b.outcomes,
        shortTermAccuracy,
        longTermAccuracy,
        driftDetected,
        anomaly,
      };
    });

    const modeBreakdown: ModeBreakdownRow[] = (DECISION_MODE_VALUES as ReadonlyArray<DecisionMode>).map((m) => {
      const mb = modeBuckets[m];
      return {
        mode: m,
        runs: mb.runs,
        outcomesRecorded: mb.outcomes,
        avgAccuracyNorm: mb.accCount > 0 ? mb.accSum / mb.accCount : null,
        hitRate: mb.outcomes > 0 ? mb.hits / mb.outcomes : null,
        avgCalibrationError: mb.calibCount > 0 ? mb.calibSum / mb.calibCount : null,
      };
    });

    return { rows, samplesByPromptId, modeBreakdown };
  } catch (error) {
    logFirestorePermissionHint("getPromptOutcomeMetrics", error);
    return { rows: [], samplesByPromptId: {}, modeBreakdown: [] };
  }
};

// v2.7 — decision mode (conservative / balanced / aggressive). Driven from
// the AutonomousModeView toggle, persisted globally per user, snapshotted on
// every decision the agent saves so future analysis can group by mode.
//
// Same shape as PredictionStrictness in the prompt registry — kept aliased
// at this boundary so the Firestore layer stays independent of the registry
// import graph.
export type DecisionMode = "conservative" | "balanced" | "aggressive";

const DEFAULT_DECISION_MODE: DecisionMode = "balanced";
const DECISION_MODE_VALUES: ReadonlyArray<DecisionMode> = ["conservative", "balanced", "aggressive"];

// v2.8: settings doc now carries { mode, auto } so the agent can pick between
// the user-selected mode and the system-recommended one. `auto` defaults to
// false so existing users keep manual control without an opt-in surprise.
export interface DecisionModeSettings {
  mode: DecisionMode;
  auto: boolean;
}

export const getDecisionModeSettings = async (userId: string): Promise<DecisionModeSettings> => {
  try {
    const snap = await getDoc(userSettingRef(userId, "decisionMode"));
    if (!snap.exists()) return { mode: DEFAULT_DECISION_MODE, auto: false };
    const data = snap.data() as { mode?: unknown; auto?: unknown };
    const mode = typeof data.mode === "string" && (DECISION_MODE_VALUES as readonly string[]).includes(data.mode)
      ? (data.mode as DecisionMode)
      : DEFAULT_DECISION_MODE;
    const auto = data.auto === true;
    return { mode, auto };
  } catch (error) {
    logFirestorePermissionHint("getDecisionModeSettings", error);
    return { mode: DEFAULT_DECISION_MODE, auto: false };
  }
};

export const setDecisionModeSettings = async (
  userId: string,
  patch: Partial<DecisionModeSettings>
): Promise<void> => {
  try {
    await setDoc(
      userSettingRef(userId, "decisionMode"),
      { ...patch, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (error) {
    logFirestorePermissionHint("setDecisionModeSettings", error);
  }
};

// Back-compat shims. New code should prefer the *Settings variants above.
export const getDecisionMode = async (userId: string): Promise<DecisionMode> => {
  const s = await getDecisionModeSettings(userId);
  return s.mode;
};

export const setDecisionMode = async (userId: string, mode: DecisionMode): Promise<void> => {
  await setDecisionModeSettings(userId, { mode });
};

// v2.8 mode-recommendation metadata.
// Persisted at users/{uid}/settings/decisionModeMeta to keep separate from
// the user-controlled `decisionMode` doc so writes from auto-mode logic
// don't clobber the user's manual selection.
//
// v3.0 explainability + safety:
//   previousMode/previousScore/delta/reason — captured each time the agent
//     auto-switches so the UI can answer "why did this change?"
//   freezeUntil/switchHistory — guard against thrashing: if more than two
//     switches happen in 14 days, the agent freezes the mode until freezeUntil.
export type SwitchReason = "accuracy" | "hit_rate" | "calibration";

export interface DecisionModeMeta {
  recommendedMode: DecisionMode;
  score: number;
  evaluatedAt: Timestamp | null;
  lastSwitchAt: Timestamp | null;
  // v3.0 explainability — populated only when a switch fires.
  previousMode?: DecisionMode | null;
  previousScore?: number | null;
  delta?: number | null;
  reason?: SwitchReason | null;
  // v3.0 safety guards.
  freezeUntil?: Timestamp | null;
  switchHistory?: Timestamp[];
}

export const getDecisionModeMeta = async (userId: string): Promise<DecisionModeMeta | null> => {
  try {
    const snap = await getDoc(userSettingRef(userId, "decisionModeMeta"));
    if (!snap.exists()) return null;
    const data = snap.data() as Partial<DecisionModeMeta>;
    const mode = typeof data.recommendedMode === "string" && (DECISION_MODE_VALUES as readonly string[]).includes(data.recommendedMode)
      ? (data.recommendedMode as DecisionMode)
      : DEFAULT_DECISION_MODE;
    const score = typeof data.score === "number" && Number.isFinite(data.score) ? data.score : 0;
    return {
      recommendedMode: mode,
      score,
      evaluatedAt: data.evaluatedAt ?? null,
      lastSwitchAt: data.lastSwitchAt ?? null,
    };
  } catch (error) {
    logFirestorePermissionHint("getDecisionModeMeta", error);
    return null;
  }
};

export const setDecisionModeMeta = async (
  userId: string,
  meta: {
    recommendedMode: DecisionMode;
    score: number;
    // When true, also writes lastSwitchAt and appends to switchHistory.
    markSwitched?: boolean;
    // v3.0 explainability — supply when markSwitched is true.
    previousMode?: DecisionMode | null;
    previousScore?: number | null;
    delta?: number | null;
    reason?: SwitchReason | null;
    // v3.0 safety. Caller is responsible for computing freezeUntil and the
    // updated switchHistory; persisting both is fire-and-forget.
    freezeUntil?: Date | null;
    switchHistoryDates?: Date[] | null;
  }
): Promise<void> => {
  try {
    const payload: Record<string, unknown> = {
      recommendedMode: meta.recommendedMode,
      score: meta.score,
      evaluatedAt: serverTimestamp(),
    };
    if (meta.markSwitched) {
      payload.lastSwitchAt = serverTimestamp();
      if (meta.previousMode !== undefined) payload.previousMode = meta.previousMode;
      if (meta.previousScore !== undefined) payload.previousScore = meta.previousScore;
      if (meta.delta !== undefined) payload.delta = meta.delta;
      if (meta.reason !== undefined) payload.reason = meta.reason;
    }
    if (meta.freezeUntil !== undefined) {
      payload.freezeUntil = meta.freezeUntil ? FsTimestamp.fromDate(meta.freezeUntil) : null;
    }
    if (meta.switchHistoryDates !== undefined && meta.switchHistoryDates !== null) {
      payload.switchHistory = meta.switchHistoryDates.map((d) => FsTimestamp.fromDate(d));
    }
    await setDoc(userSettingRef(userId, "decisionModeMeta"), payload, { merge: true });
  } catch (error) {
    logFirestorePermissionHint("setDecisionModeMeta", error);
  }
};

// v2.8 — pure recommendation logic. Run against modeBreakdown[] from
// getPromptOutcomeMetrics; deterministic, no I/O, no LLM.
//
// Composite score:
//   0.6 × accuracy + 0.3 × hitRate + 0.1 × (1 − calibrationError)
// Filter: a mode must have ≥15 runs and ≥10 recorded outcomes to be eligible.
// When no mode qualifies the recommendation falls back to "balanced".
export interface ModeRecommendation {
  recommendedMode: DecisionMode;
  score: number;
  qualified: boolean;                              // true if at least one mode met thresholds
  scoresPerMode: Partial<Record<DecisionMode, number>>;
}

const MIN_RUNS_FOR_RECOMMENDATION = 15;
const MIN_OUTCOMES_FOR_RECOMMENDATION = 10;

export function recommendDecisionMode(modeBreakdown: ModeBreakdownRow[]): ModeRecommendation {
  const scoresPerMode: Partial<Record<DecisionMode, number>> = {};
  for (const m of modeBreakdown) {
    if (m.runs < MIN_RUNS_FOR_RECOMMENDATION) continue;
    if (m.outcomesRecorded < MIN_OUTCOMES_FOR_RECOMMENDATION) continue;
    if (m.avgAccuracyNorm === null || m.hitRate === null) continue;
    const calibrationComponent = 1 - (m.avgCalibrationError ?? 0);
    scoresPerMode[m.mode] = 0.6 * m.avgAccuracyNorm + 0.3 * m.hitRate + 0.1 * calibrationComponent;
  }

  let bestMode: DecisionMode | null = null;
  let bestScore = -Infinity;
  for (const mode of DECISION_MODE_VALUES) {
    const s = scoresPerMode[mode];
    if (typeof s === "number" && s > bestScore) {
      bestMode = mode;
      bestScore = s;
    }
  }

  if (bestMode === null) {
    return { recommendedMode: "balanced", score: 0, qualified: false, scoresPerMode };
  }
  return { recommendedMode: bestMode, score: bestScore, qualified: true, scoresPerMode };
}

// v3.0 — explainability. Given current and recommended mode rows from
// modeBreakdown, return the dominant factor that drove the score delta plus
// the raw percentage-point improvement on that factor. Weights mirror the
// score formula in recommendDecisionMode (0.6/0.3/0.1).
//
// Returns null when neither mode has data or the recommendation has no
// positive driver (in which case the agent shouldn't be switching anyway).
export function computeSwitchReason(
  currentMode: DecisionMode,
  recommendedMode: DecisionMode,
  modeBreakdown: ModeBreakdownRow[]
): { reason: SwitchReason; deltaPct: number } | null {
  const cur = modeBreakdown.find((m) => m.mode === currentMode);
  const rec = modeBreakdown.find((m) => m.mode === recommendedMode);
  if (!cur || !rec) return null;

  const accDelta = (rec.avgAccuracyNorm ?? 0) - (cur.avgAccuracyNorm ?? 0);
  const hitDelta = (rec.hitRate ?? 0) - (cur.hitRate ?? 0);
  // Lower calibrationError = better, so flip the sign for "improvement".
  const calibImprovement = (cur.avgCalibrationError ?? 0) - (rec.avgCalibrationError ?? 0);

  const candidates: Array<{ reason: SwitchReason; weighted: number; rawDelta: number }> = [
    { reason: "accuracy", weighted: 0.6 * accDelta, rawDelta: accDelta },
    { reason: "hit_rate", weighted: 0.3 * hitDelta, rawDelta: hitDelta },
    { reason: "calibration", weighted: 0.1 * calibImprovement, rawDelta: calibImprovement },
  ];
  candidates.sort((a, b) => b.weighted - a.weighted);

  const top = candidates[0];
  if (top.weighted <= 0) return null;
  return { reason: top.reason, deltaPct: Math.round(top.rawDelta * 100) };
}

// v3.0 — switch-frequency safety guard. Returns true when the agent is
// currently in a freeze window OR the user has switched ≥ MAX_SWITCHES_IN_WINDOW
// times in the last MAX_SWITCHES_WINDOW_DAYS. The caller should treat both
// states as "do not switch" and refresh freezeUntil if the second condition
// just kicked in.
export const MAX_SWITCHES_IN_WINDOW = 2;
export const MAX_SWITCHES_WINDOW_DAYS = 14;
export const FREEZE_DURATION_DAYS = 14;

export function isSwitchFrozen(freezeUntil: Date | null): boolean {
  if (!freezeUntil) return false;
  return freezeUntil.getTime() > Date.now();
}

export function countRecentSwitches(history: Date[]): number {
  const cutoff = Date.now() - MAX_SWITCHES_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return history.filter((d) => d.getTime() >= cutoff).length;
}

// v2.8 — hysteresis guard. Returns true only when:
//   1. recommended differs from current
//   2. recommended score beats current's score by ≥ 0.03
//   3. >= 7 days since the last automated switch
// Prevents thrashing when mode performance is essentially tied.
const SWITCH_THRESHOLD = 0.03;
const SWITCH_COOLDOWN_DAYS = 7;

export function shouldSwitchMode(
  currentMode: DecisionMode,
  recommendation: ModeRecommendation,
  lastSwitchAt: Date | null
): boolean {
  if (!recommendation.qualified) return false;
  if (currentMode === recommendation.recommendedMode) return false;

  const currentScore = recommendation.scoresPerMode[currentMode];
  if (typeof currentScore !== "number") {
    // No data on the user's current mode yet — don't switch until we know
    // whether it's actually under-performing.
    return false;
  }
  if (recommendation.score < currentScore + SWITCH_THRESHOLD) return false;

  if (lastSwitchAt) {
    const daysSince = (Date.now() - lastSwitchAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < SWITCH_COOLDOWN_DAYS) return false;
  }
  return true;
}

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


