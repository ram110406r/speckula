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

  const existing = getApps();
  if (existing.length > 0) {
    firebaseApp = existing[0];
    return firebaseApp;
  }

  const projectId = required('FIREBASE_PROJECT_ID');
  const clientEmail = required('FIREBASE_CLIENT_EMAIL');

  // Accept base64-encoded key (FIREBASE_PRIVATE_KEY_B64) to avoid multiline
  // value issues in Docker/Dokploy .env file parsers.
  const rawKey = process.env.FIREBASE_PRIVATE_KEY_B64
    ? Buffer.from(process.env.FIREBASE_PRIVATE_KEY_B64, 'base64').toString('utf-8')
    : required('FIREBASE_PRIVATE_KEY');
  const privateKey = formatPrivateKey(rawKey);
  validatePrivateKeyShape(privateKey);

  firebaseApp = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });

  return firebaseApp;
};

// In-memory cache for token verification results (revocation status).
// TTL: 30 seconds. Limits the window in which a revoked/disabled account can
// still make authenticated requests before the cache expires and Firebase
// re-checks revocation status (checkRevoked: true).
interface CachedTokenVerification {
  decoded: any;
  expiresAt: number;
}
const tokenVerificationCache = new Map<string, CachedTokenVerification>();
const TOKEN_CACHE_TTL_MS = 30 * 1000; // 30 seconds

const cleanExpiredTokens = () => {
  const now = Date.now();
  for (const [token, cached] of tokenVerificationCache.entries()) {
    if (cached.expiresAt < now) {
      tokenVerificationCache.delete(token);
    }
  }
  // Emergency cleanup if map grows too large
  if (tokenVerificationCache.size > 10000) {
    tokenVerificationCache.clear();
  }
};

// Periodically clean expired entries (every 5 minutes in production)
if (typeof global !== 'undefined' && !(global as any).tokenCleanupIntervalId) {
  (global as any).tokenCleanupIntervalId = setInterval(
    cleanExpiredTokens,
    5 * 60 * 1000
  );
}

export const verifyFirebaseIdToken = async (idToken: string) => {
  const app = getFirebaseApp();
  const now = Date.now();
  
  // Check cache first (revocation status within 30 seconds)
  const cached = tokenVerificationCache.get(idToken);
  if (cached && cached.expiresAt > now) {
    return cached.decoded;
  }
  
  // Cache miss or expired — verify with Firebase (network call)
  // checkRevoked: true rejects tokens for disabled/revoked accounts
  const decoded = await getAuth(app).verifyIdToken(idToken, true);
  
  // Cache the successful verification
  tokenVerificationCache.set(idToken, {
    decoded,
    expiresAt: now + TOKEN_CACHE_TTL_MS,
  });
  
  return decoded;
};

// Call this on explicit logout to immediately invalidate the cached token,
// rather than waiting for the 30-second TTL to expire.
export const invalidateTokenCache = (idToken: string): void => {
  tokenVerificationCache.delete(idToken);
};

export const getFirebaseFirestore = (): Firestore => {
  const app = getFirebaseApp();
  return getFirestore(app);
};
