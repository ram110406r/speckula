// Validates all required Next.js environment variables at module load time.
// Import this at the top of any server-side file that needs env vars.
// A missing var throws immediately — catching the error at build/startup,
// not silently at the first user request.

// Validate Firebase configuration at startup (dev only).
// In production the vars are baked into the bundle at docker build time as
// ARG values — they don't exist in process.env at runtime, so checking them
// would always appear missing. Let Firebase's own SDK surface bad config.
const validateFirebaseConfig = () => {
  if (process.env.NODE_ENV === 'production') return;

  const requiredVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
  ];

  const missing = requiredVars.filter(v => !process.env[v] || process.env[v]?.trim() === '');
  if (missing.length > 0 && process.env.NODE_ENV !== 'test') {
    console.warn(
      `[env] Missing Firebase configuration: ${missing.join(', ')}\n` +
      `  Copy .env.local.example to .env.local and fill in your values from Firebase Console.`
    );
  }
};

// Only run client-side in development — server-side API routes don't use
// Firebase, and the production browser bundle has the values inlined by
// the Docker build (not available via process.env at runtime).
if (typeof window !== 'undefined') {
  validateFirebaseConfig();
}

// ── Firebase Web SDK (NEXT_PUBLIC_* — baked in at build time) ─────────────────
// Next.js inlines these into the browser bundle at compile time; they are
// not available via process.env at runtime on the client. We read them
// directly rather than through required() to avoid throwing at module
// evaluation time when .env.local is not yet configured — Firebase's own
// initializeApp will surface a clear error if a key is empty.
export const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
} as const;

// ── Server-side only ──────────────────────────────────────────────────────────
// BACKEND_URL is NOT prefixed with NEXT_PUBLIC_ — it must never appear in the
// browser bundle. Only the Next.js API proxy routes (src/app/api/*/route.ts)
// may import this.
export function backendUrl(): string {
  if (typeof window !== 'undefined') return ''; // client bundle — never reached
  const url = process.env.BACKEND_URL;
  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[env] BACKEND_URL is required in production. Add it to your deployment platform secrets.');
    }
    return 'http://localhost:3001';
  }
  if (url.endsWith('/')) {
    throw new Error('[env] BACKEND_URL must not have a trailing slash');
  }
  return url;
}
