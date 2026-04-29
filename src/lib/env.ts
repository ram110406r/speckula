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
export const backendUrl = (() => {
  if (typeof window !== 'undefined') return ''; // client bundle — never reached
  const url = process.env.BACKEND_URL ?? 'http://localhost:3001';
  if (url.endsWith('/')) {
    throw new Error('[env] BACKEND_URL must not have a trailing slash');
  }
  return url;
})();
