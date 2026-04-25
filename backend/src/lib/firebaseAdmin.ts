import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

let firebaseApp: App | undefined;

// Some env loaders preserve surrounding quotes; some encode newlines as \n
// (escape sequence) while others write actual line breaks. Normalize all of
// these to a real PEM block before handing the key to the Admin SDK.
const formatPrivateKey = (rawKey: string): string => {
  let key = rawKey.trim();
  // Strip wrapping single or double quotes if present.
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  // Normalize literal "\n" sequences to real newlines.
  key = key.replace(/\\n/g, '\n');
  return key;
};

const required = (key: string): string => {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const validatePrivateKeyShape = (key: string): void => {
  if (!key.includes('-----BEGIN') || !key.includes('-----END')) {
    throw new Error(
      'FIREBASE_PRIVATE_KEY does not look like a PEM block. Expected a value starting with "-----BEGIN PRIVATE KEY-----" — copy the full key from the service-account JSON, keeping the literal \\n line separators.'
    );
  }
};

export const getFirebaseApp = (): App => {
  if (firebaseApp) {
    return firebaseApp;
  }

  if (getApps().length > 0) {
    firebaseApp = getApps()[0];
    return firebaseApp;
  }

  const projectId = required('FIREBASE_PROJECT_ID');
  const clientEmail = required('FIREBASE_CLIENT_EMAIL');
  const privateKey = formatPrivateKey(required('FIREBASE_PRIVATE_KEY'));
  validatePrivateKeyShape(privateKey);

  firebaseApp = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });

  return firebaseApp;
};

export const verifyFirebaseIdToken = async (idToken: string) => {
  const app = getFirebaseApp();
  return getAuth(app).verifyIdToken(idToken);
};

export const getFirebaseFirestore = (): Firestore => {
  const app = getFirebaseApp();
  return getFirestore(app);
};
