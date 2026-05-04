import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { brandKbDocuments } from '@shoppingmate/db/schema';
import { presignKbUpload } from '@/lib/r2';
import { enqueueKbIngest } from '@/lib/queue';
import { getDashboardSession } from '@/lib/session';

const Body = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().min(1).max(10 * 1024 * 1024),
});

const ALLOWED_MIME = new Set([
  'application/pdf',
  'text/markdown',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export async function POST(req: Request) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (!ALLOWED_MIME.has(parsed.data.mimeType)) return NextResponse.json({ error: 'unsupported file type' }, { status: 400 });

  const key = `m/${session.merchant.id}/${Date.now()}-${parsed.data.filename}`;
  const uploadUrl = await presignKbUpload({ key, contentType: parsed.data.mimeType });

  const inserted = await db.insert(brandKbDocuments).values({
    merchantId: session.merchant.id,
    filename: parsed.data.filename,
    mimeType: parsed.data.mimeType,
    sizeBytes: parsed.data.sizeBytes,
    storageUrl: key,
    status: 'uploaded',
  }).returning();

  await enqueueKbIngest(inserted[0].id);

  return NextResponse.json({ upload_url: uploadUrl, document_id: inserted[0].id, key });
}
