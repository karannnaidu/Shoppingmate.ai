import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { db } from '@/lib/db';
import { brandKbDocuments, brandKbChunks } from '@shoppingmate/db/schema';
import { eq, sql } from 'drizzle-orm';
import { KnowledgeUploader, type KbDoc } from '@/components/dashboard/KnowledgeUploader';

export default async function KnowledgePage() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const rows = await db
    .select({
      id: brandKbDocuments.id,
      filename: brandKbDocuments.filename,
      sizeBytes: brandKbDocuments.sizeBytes,
      status: brandKbDocuments.status,
      enabled: brandKbDocuments.enabled,
      tokenCount: sql<number>`coalesce((select sum(${brandKbChunks.tokenCount}) from ${brandKbChunks} where ${brandKbChunks.documentId} = ${brandKbDocuments.id}), 0)::int`,
    })
    .from(brandKbDocuments)
    .where(eq(brandKbDocuments.merchantId, session.merchant.id));

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
      <h1 className="text-2xl font-semibold">Brand Knowledge</h1>
      <KnowledgeUploader docs={docs} />
    </div>
  );
}
