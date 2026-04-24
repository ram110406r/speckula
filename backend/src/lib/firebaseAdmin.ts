import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

let firebaseApp: App | undefined;

const formatPrivateKey = (rawKey: string): string => rawKey.replace(/\\n/g, '\n');

const required = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const getFirebaseApp = (): App => {
  if (firebaseApp) {
    return firebaseApp;
  }

  if (getApps().length > 0) {
    firebaseApp = getApps()[0];
    return firebaseApp;
  }

  firebaseApp = initializeApp({
    credential: cert({
      projectId: required('FIREBASE_PROJECT_ID'),
      clientEmail: required('FIREBASE_CLIENT_EMAIL'),
      privateKey: formatPrivateKey(required('FIREBASE_PRIVATE_KEY')),
    }),
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
