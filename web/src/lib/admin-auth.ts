import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

// Internal admin login for the shoppingmate team (brand tickets) — separate
// from brand owners' magic-link accounts, so nothing internal ever shows in a
// customer's dashboard.
//   ADMIN_EMAIL           login email (comma-separated for several admins)
//   ADMIN_PASSWORD_HASH   scrypt:<saltHex>:<hashHex>  (see hashAdminPassword). Not
//                         "$"-separated: env loading expanded "$..." and mangled it.
//   ADMIN_SESSION_SECRET  HMAC key for the session cookie

export const ADMIN_COOKIE = 'sm_admin';
const SESSION_MS = 8 * 60 * 60 * 1000;

const env = (k: string) => process.env[k]?.replace(/^﻿/, '').trim() ?? '';

export function hashAdminPassword(password: string, saltHex: string): string {
  return `scrypt:${saltHex}:${scryptSync(password, Buffer.from(saltHex, 'hex'), 32).toString('hex')}`;
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function verifyAdminCredentials(email: string, password: string): boolean {
  const allowed = env('ADMIN_EMAIL').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  const [scheme, salt, hash] = env('ADMIN_PASSWORD_HASH').split(/[:$]/);
  if (!allowed.length || scheme !== 'scrypt' || !salt || !hash) return false;
  const emailOk = allowed.includes(email.trim().toLowerCase());
  // Always run the hash so timing doesn't reveal whether the email matched.
  const passOk = safeEqual(hashAdminPassword(password, salt), `scrypt:${salt}:${hash}`);
  return emailOk && passOk;
}

function sign(payload: string): string {
  return createHmac('sha256', env('ADMIN_SESSION_SECRET')).update(payload).digest('base64url');
}

export function makeAdminToken(email: string, now = Date.now()): string {
  const payload = `${Buffer.from(email.toLowerCase()).toString('base64url')}.${now + SESSION_MS}`;
  return `${payload}.${sign(payload)}`;
}

export function readAdminToken(token: string | undefined, now = Date.now()): { email: string } | null {
  if (!token || !env('ADMIN_SESSION_SECRET')) return null;
  const [e, exp, sig] = token.split('.');
  if (!e || !exp || !sig || !safeEqual(sign(`${e}.${exp}`), sig)) return null;
  if (!(Number(exp) > now)) return null;
  return { email: Buffer.from(e, 'base64url').toString() };
}

export async function getAdminSession(): Promise<{ email: string } | null> {
  return readAdminToken((await cookies()).get(ADMIN_COOKIE)?.value);
}

export async function setAdminSession(email: string): Promise<void> {
  (await cookies()).set(ADMIN_COOKIE, makeAdminToken(email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_MS / 1000,
  });
}

export async function clearAdminSession(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}
