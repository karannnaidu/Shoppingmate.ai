import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { caseAttachments } from '@shoppingmate/db/schema';
import { getDashboardSession } from '@/lib/session';
import { presignKbDownload } from '@/lib/r2';

// Customer Care PRD: shopper photos are private. Only the store's own owners
// can open them, through a link that expires a minute later.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDashboardSession({ headers: await headers() });
  if (!session?.merchant) return new Response('unauthorized', { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response('not found', { status: 404 });
  const [row] = await db
    .select({ key: caseAttachments.r2Key })
    .from(caseAttachments)
    .where(and(eq(caseAttachments.id, id), eq(caseAttachments.merchantId, session.merchant.id)))
    .limit(1);
  if (!row) return new Response('not found', { status: 404 });
  const url = await presignKbDownload({ key: row.key, expiresIn: 60 });
  return new Response(null, { status: 302, headers: { location: url, 'cache-control': 'private, no-store' } });
}
