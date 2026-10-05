import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { db } from '@/lib/db';
import { brandKbDocuments, brandKbChunks } from '@shoppingmate/db/schema';
import { eq, sql } from 'drizzle-orm';
import { KnowledgeUploader, type KbDoc } from '@/components/dashboard/KnowledgeUploader';

// Always render fresh — token counts change as the KB is edited/re-ingested.
export const dynamic = 'force-dynamic';

export default async function KnowledgePage() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  // Sum chunk tokens per doc via a LEFT JOIN + GROUP BY. (A correlated subquery
  // here returned 0 at runtime despite correct data — this is robust.)
  const rows = await db
    .select({
      id: brandKbDocuments.id,
      filename: brandKbDocuments.filename,
      sizeBytes: brandKbDocuments.sizeBytes,
      status: brandKbDocuments.status,
      enabled: brandKbDocuments.enabled,
      tokenCount: sql<number>`coalesce(sum(${brandKbChunks.tokenCount}), 0)::int`,
    })
    .from(brandKbDocuments)
    .leftJoin(brandKbChunks, eq(brandKbChunks.documentId, brandKbDocuments.id))
    .where(eq(brandKbDocuments.merchantId, session.merchant.id))
    .groupBy(
      brandKbDocuments.id,
      brandKbDocuments.filename,
      brandKbDocuments.sizeBytes,
      brandKbDocuments.status,
      brandKbDocuments.enabled,
    );

  const docs: KbDoc[] = rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    sizeBytes: r.sizeBytes,
    status: r.status as KbDoc['status'],
    enabled: r.enabled,
    tokenCount: r.tokenCount,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">Brand Knowledge</h1>
      <KnowledgeUploader docs={docs} />
    </div>
  );
}
