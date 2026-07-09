import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { brandKbDocuments } from '@shoppingmate/db/schema';
import { putKbObject } from '@/lib/r2';
import { enqueueKbIngest } from '@/lib/queue';
import { getDashboardSession } from '@/lib/session';

// Proxy the upload through our own server (browser -> here -> R2) so we never
// depend on a browser CORS policy on the R2 bucket. Vercel caps the request
// body at ~4.5MB, so we allow up to 4MB per file.
const MAX_BYTES = 4 * 1024 * 1024;

const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  md: 'text/markdown',
  txt: 'text/plain',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export async function POST(req: Request) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'expected a file upload' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'no file provided' }, { status: 400 });

  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  const mime = EXT_MIME[ext];
  if (!mime) {
    return NextResponse.json({ error: 'unsupported file type — use PDF, .docx, .md, or .txt' }, { status: 400 });
  }
  if (file.size === 0) return NextResponse.json({ error: 'file is empty' }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file too large (max 4 MB)' }, { status: 413 });
  }

  const key = `m/${session.merchant.id}/${Date.now()}-${file.name}`;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    await putKbObject({ key, body: buf, contentType: mime });
  } catch (err) {
    return NextResponse.json(
      { error: `storage upload failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  const inserted = await db
    .insert(brandKbDocuments)
    .values({
      merchantId: session.merchant.id,
      filename: file.name,
      mimeType: mime,
      sizeBytes: file.size,
      storageUrl: key,
      status: 'uploaded',
    })
    .returning();

  await enqueueKbIngest(inserted[0].id);

  return NextResponse.json({ ok: true, document_id: inserted[0].id });
}
