import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { getDashboardSession } from '@/lib/session';

const Body = z.object({ url: z.string().url() });

export async function POST(req: Request) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid url' }, { status: 400 });

  await db.update(merchants).set({
    domain: new URL(parsed.data.url).host,
    adapterConfig: { type: 'dom_pending', source_url: parsed.data.url },
    status: 'onboarding',
  }).where(eq(merchants.id, session.merchant.id));

  return NextResponse.json({ ok: true });
}
