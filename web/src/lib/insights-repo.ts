import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { type InsightFacts, buildInsightFacts } from '@shoppingmate/db/insights';
import { insightReports, siteTemplates } from '@shoppingmate/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { db } from './db';

// Nav PRD Phase 8 — data for the Store Insights pages.

export type InsightsView = {
  facts: InsightFacts;
  report: typeof insightReports.$inferSelect | null;
  screenshots: Record<string, Record<string, string>>; // pageType → device → signed URL
};

let s3: S3Client | null = null;
function client(): S3Client | null {
  if (s3) return s3;
  const { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID } = process.env;
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ACCOUNT_ID) return null;
  s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
  return s3;
}

async function signedScreenshots(merchantId: string): Promise<InsightsView['screenshots']> {
  const c = client();
  if (!c) return {};
  const bucket = process.env.R2_SITE_GRAPH_BUCKET?.trim() || 'shoppingmate-site-graph';
  const rows = await db
    .select({ pageType: siteTemplates.pageType, screenshots: siteTemplates.screenshots })
    .from(siteTemplates)
    .where(eq(siteTemplates.merchantId, merchantId));
  const out: InsightsView['screenshots'] = {};
  for (const r of rows) {
    for (const [device, key] of Object.entries(r.screenshots ?? {})) {
      try {
        const url = await getSignedUrl(c, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 3600 });
        out[r.pageType] = { ...(out[r.pageType] ?? {}), [device]: url };
      } catch {
        /* missing object — page renders without a picture */
      }
    }
  }
  return out;
}

export async function loadInsights(merchantId: string, opts: { qa?: boolean; days?: number } = {}): Promise<InsightsView> {
  const [facts, [report], screenshots] = await Promise.all([
    buildInsightFacts(db, merchantId, { days: opts.days ?? 7, qa: opts.qa }),
    db
      .select()
      .from(insightReports)
      .where(eq(insightReports.merchantId, merchantId))
      .orderBy(desc(insightReports.weekStart))
      .limit(1),
    signedScreenshots(merchantId),
  ]);
  return { facts, report: report ?? null, screenshots };
}

export async function setFixStatus(merchantId: string, reportId: number, fixId: string, status: 'open' | 'done') {
  const [r] = await db
    .select()
    .from(insightReports)
    .where(and(eq(insightReports.id, reportId), eq(insightReports.merchantId, merchantId)));
  if (!r) return;
  const fixes = r.fixes.map((f) =>
    f.id === fixId ? { ...f, status, doneAt: status === 'done' ? new Date().toISOString() : undefined } : f,
  );
  await db.update(insightReports).set({ fixes }).where(eq(insightReports.id, r.id));
}
