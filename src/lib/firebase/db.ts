import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc,
  query,
  orderBy, 
  serverTimestamp,
  addDoc,
  type Timestamp
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

export interface BuildcaseDocument {
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
  userId: string;
  createdAt: Timestamp | null;
}

export interface PRD {
  id?: string;
  title: string;
  content: string; // Markdown or text
  status: "draft" | "complete";
  userId: string;
  updatedAt: Timestamp | null;
}

export interface DecisionRecord {
  id?: string;
  title: string;
  justification: string;
  priority: "high" | "medium" | "low";
  impact: number;
  effort: number;
  userStory: string;
  tradeoffs: string;
  strategyTheme?: string | null;
  userId: string;
  createdAt: Timestamp | null;
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
  dependsOn?: string[]; // Array of task IDs this task depends on
  assignee?: string; // User ID or email of assigned team member
  userId: string;
  createdAt?: Timestamp | null;
  updatedAt: Timestamp | null;
}

// Path Helpers
const userDocsCollection = (userId: string) => collection(db, "users", userId, "documents");
const userInsightsCollection = (userId: string) => collection(db, "users", userId, "insights");
const userDecisionsCollection = (userId: string) => collection(db, "users", userId, "decisions");
const userPrdsCollection = (userId: string) => collection(db, "users", userId, "prds");
const userTasksCollection = (userId: string) => collection(db, "users", userId, "tasks");

const userDocRef = (userId: string, docId: string) => doc(db, "users", userId, "documents", docId);

// --- DOCUMENT ACTIONS ---

export const createDocument = async (userId: string, title: string = "Untitled Document") => {
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
};

export const saveDocument = async (userId: string, docId: string, data: Partial<BuildcaseDocument>) => {
  const ref = userDocRef(userId, docId);
  await setDoc(ref, { ...data, userId, updatedAt: serverTimestamp() }, { merge: true });
};

export const getDocument = async (userId: string, docId: string) => {
  const ref = userDocRef(userId, docId);
  const snap = await getDoc(ref);
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as BuildcaseDocument) : null;
};

export const deleteDocument = async (userId: string, docId: string) => {
  await deleteDoc(userDocRef(userId, docId));
};

export const getUserDocuments = async (userId: string) => {
  try {
    const q = query(userDocsCollection(userId), orderBy("updatedAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as BuildcaseDocument[];
  } catch (error) {
    console.error("Error fetching documents:", error);
    // Return empty array instead of throwing to allow graceful degradation
    return [];
  }
};

// --- INSIGHTS ACTIONS ---

export const saveInsight = async (userId: string, data: Omit<Insight, "userId" | "createdAt">) => {
  try {
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

// --- DECISION ACTIONS ---

export const saveDecision = async (userId: string, data: Omit<DecisionRecord, "userId" | "createdAt" | "updatedAt">) => {
  try {
    await addDoc(userDecisionsCollection(userId), {
      ...data,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    logFirestorePermissionHint("saveDecision", error);
    throw error;
  }
};

export const getDecisions = async (userId: string) => {
  const q = query(userDecisionsCollection(userId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as DecisionRecord[];
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
  const ref = doc(db, "users", userId, "tasks", taskId);
  const snap = await getDoc(ref);
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as ExecutionTask) : null;
};

export const getTasksByPRD = async (userId: string, prdId: string): Promise<ExecutionTask[]> => {
  const q = query(
    userTasksCollection(userId),
    orderBy("priority", "desc"),
    orderBy("updatedAt", "desc")
  );
  const snap = await getDocs(q);
  const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExecutionTask));
  return tasks.filter(t => t.prdId === prdId);
};

// --- USER INITIALIZATION ---

export const initializeUser = async (userId: string) => {
  try {
    const userRef = doc(db, "users", userId);
    
    // Use merge to create or update, avoiding permission issues with checking existence first
    await setDoc(userRef, {
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    
    console.log(`[initializeUser] Initialized user document for ${userId}`);
  } catch (error) {
    console.error(`[initializeUser] Failed to initialize user ${userId}:`, error);
    throw error;
  }
};


