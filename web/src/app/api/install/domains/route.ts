import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { getDashboardSession } from '@/lib/session';

// Normalize a user-entered value to a bare hostname the widget will report as
// window.location.host (strip protocol, path, port; lowercase). Returns null
// for anything that isn't a plausible hostname.
function normalizeHost(input: string): string | null {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(s)) return null;
  return s;
}

export async function GET() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const [m] = await db
    .select({ allowedDomains: merchants.allowedDomains })
    .from(merchants)
    .where(eq(merchants.id, session.merchant.id))
    .limit(1);
  return NextResponse.json({ domains: m?.allowedDomains ?? [] });
}

const Body = z.object({ domains: z.array(z.string()).max(20) });

export async function POST(req: Request) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid domains' }, { status: 400 });

  const cleaned = Array.from(
    new Set(parsed.data.domains.map(normalizeHost).filter((d): d is string => d !== null)),
  );
  if (cleaned.length === 0) {
    return NextResponse.json({ error: 'add at least one valid domain (e.g. yourstore.com)' }, { status: 400 });
  }
  await db.update(merchants).set({ allowedDomains: cleaned }).where(eq(merchants.id, session.merchant.id));
  return NextResponse.json({ ok: true, domains: cleaned });
}
