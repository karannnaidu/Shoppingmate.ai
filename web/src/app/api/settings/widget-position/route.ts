import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { getDashboardSession } from '@/lib/session';

// Must match the widget's POSITION_CLASSES (packages/widget/src/widget.ts).
export const WIDGET_POSITIONS = [
  'bottom-right',
  'bottom-left',
  'bottom-center',
  'center-left',
  'center-right',
  'center',
  'top-right',
  'top-left',
] as const;

const Body = z.object({ position: z.enum(WIDGET_POSITIONS) });

export async function POST(req: Request) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid position' }, { status: 400 });

  await db
    .update(merchants)
    .set({ widgetPosition: parsed.data.position })
    .where(eq(merchants.id, session.merchant.id));

  return NextResponse.json({ ok: true, position: parsed.data.position });
}
