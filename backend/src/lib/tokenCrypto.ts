import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// AES-256-GCM with versioned key management.
// Encrypted tokens are stored as JSON: { version, iv, authTag, ciphertext } — all hex.
// Key rotation: add ENCRYPTION_KEY_V2, update CURRENT_VERSION; old tokens decrypt via keyMap.

const ALGO = 'aes-256-gcm';
const CURRENT_VERSION = 'v1';

interface EncryptedPayload {
  version: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

export class TokenDecryptError extends Error {
  readonly code = 'TOKEN_DECRYPT_FAILED' as const;
  constructor(message: string) {
    super(message);
    this.name = 'TokenDecryptError';
  }
}

// Key lookup is lazy (no module-level caching) so test environments can swap
// SLACK_TOKEN_ENCRYPTION_KEY between tests without cache-busting module reimports.
// Accepts 64-char hex (preferred) or 44-char base64 (openssl rand -base64 32 output).
const getKey = (_version: string): Buffer => {
  const varName = 'SLACK_TOKEN_ENCRYPTION_KEY';
  const raw = process.env[varName];
  if (!raw) {
    throw new Error(
      `${varName} is not set. Generate with: ` +
        `node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"`
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  // Also accept base64-encoded 32-byte keys (openssl rand -base64 32 produces these).
  const buf = Buffer.from(raw, 'base64');
  if (buf.length === 32) {
    return buf;
  }
  throw new Error(`${varName} must be exactly 64 hex characters (32 bytes) or a valid base64-encoded 32-byte key.`);
};

export const encryptToken = (plaintext: string): string => {
  const key = getKey(CURRENT_VERSION);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload: EncryptedPayload = {
    version: CURRENT_VERSION,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext: ciphertext.toString('hex'),
  };
  return JSON.stringify(payload);
};

export const decryptToken = (stored: string): string => {
  // Parse the versioned JSON envelope.
  let payload: EncryptedPayload;
  try {
    payload = JSON.parse(stored) as EncryptedPayload;
  } catch {
    // Old base64-binary format or any non-JSON payload — treat as unrecoverable.
    throw new TokenDecryptError(
      'Stored token format is unrecognised. Re-connect your Slack workspace to refresh.'
    );
  }

  if (!payload.version || !payload.iv || !payload.authTag || !payload.ciphertext) {
    throw new TokenDecryptError(
      'Encrypted payload is missing required fields. Re-connect your Slack workspace.'
    );
  }

  try {
    const key = getKey(payload.version);
    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.authTag, 'hex');
    const ciphertext = Buffer.from(payload.ciphertext, 'hex');
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8');
  } catch (err) {
    if (err instanceof TokenDecryptError) throw err;
    // AES-GCM auth-tag mismatch = wrong key or tampered data.
    throw new TokenDecryptError(
      'Token decryption failed — encryption key may have changed. Re-connect your Slack workspace.'
    );
  }
};
