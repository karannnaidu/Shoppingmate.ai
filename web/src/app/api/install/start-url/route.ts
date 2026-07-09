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

  const host = new URL(parsed.data.url).host;
  // The widget reports window.location.host to /v1/install, which rejects any
  // domain not in allowedDomains. Seed the allowlist from the store the merchant
  // just entered (bare + www variants) so the install actually enqueues
  // onboarding instead of 403-ing. Merge with anything already present.
  const bare = host.replace(/^www\./, '');
  const wanted = [host, bare, `www.${bare}`];
  const [existing] = await db
    .select({ allowedDomains: merchants.allowedDomains })
    .from(merchants)
    .where(eq(merchants.id, session.merchant.id))
    .limit(1);
  const allowedDomains = Array.from(new Set([...(existing?.allowedDomains ?? []), ...wanted]));

  // Record the store + allowlist, but do NOT flip status to 'onboarding' here:
  // nextInstallAction() treats 'onboarding' as "already in progress" and no-ops,
  // so pre-setting it would stop the widget's /v1/install from ever enqueuing
  // the worker (the store would stay catalog-less forever). The wizard advances
  // by `domain` now, not status; the real onboarding is enqueued when the widget
  // first loads and calls /v1/install.
  await db.update(merchants).set({
    domain: host,
    allowedDomains,
    adapterConfig: { type: 'dom_pending', source_url: parsed.data.url },
  }).where(eq(merchants.id, session.merchant.id));

  return NextResponse.json({ ok: true });
}
