import { encryptToken, decryptToken, TokenDecryptError } from './tokenCrypto.js';

// 64-char hex = 32 bytes, valid for AES-256.
const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('tokenCrypto', () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.ENCRYPTION_KEY_V1;
    process.env.ENCRYPTION_KEY_V1 = TEST_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.ENCRYPTION_KEY_V1;
    } else {
      process.env.ENCRYPTION_KEY_V1 = originalKey;
    }
  });

  it('round-trips a plaintext token', () => {
    const plaintext = 'xoxb-fake-bot-token-1234567890';
    const encrypted = encryptToken(plaintext);

    expect(encrypted).toBeTypeOf('string');
    expect(encrypted).not.toBe(plaintext);
    expect(decryptToken(encrypted)).toBe(plaintext);
  });

  it('stores the payload as JSON with version/iv/authTag/ciphertext fields', () => {
    const encrypted = encryptToken('xoxb-token');
    const payload = JSON.parse(encrypted);
    expect(payload).toHaveProperty('version', 'v1');
    expect(payload).toHaveProperty('iv');
    expect(payload).toHaveProperty('authTag');
    expect(payload).toHaveProperty('ciphertext');
  });

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const a = encryptToken('xoxb-token');
    const b = encryptToken('xoxb-token');
    expect(a).not.toBe(b);
  });

  it('rejects tampered ciphertext', () => {
    const encrypted = encryptToken('xoxb-token');
    const payload = JSON.parse(encrypted) as { ciphertext: string };
    const ct = payload.ciphertext;
    payload.ciphertext = ct.slice(0, -2) + (ct.slice(-2) === 'aa' ? 'bb' : 'aa');
    expect(() => decryptToken(JSON.stringify(payload))).toThrow(TokenDecryptError);
  });

  it('throws TokenDecryptError for non-JSON payloads (old base64 format)', () => {
    expect(() => decryptToken('xoxb-old-base64-format==')).toThrow(TokenDecryptError);
  });

  it('throws when the key is missing', () => {
    delete process.env.ENCRYPTION_KEY_V1;
    expect(() => encryptToken('x')).toThrow('ENCRYPTION_KEY_V1 is not set');
  });

  it('throws when the key is wrong length', () => {
    process.env.ENCRYPTION_KEY_V1 = 'short';
    expect(() => encryptToken('x')).toThrow('64 hex characters');
  });

  it('throws when the key is not valid hex', () => {
    process.env.ENCRYPTION_KEY_V1 = 'z'.repeat(64); // not valid hex
    expect(() => encryptToken('x')).toThrow('64 hex characters');
  });
});
