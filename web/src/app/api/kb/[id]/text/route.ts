import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { brandKbDocuments } from '@shoppingmate/db/schema';
import { getDashboardSession } from '@/lib/session';
import { enqueueKbIngest } from '@/lib/queue';

async function ownedDoc(merchantId: string, id: string) {
  const [doc] = await db
    .select()
    .from(brandKbDocuments)
    .where(and(eq(brandKbDocuments.id, id), eq(brandKbDocuments.merchantId, merchantId)))
    .limit(1);
  return doc ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const doc = await ownedDoc(session.merchant.id, id);
  if (!doc) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({
    text: doc.extractedText ?? '',
    status: doc.status,
    filename: doc.filename,
  });
}

const Body = z.object({ text: z.string().max(200_000) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const doc = await ownedDoc(session.merchant.id, id);
  if (!doc) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid text' }, { status: 400 });

  // Save the edited text as the new source of truth and re-ingest immediately:
  // the worker re-chunks from extractedText (see ingestKbDoc) and replaces the
  // doc's chunks, so the bot uses the correction within seconds.
  await db
    .update(brandKbDocuments)
    .set({ extractedText: parsed.data.text, status: 'processing', errorMessage: null })
    .where(eq(brandKbDocuments.id, id));
  await enqueueKbIngest(id);

  return NextResponse.json({ ok: true });
}
