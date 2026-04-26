import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// AES-256-GCM with a key derived from SLACK_TOKEN_ENCRYPTION_KEY (32 bytes after scrypt).
// We never store plaintext bot tokens in Firestore — only the IV+ciphertext+authTag bundle.

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

let cachedKey: Buffer | null = null;
const getKey = (): Buffer => {
  if (cachedKey) return cachedKey;
  const secret = process.env.SLACK_TOKEN_ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    throw new Error(
      'SLACK_TOKEN_ENCRYPTION_KEY must be set in backend/.env (>= 16 chars). Generate one with: openssl rand -base64 32'
    );
  }
  cachedKey = scryptSync(secret, 'buildcase-slack', 32);
  return cachedKey;
};

export const encryptToken = (plaintext: string): string => {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
};

export const decryptToken = (payload: string): string => {
  const key = getKey();
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf-8');
};
