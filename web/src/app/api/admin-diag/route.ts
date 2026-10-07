import { NextResponse } from 'next/server';

// TEMPORARY (removed right after): shapes of the admin env at runtime — lengths only, no values.
export const dynamic = 'force-dynamic';
export function GET() {
  const e = process.env.ADMIN_EMAIL ?? '';
  const h = process.env.ADMIN_PASSWORD_HASH ?? '';
  const s = process.env.ADMIN_SESSION_SECRET ?? '';
  return NextResponse.json({
    emailLen: e.length,
    emailFirst: e.charCodeAt(0),
    hashLen: h.length,
    hashParts: h.split(/[:$]/).map((p) => p.length),
    secretLen: s.length,
  });
}
