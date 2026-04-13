import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
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
  updatedAt: Timestamp | any;
  createdAt: Timestamp | any;
}

const DOCUMENTS_COLLECTION = "documents";

export const saveDocument = async (userId: string, docId: string, data: Partial<BuildcaseDocument>) => {
  const docRef = doc(db, DOCUMENTS_COLLECTION, docId);
  await setDoc(docRef, {
    ...data,
    userId,
    updatedAt: serverTimestamp(),
    // Only set createdAt if it's a new document (needs check or merge logic)
  }, { merge: true });
};

export const getDocument = async (docId: string) => {
  const docRef = doc(db, DOCUMENTS_COLLECTION, docId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as BuildcaseDocument;
  }
  return null;
};

export const getUserDocuments = async (userId: string) => {
  const q = query(
    collection(db, DOCUMENTS_COLLECTION),
    where("userId", "==", userId),
    orderBy("updatedAt", "desc")
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as BuildcaseDocument[];
};
