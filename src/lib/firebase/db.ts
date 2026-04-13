import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query,
  orderBy, 
  serverTimestamp,
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

// Path: /users/{userId}/documents/{docId}
// This matches the Firestore security rules in firestore.rules
const userDocsCollection = (userId: string) =>
  collection(db, "users", userId, "documents");

const userDocRef = (userId: string, docId: string) =>
  doc(db, "users", userId, "documents", docId);

export const saveDocument = async (
  userId: string,
  docId: string,
  data: Partial<BuildcaseDocument>
) => {
  const ref = userDocRef(userId, docId);
  await setDoc(
    ref,
    {
      ...data,
      userId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const getDocument = async (userId: string, docId: string) => {
  const ref = userDocRef(userId, docId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as BuildcaseDocument;
  }
  return null;
};

export const getUserDocuments = async (userId: string) => {
  const q = query(
    userDocsCollection(userId),
    orderBy("updatedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as BuildcaseDocument[];
};
