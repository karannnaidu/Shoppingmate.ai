import { randomUUID } from 'node:crypto';
import {
  type InsightFacts,
  buildInsightFacts,
  db as defaultDb,
  emailOwners,
  insightsDetailRetentionDays,
  schema,
} from '@shoppingmate/db';
import type { InsightFix } from '@shoppingmate/db/schema';
import { logger } from '@shoppingmate/shared';
import { and, eq, lt, sql } from 'drizzle-orm';

// Nav PRD Phase 8 — weekly "top fixes" report + daily anomaly check.
// The LLM only PHRASES; every number comes from buildInsightFacts().

export type ChatFn = (
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
) => Promise<{ text: string }>;

const MIN_SESSIONS = 20;
const DASHBOARD_URL = process.env.DASHBOARD_URL ?? 'https://shoppingmate-web.vercel.app';

export function money(v: number, currency: string): string {
  const sym =
    currency === 'INR'
      ? '₹'
      : currency === 'USD'
        ? '$'
        : currency === 'GBP'
          ? '£'
          : currency === 'EUR'
            ? '€'
            : `${currency} `;
  return `${sym}${Math.round(v).toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US')}`;
}

const SYS = `You are a calm e-commerce advisor writing for a busy SHOP OWNER (not an analyst).
From the FACTS JSON, write the week's report as JSON:
{"summary": one plain sentence (money or people, no jargon),
 "fixes": up to 5 items, biggest money first, each:
  {"title": what's happening in plain words,
   "impact": why it matters in money/people (e.g. "about ₹42,000 a week"),
   "impactValue": number (money per week, from leaks[].valueAtRisk or 0),
   "proof": the specific numbers / shopper quotes behind it,
   "action": ONE concrete thing to do this week,
   "pageType": one of home|pdp|plp|cart|checkout|other or null,
   "metric": {"name": short metric id you'd watch, "before": number} or null}}
RULES: use ONLY numbers that appear in FACTS (you may round). Never invent numbers, products or quotes.
No jargon: never write LCP, INP, CLS, bounce, conversion rate, CTR, funnel, session — say "page took 4 seconds to show",
"left without looking around", "out of 100 visitors, 2 bought", "visits". If there is not enough data for a claim, skip it.
JSON only.`;

export function parseReport(
  text: string,
  facts: InsightFacts,
): { summary: string; fixes: InsightFix[] } | null {
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s < 0 || e <= s) return null;
  let raw: { summary?: unknown; fixes?: unknown };
  try {
    raw = JSON.parse(text.slice(s, e + 1));
  } catch {
    return null;
  }
  const maxValue = facts.leaks.reduce((a, l) => a + l.valueAtRisk, 0);
  const fixes: InsightFix[] = (Array.isArray(raw.fixes) ? raw.fixes : [])
    .slice(0, 5)
    .map((f: Record<string, unknown>) => ({
      id: randomUUID(),
      title: String(f.title ?? '').slice(0, 160),
      impact: String(f.impact ?? '').slice(0, 160),
      // Guard: a fix can't be worth more than everything at risk this week.
      impactValue: Math.max(0, Math.min(Number(f.impactValue) || 0, maxValue)),
      proof: String(f.proof ?? '').slice(0, 400),
      action: String(f.action ?? '').slice(0, 240),
      pageType: typeof f.pageType === 'string' ? f.pageType : undefined,
      metric:
        f.metric &&
        typeof f.metric === 'object' &&
        typeof (f.metric as { name?: unknown }).name === 'string'
          ? {
              name: String((f.metric as { name: string }).name),
              before: Number((f.metric as { before?: unknown }).before) || 0,
            }
          : undefined,
      status: 'open' as const,
    }))
    .filter((f) => f.title && f.action);
  if (typeof raw.summary !== 'string' || !raw.summary.trim()) return null;
  return { summary: raw.summary.trim().slice(0, 300), fixes };
}

export function weekStartOf(d: Date): string {
  const day = d.getUTCDay(); // 0 Sun
  const diff = (day + 6) % 7; // days since Monday
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff));
  return m.toISOString().slice(0, 10);
}

function digestHtml(
  brand: string,
  summary: string,
  atRisk: string,
  fixes: InsightFix[],
  currency: string,
): string {
  const cards = fixes
    .slice(0, 3)
    .map(
      (
        f,
        i,
      ) => `<div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin:10px 0">
<p style="margin:0;color:#6b7280;font-size:12px">Fix ${i + 1}${f.impactValue ? ` · ${money(f.impactValue, currency)} a week` : ''}</p>
<p style="margin:6px 0 4px;font-weight:600">${f.title}</p>
<p style="margin:0 0 6px;color:#374151">${f.proof}</p>
<p style="margin:0"><strong>What to do:</strong> ${f.action}</p></div>`,
    )
    .join('');
  return `<div style="font-family:system-ui,sans-serif;max-width:560px">
<h2 style="margin:0 0 4px">${brand} — your week</h2>
<p style="font-size:16px">${summary}</p>
${atRisk ? `<p style="color:#b45309"><strong>${atRisk}</strong> was left on the table this week.</p>` : ''}
${cards}
<p><a href="${DASHBOARD_URL}/app/insights" style="background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">See all fixes</a></p>
</div>`;
}

