import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { firebaseConfig } from "@/lib/env";

// Firebase service references — assigned in the try block below.
// They are always defined at runtime (browser + real server requests).
// The try-catch exists solely to let Next.js finish static prerendering
// when NEXT_PUBLIC_FIREBASE_* env vars haven't been set in the deployment
// platform yet. useEffect hooks (onAuthStateChanged etc.) don't run during
// prerender, so undefined auth/db here never reach actual Firebase calls.
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  if (process.env.NODE_ENV !== "test") {
    console.warn("[firebase/config] Initialization skipped (missing env vars during prerender):", (e as Error).message);
  }
}

export { app: app!, auth: auth!, db: db! };
