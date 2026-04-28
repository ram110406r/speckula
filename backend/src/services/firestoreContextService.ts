import { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getFirebaseFirestore } from '../lib/firebaseAdmin.js';

type FirestoreDoc = QueryDocumentSnapshot<Record<string, unknown>>;

const MAX_TEXT_PER_DOC_CHARS = 4_000;
const MAX_TOTAL_CONTEXT_CHARS = 24_000;

// Render TipTap JSON content as plain text. JSON.stringify of a TipTap
// document wastes tokens on `{type:"paragraph"}` noise; this walks the tree
// and concatenates `text` nodes directly.
const tipTapToText = (node: unknown): string => {
  if (!node || typeof node !== 'object') return '';
  const n = node as Record<string, unknown>;
  if (typeof n.text === 'string') return n.text;
  const out: string[] = [];
  if (Array.isArray(n.content)) {
    for (const child of n.content) {
      out.push(tipTapToText(child));
    }
  }
  // Add a newline between block-level nodes for readability.
  const blockTypes = new Set([
    'paragraph', 'heading', 'bulletList', 'orderedList', 'listItem',
    'blockquote', 'codeBlock',
  ]);
  if (typeof n.type === 'string' && blockTypes.has(n.type)) {
    return out.join('') + '\n';
  }
  return out.join('');
};

const toText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    // TipTap doc shape: { type: 'doc', content: [...] }
    const tt = tipTapToText(value);
    if (tt.trim()) return tt;
    return JSON.stringify(value);
  }
  return '';
};

const truncate = (s: string, max: number): string =>
  s.length > max ? s.slice(0, max) + '\n…[truncated]' : s;

const mapDocumentToText = (doc: FirestoreDoc): string => {
  const data = doc.data();
  const title = toText(data.title);
  const content = toText(data.content);
  return truncate([title, content].filter(Boolean).join('\n'), MAX_TEXT_PER_DOC_CHARS);
};

// Concatenate strings until the total budget is hit, then stop. Earlier
// (more recent) docs win; older docs are dropped if they don't fit.
const concatBudgeted = (parts: string[], budget: number, sep: string): string => {
  const out: string[] = [];
  let used = 0;
  for (const p of parts) {
    if (!p) continue;
    if (used + p.length + sep.length > budget) {
      out.push('…[older entries truncated]');
      break;
    }
    out.push(p);
    used += p.length + sep.length;
  }
  return out.join(sep);
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

    const noteParts = notesSnapshot.docs.map((doc: FirestoreDoc) => mapDocumentToText(doc));
    const decisionParts = decisionsSnapshot.docs.map((doc: FirestoreDoc) => {
      const data = doc.data();
      const title = toText(data.title);
      const justification = toText(data.justification);
      const tradeoffs = toText(data.tradeoffs);
      return truncate([title, justification, tradeoffs].filter(Boolean).join('\n'), MAX_TEXT_PER_DOC_CHARS);
    });

    return {
      notes: concatBudgeted(noteParts, MAX_TOTAL_CONTEXT_CHARS, '\n\n'),
      decisions: concatBudgeted(decisionParts, MAX_TOTAL_CONTEXT_CHARS, '\n\n'),
    };
  },
};