export async function runWeeklyInsights(args: {
  merchantId: string;
  chat: ChatFn;
  qa?: boolean;
  email?: boolean;
  db?: typeof defaultDb;
  now?: Date;
}): Promise<{ status: 'ok' | 'not_enough_data' | 'llm_failed'; fixes: number }> {
  const db = args.db ?? defaultDb;
  const now = args.now ?? new Date();
  const facts = await buildInsightFacts(db, args.merchantId, { days: 7, now, qa: args.qa });
  const weekStart = weekStartOf(now);
  const atRiskTotal = facts.leaks.reduce((a, l) => a + l.valueAtRisk, 0);

  let summary: string;
  let fixes: InsightFix[] = [];
  let status: 'ok' | 'not_enough_data' | 'llm_failed' = 'ok';
  if (facts.sessions < MIN_SESSIONS) {
    status = 'not_enough_data';
    summary = `Only ${facts.sessions} visits were measured this week — too early to call. We'll have clear fixes once about ${MIN_SESSIONS} people have visited.`;
  } else {
    const res = await args.chat([
      { role: 'system', content: SYS },
      { role: 'user', content: `FACTS:\n${JSON.stringify(facts)}` },
    ]);
    const parsed = parseReport(res.text, facts);
    if (!parsed) {
      status = 'llm_failed';
      summary = `${facts.sessions} people visited this week; ${facts.steps.purchase} bought.`;
    } else {
      summary = parsed.summary;
      fixes = parsed.fixes.sort((a, b) => b.impactValue - a.impactValue);
    }
  }

  // Keep "done" fixes from an earlier run of this same week.
  const [existing] = await db
    .select()
    .from(schema.insightReports)
    .where(
      and(
        eq(schema.insightReports.merchantId, args.merchantId),
        eq(schema.insightReports.weekStart, weekStart),
      ),
    );
  const done = (existing?.fixes ?? []).filter((f) => f.status === 'done');
  const allFixes = [...done, ...fixes.filter((f) => !done.some((d) => d.title === f.title))];

  const [row] = await db
    .insert(schema.insightReports)
    .values({
      merchantId: args.merchantId,
      weekStart,
      summary,
      atRisk: atRiskTotal,
      currency: facts.currency,
      fixes: allFixes,
      facts: facts as unknown as Record<string, unknown>,
    })
    .onConflictDoUpdate({
      target: [schema.insightReports.merchantId, schema.insightReports.weekStart],
      set: {
        summary,
        atRisk: atRiskTotal,
        currency: facts.currency,
        fixes: allFixes,
        facts: facts as unknown as Record<string, unknown>,
      },
    })
    .returning({ id: schema.insightReports.id, emailedAt: schema.insightReports.emailedAt });

  if (args.email !== false && status === 'ok' && !row?.emailedAt) {
    const [m] = await db
      .select({ name: schema.merchants.name, domain: schema.merchants.domain })
      .from(schema.merchants)
      .where(eq(schema.merchants.id, args.merchantId));
    const brand = m?.name ?? m?.domain ?? 'Your store';
    const sent = await emailOwners(
      args.merchantId,
      `${brand}: ${fixes[0]?.title ?? 'your week in one minute'}`,
      digestHtml(
        brand,
        summary,
        atRiskTotal ? money(atRiskTotal, facts.currency) : '',
        allFixes,
        facts.currency,
      ),
    );
    if (sent > 0 && row)
      await db
        .update(schema.insightReports)
        .set({ emailedAt: new Date() })
        .where(eq(schema.insightReports.id, row.id));
  }
  logger.info(
    {
      merchantId: args.merchantId,
      status,
      fixes: fixes.length,
      sessions: facts.sessions,
      qa: args.qa,
    },
    'weekly insights report',
  );
  return { status, fixes: fixes.length };
}

/** Daily: expire detail rows + flag a sharp conversion drop vs the 4-week norm. */
export async function runDailyInsights(args: {
  merchantId: string;
  plan: string | null;
  db?: typeof defaultDb;
  now?: Date;
}) {
  const db = args.db ?? defaultDb;
  const now = args.now ?? new Date();
  const keep = insightsDetailRetentionDays(args.plan);
  await db
    .delete(schema.insightPageviews)
    .where(
      and(
        eq(schema.insightPageviews.merchantId, args.merchantId),
        lt(schema.insightPageviews.createdAt, new Date(now.getTime() - keep * 86_400_000)),
      ),
    );

  const yesterday = await buildInsightFacts(db, args.merchantId, {
    days: 1,
    now: new Date(now.getTime() - 86_400_000),
  });
  const baseline = await buildInsightFacts(db, args.merchantId, {
    days: 28,
    now: new Date(now.getTime() - 2 * 86_400_000),
  });
  if (yesterday.sessions >= 30 && baseline.conversionRate > 0) {
    const drop = 1 - yesterday.conversionRate / baseline.conversionRate;
    if (drop >= 0.4) {
      const message = `Yesterday ${Math.round(yesterday.conversionRate * 1000) / 10} in 100 visitors bought, vs ${Math.round(baseline.conversionRate * 1000) / 10} usually.`;
      await db.insert(schema.alerts).values({
        merchantId: args.merchantId,
        kind: 'insight.anomaly',
        severity: 'warning',
        payload: { message, visits: yesterday.sessions },
      });
      await emailOwners(
        args.merchantId,
        'Heads up: fewer visitors bought yesterday',
        `<div style="font-family:system-ui,sans-serif;max-width:560px"><p style="font-size:16px">${message}</p>
<p>Worth a quick check that checkout and your add-to-cart button work on a phone.</p>
<p><a href="${DASHBOARD_URL}/app/insights">See what changed</a></p></div>`,
      ).catch(() => 0);
      return { anomaly: true };
    }
  }
  void sql;
  return { anomaly: false };
}
