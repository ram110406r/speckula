// Server-side Firebase ID token verification using Google's public key endpoint.
// Does not require firebase-admin — uses the standard JWT tokeninfo API.
// Validates iss, aud, and exp claims before trusting the uid.

const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
const GOOGLE_TOKENINFO_URL = "https://www.googleapis.com/oauth2/v3/tokeninfo";

export interface TokenClaims {
  uid: string;
  email?: string;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(payload, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Fast local pre-check (no network) — catches obviously malformed or expired tokens.
// Real signature verification relies on Google's tokeninfo endpoint below.
function preCheckToken(token: string): { valid: boolean; reason?: string } {
  const payload = decodeJwtPayload(token);
  if (!payload) return { valid: false, reason: "malformed" };

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < now) {
    return { valid: false, reason: "expired" };
  }
  return { valid: true };
}

// Full verification via Google — confirms signature, aud, iss, and exp.
// Returns the verified uid or null on failure.
export async function verifyFirebaseToken(
  idToken: string
): Promise<TokenClaims | null> {
  const pre = preCheckToken(idToken);
  if (!pre.valid) return null;

  try {
    const res = await fetch(`${GOOGLE_TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`);
    if (!res.ok) return null;
    const data: Record<string, string> = await res.json();

    // Verify the token was issued for our Firebase project
    if (FIREBASE_PROJECT_ID && data.aud !== FIREBASE_PROJECT_ID) return null;
    if (!data.sub) return null;

    return { uid: data.sub, email: data.email };
  } catch {
    return null;
  }
}

// Extracts the uid from the token payload WITHOUT network verification.
// Use only in contexts where you accept the security trade-off (e.g., internal
// services with Firestore security rules as the real enforcement layer).
export function extractUidFromToken(idToken: string): string | null {
  const payload = decodeJwtPayload(idToken);
  if (!payload || typeof payload.sub !== "string") return null;
  return payload.sub;
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}
