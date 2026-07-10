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
const COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

// All fields optional so the appearance form can save everything in one call.
// Empty strings for label/greeting clear the override (fall back to defaults).
const Body = z.object({
  position: z.enum(WIDGET_POSITIONS).optional(),
  size: z.enum(WIDGET_SIZES).optional(),
  accent: z.string().max(32).optional(),
  label: z.string().max(40).optional(),
  greeting: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  const d = parsed.data;

  const patch: {
    widgetPosition?: string;
    widgetSize?: string;
    widgetAccent?: string | null;
    widgetLabel?: string | null;
    widgetGreeting?: string | null;
  } = {};
  if (d.position !== undefined) patch.widgetPosition = d.position;
  if (d.size !== undefined) patch.widgetSize = d.size;
  if (d.accent !== undefined) {
    const a = d.accent.trim();
    if (a !== '' && !COLOR_RE.test(a)) {
      return NextResponse.json({ error: 'accent must be a hex color like #16a34a' }, { status: 400 });
    }
    patch.widgetAccent = a === '' ? null : a;
  }
  if (d.label !== undefined) patch.widgetLabel = d.label.trim() === '' ? null : d.label.trim();
  if (d.greeting !== undefined) patch.widgetGreeting = d.greeting.trim() === '' ? null : d.greeting.trim();

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }
  await db.update(merchants).set(patch).where(eq(merchants.id, session.merchant.id));
  return NextResponse.json({ ok: true, ...patch });
}
