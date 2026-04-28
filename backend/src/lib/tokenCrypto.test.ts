import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Use a deterministic test key. Real prod values must be longer/randomer.
const TEST_KEY = 'test-encryption-key-with-enough-entropy-1234567890abcdef';

describe('tokenCrypto', () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.SLACK_TOKEN_ENCRYPTION_KEY;
    process.env.SLACK_TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.SLACK_TOKEN_ENCRYPTION_KEY;
    } else {
      process.env.SLACK_TOKEN_ENCRYPTION_KEY = originalKey;
    }
  });

  it('round-trips a plaintext token', async () => {
    const { encryptToken, decryptToken } = await import('./tokenCrypto.js');
    const plaintext = 'xoxb-fake-bot-token-1234567890';
    const encrypted = encryptToken(plaintext);

    expect(encrypted).toBeTypeOf('string');
    expect(encrypted).not.toBe(plaintext);
    expect(decryptToken(encrypted)).toBe(plaintext);
  });

  it('produces different ciphertexts for the same plaintext (random IV)', async () => {
    const { encryptToken } = await import('./tokenCrypto.js');
    const a = encryptToken('xoxb-token');
    const b = encryptToken('xoxb-token');
    expect(a).not.toBe(b);
  });

  it('rejects tampered ciphertext', async () => {
    const { encryptToken, decryptToken } = await import('./tokenCrypto.js');
    const encrypted = encryptToken('xoxb-token');
    // Flip a byte mid-ciphertext.
    const tampered = encrypted.slice(0, -2) + (encrypted.slice(-2) === 'AA' ? 'BB' : 'AA');
    expect(() => decryptToken(tampered)).toThrow();
  });

  it('throws when the key is missing', async () => {
    delete process.env.SLACK_TOKEN_ENCRYPTION_KEY;
    // Re-import so the module reads the env afresh.
    const fresh = await import('./tokenCrypto?missing-key=' + Date.now());
    expect(() => fresh.encryptToken('x')).toThrow();
  });

  it('throws when the key is too short', async () => {
    process.env.SLACK_TOKEN_ENCRYPTION_KEY = 'short';
    const fresh = await import('./tokenCrypto?short-key=' + Date.now());
    expect(() => fresh.encryptToken('x')).toThrow();
  });
});
