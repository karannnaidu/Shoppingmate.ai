import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { getDashboardSession } from '@/lib/session';

// Must match the widget's POSITION_CLASSES (packages/widget/src/widget.ts).
// NOT exported: Next.js route files only allow HTTP-method + config exports.
const WIDGET_POSITIONS = [
  'bottom-right',
  'bottom-left',
  'bottom-center',
  'center-left',
  'center-right',
  'center',
  'top-right',
  'top-left',
] as const;

const WIDGET_SIZES = ['small', 'medium', 'large'] as const;

// Both fields optional so the form can save appearance in one call.
const Body = z.object({
  position: z.enum(WIDGET_POSITIONS).optional(),
  size: z.enum(WIDGET_SIZES).optional(),
});

export async function POST(req: Request) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success || (parsed.data.position === undefined && parsed.data.size === undefined)) {
    return NextResponse.json({ error: 'invalid position/size' }, { status: 400 });
  }

  const patch: { widgetPosition?: string; widgetSize?: string } = {};
  if (parsed.data.position !== undefined) patch.widgetPosition = parsed.data.position;
  if (parsed.data.size !== undefined) patch.widgetSize = parsed.data.size;

  await db.update(merchants).set(patch).where(eq(merchants.id, session.merchant.id));

  return NextResponse.json({ ok: true, ...patch });
}
