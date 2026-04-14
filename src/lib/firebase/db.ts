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

export interface BuildcaseDocument {
  id: string;
  title: string;
  content: any; // TipTap JSON
  userId: string;
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

export interface ExecutionTask {
  id?: string;
  title: string;
  status: "todo" | "in-progress" | "done";
  priority: "high" | "medium" | "low";
  milestone?: string;
  userId: string;
  updatedAt: Timestamp | null;
}

// Path Helpers
const userDocsCollection = (userId: string) => collection(db, "users", userId, "documents");
const userInsightsCollection = (userId: string) => collection(db, "users", userId, "insights");
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
    return [];
  }
};

// --- INSIGHTS ACTIONS ---

export const saveInsight = async (userId: string, data: Omit<Insight, "userId" | "createdAt">) => {
  await addDoc(userInsightsCollection(userId), { ...data, userId, createdAt: serverTimestamp() });
};

export const getInsights = async (userId: string) => {
  const q = query(userInsightsCollection(userId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Insight[];
};

// --- PRD ACTIONS ---

export const savePRD = async (userId: string, data: Omit<PRD, "userId" | "updatedAt">) => {
  await addDoc(userPrdsCollection(userId), { ...data, userId, updatedAt: serverTimestamp() });
};

export const getPRDs = async (userId: string) => {
  const q = query(userPrdsCollection(userId), orderBy("updatedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as PRD[];
};

// --- TASKS ACTIONS ---

export const saveTask = async (userId: string, data: Omit<ExecutionTask, "userId" | "updatedAt">) => {
  await addDoc(userTasksCollection(userId), { ...data, userId, updatedAt: serverTimestamp() });
};

export const updateTask = async (userId: string, taskId: string, data: Partial<ExecutionTask>) => {
  const ref = doc(db, "users", userId, "tasks", taskId);
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
};

export const getTasks = async (userId: string) => {
  const q = query(userTasksCollection(userId), orderBy("updatedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as ExecutionTask[];
};


