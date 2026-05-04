import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { computeKpis } from '@/lib/kpi-repo';
import { recentConversations } from '@/lib/conversations-repo';
import { db } from '@/lib/db';
import { products, merchants } from '@shoppingmate/db/schema';
import { eq, sql } from 'drizzle-orm';
import { KpiTile } from '@/components/dashboard/KpiTile';
import { ConversationsTable } from '@/components/dashboard/ConversationsTable';
import { CatalogChip } from '@/components/dashboard/CatalogChip';

export default async function HomePage() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const merchantId = session.merchant.id;
  const [kpis, rows, productCountRow, merchantRow] = await Promise.all([
    computeKpis({ merchantId, days: 7 }),
    recentConversations({ merchantId, limit: 20 }),
    db.select({ count: sql<number>`count(*)::int` }).from(products).where(eq(products.merchantId, merchantId)),
    db.query.merchants.findFirst({ where: eq(merchants.id, merchantId) }),
  ]);

  const usd = (cents: number) => `$${(cents / 100).toFixed(0)}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">Home</h1>
        <CatalogChip syncedAt={merchantRow?.catalogSyncedAt ?? null} productCount={productCountRow[0]?.count ?? 0} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Conversations" value={String(kpis.conversations)} />
        <KpiTile label="Conversion rate" value={`${(kpis.conversionRate * 100).toFixed(1)}%`} />
        <KpiTile label="Attributed revenue" value={usd(kpis.revenueCents)} />
        <KpiTile
          label="Voice ratio"
          value={`${(kpis.voiceRatio * 100).toFixed(0)}%`}
          hint={kpis.voiceRatio > 0.2 ? `Surcharge active: $0.30 × ${kpis.voiceConversations}` : undefined}
        />
      </div>

      <ConversationsTable rows={rows} />
    </div>
  );
}
