// Validates all required Next.js environment variables at module load time.
// Import this at the top of any server-side file that needs env vars.
// A missing var throws immediately — catching the error at build/startup,
// not silently at the first user request.

const required = (name: string): string => {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `[env] Missing required environment variable: ${name}\n` +
        `  Add it to .env.local (development) or your deployment platform secrets (production).`
    );
  }
  return value;
};

// ── Firebase Web SDK (NEXT_PUBLIC_* — baked in at build time) ─────────────────
// These are exposed to the browser bundle. They identify the Firebase project
// but do not grant any access on their own — Firestore rules enforce auth.
export const firebaseConfig = {
  apiKey:            required('NEXT_PUBLIC_FIREBASE_API_KEY'),
  authDomain:        required('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId:         required('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket:     required('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: required('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId:             required('NEXT_PUBLIC_FIREBASE_APP_ID'),
} as const;

// ── Server-side only ──────────────────────────────────────────────────────────
// BACKEND_URL is NOT prefixed with NEXT_PUBLIC_ — it must never appear in the
// browser bundle. Only the Next.js API proxy routes (src/app/api/*/route.ts)
// may import this.
export const getBackendUrl = (): string =>
  process.env.BACKEND_URL ?? 'http://localhost:3001';
