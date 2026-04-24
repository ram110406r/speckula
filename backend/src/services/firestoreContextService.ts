import { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getFirebaseFirestore } from '../lib/firebaseAdmin.js';

type FirestoreDoc = QueryDocumentSnapshot<Record<string, unknown>>;

const toText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return '';
};

const mapDocumentToText = (doc: FirestoreDoc): string => {
  const data = doc.data();
  const title = toText(data.title);
  const content = toText(data.content);
  return [title, content].filter(Boolean).join('\n');
};

export const firestoreContextService = {
  async getDocumentContent(userId: string, noteId: string): Promise<string | null> {
    const firestore = getFirebaseFirestore();
    const snapshot = await firestore
      .collection('users')
      .doc(userId)
      .collection('documents')
      .doc(noteId)
      .get();

    if (!snapshot.exists) {
      return null;
    }

    return mapDocumentToText(snapshot as FirestoreDoc);
  },

  async getProjectContext(userId: string, limit = 20): Promise<{ notes: string; decisions: string }> {
    const firestore = getFirebaseFirestore();
    const notesSnapshot = await firestore
      .collection('users')
      .doc(userId)
      .collection('documents')
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .get();

    const decisionsSnapshot = await firestore
      .collection('users')
      .doc(userId)
      .collection('decisions')
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .get();

    const notes = notesSnapshot.docs.map((doc) => mapDocumentToText(doc as FirestoreDoc)).join('\n\n');
    const decisions = decisionsSnapshot.docs
      .map((doc) => {
        const data = doc.data();
        const title = toText(data.title);
        const justification = toText(data.justification);
        const tradeoffs = toText(data.tradeoffs);
        return [title, justification, tradeoffs].filter(Boolean).join('\n');
      })
      .join('\n\n');

    return { notes, decisions };
  },
};
