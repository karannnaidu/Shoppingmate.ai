import { describe, expect, it } from 'vitest';
import { users, sessions, verifications } from '../../src/schema/auth';

describe('auth schema', () => {
  it('users table has required columns', () => {
    expect(users.id).toBeDefined();
    expect(users.email).toBeDefined();
    expect(users.emailVerified).toBeDefined();
    expect(users.name).toBeDefined();
    expect(users.image).toBeDefined();
    expect(users.createdAt).toBeDefined();
    expect(users.updatedAt).toBeDefined();
  });

  it('sessions table has required columns', () => {
    expect(sessions.id).toBeDefined();
    expect(sessions.userId).toBeDefined();
    expect(sessions.expiresAt).toBeDefined();
    expect(sessions.token).toBeDefined();
    expect(sessions.ipAddress).toBeDefined();
    expect(sessions.userAgent).toBeDefined();
  });

  it('verifications table has required columns', () => {
    expect(verifications.id).toBeDefined();
    expect(verifications.identifier).toBeDefined();
    expect(verifications.value).toBeDefined();
    expect(verifications.expiresAt).toBeDefined();
  });
});
