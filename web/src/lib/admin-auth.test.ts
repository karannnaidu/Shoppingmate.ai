import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hashAdminPassword, makeAdminToken, readAdminToken, verifyAdminCredentials } from './admin-auth';

describe('admin auth', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.ADMIN_EMAIL = 'admin@shoppingmate.ai';
    process.env.ADMIN_PASSWORD_HASH = hashAdminPassword('correct horse', 'a1b2c3d4e5f60718');
    process.env.ADMIN_SESSION_SECRET = 'test-secret';
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it('accepts only the right email + password', () => {
    expect(verifyAdminCredentials('Admin@Shoppingmate.ai ', 'correct horse')).toBe(true);
    expect(verifyAdminCredentials('admin@shoppingmate.ai', 'wrong')).toBe(false);
    expect(verifyAdminCredentials('owner@brand.com', 'correct horse')).toBe(false);
  });

  it('refuses everything when not configured', () => {
    delete process.env.ADMIN_PASSWORD_HASH;
    expect(verifyAdminCredentials('admin@shoppingmate.ai', 'correct horse')).toBe(false);
  });

  it('session token: valid, tamper-proof, expires', () => {
    const t = makeAdminToken('admin@shoppingmate.ai', 1_000);
    expect(readAdminToken(t, 2_000)).toEqual({ email: 'admin@shoppingmate.ai' });
    expect(readAdminToken(t.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), 2_000)).toBeNull();
    expect(readAdminToken(t, 1_000 + 9 * 3600_000)).toBeNull();
    process.env.ADMIN_SESSION_SECRET = 'other';
    expect(readAdminToken(t, 2_000)).toBeNull();
  });
});
