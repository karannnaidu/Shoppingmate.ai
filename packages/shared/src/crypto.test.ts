import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './crypto.js';

const KEY = 'a'.repeat(64); // 32 bytes as hex

describe('encryptSecret / decryptSecret', () => {
  const prev = process.env.SECRET_ENC_KEY;
  beforeAll(() => {
    process.env.SECRET_ENC_KEY = KEY;
  });
  afterAll(() => {
    if (prev === undefined) delete process.env.SECRET_ENC_KEY;
    else process.env.SECRET_ENC_KEY = prev;
  });

  it('round-trips a secret', () => {
    const secret = 'shpat_abc123-the-offline-token';
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });

  it('rejects a tampered ciphertext (GCM auth)', () => {
    const enc = encryptSecret('secret');
    const tampered = `${enc.slice(0, -2)}00`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('throws when the key is the wrong length', () => {
    process.env.SECRET_ENC_KEY = 'tooshort';
    expect(() => encryptSecret('x')).toThrow();
    process.env.SECRET_ENC_KEY = KEY;
  });
});
