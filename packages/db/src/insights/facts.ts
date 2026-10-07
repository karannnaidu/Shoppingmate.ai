import { and, desc, eq, gte, inArray, like, lt, sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { conversionEvents } from '../schema/conversionEvents.js';
import { insightCounters } from '../schema/insights.js';
import { metricEvents } from '../schema/metricEvents.js';
import { products } from '../schema/products.js';
import { supportCases } from '../schema/supportCases.js';

// Nav PRD Phase 8 — turn counters + conversations + cases into owner-level
// FACTS (plain numbers). Used by the weekly AI report (worker) and the
// dashboard (web). Every number shown to an owner comes from here.

// biome-ignore lint/suspicious/noExplicitAny: works with any drizzle pg driver
type Db = PgDatabase<any, any, any>;

export const FUNNEL_STEPS = [
  'visit',
  'collection',
  'product',
  'add_to_cart',
  'cart',
  'checkout',
  'purchase',
] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export type Leak = {
  from: FunnelStep;
  to: FunnelStep;
  reached: number;
  continued: number;
  lost: number;
  valueAtRisk: number;
};

export type InsightFacts = {
  merchantId: string;
  currency: string;
  aov: number;
  aovSource: 'orders' | 'catalog' | 'none';
  days: number;
  /** Window shown to the owner: first and last day included (YYYY-MM-DD, UTC). */
  from: string;
  to: string;
  /** First day we have any data for this store — later than `from` while
   *  tracking is newer than the window (so "this week" is really fewer days). */
  trackingSince: string | null;
  sessions: number;
  sessionsPrev: number; // average for the same length over the 4 prior periods
  steps: Record<FunnelStep, number>;
  conversionRate: number; // purchases / visits (0..1)
  conversionRatePrev: number;
  leaks: Leak[]; // biggest first
  byDevice: Array<{ device: string; sessions: number; purchases: number }>;
  bySource: Array<{ source: string; sessions: number; purchases: number }>;
  pages: Array<{
    pageType: string;
    views: number;
    avgSeconds: number;
    avgScroll: number;
    quickExits: number;
    avgLcpMs: number | null;
  }>;
  friction: Array<{
    pageType: string;
    device: string;
    kind: string;
    target: string;
    /** Owner-readable name of what was tapped (raw `target` stays for the UI). */
    label: string;
    count: number;
  }>;
  abandonedFields: Array<{ pageType: string; field: string; count: number }>;
  products: Array<{ path: string; views: number; addToCart: number; rate: number }>;
  heat: Array<{ pageType: string; device: string; cell: string; clicks: number }>;
  attention: Array<{ pageType: string; device: string; band: number; seconds: number }>;
  bot: { engagedSessions: number; engagedPurchases: number; otherPurchases: number };
  voice: {
    conversations: number;
    objections: Array<{ text: string; count: number }>;
    needs: Array<{ text: string; count: number }>;
    unanswered: string[];
    cases: Array<{ type: string; count: number }>;
  };
  qa: boolean;
};

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

type CounterRow = { metric: string; dimKey: string; count: number; total: number };

/** Share of the people who stopped at a step that a fix could realistically win back. */
export const RECOVERY_SHARE = 0.1;

/** One key per product page: "/shop/green-mantra/", "/Shop/Green-Mantra?ref=x"
 *  and "/shop/green-mantra" are the same product (Calmosis showed each twice). */
export function productPathKey(path: string): string {
  const p = path.split(/[?#]/)[0]!.toLowerCase().replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

async function counters(
  db: Db,
  merchantId: string,
  from: Date,
  to: Date,
  metrics: string[],
): Promise<CounterRow[]> {
  const rows = await db
    .select({
      metric: insightCounters.metric,
      dimKey: insightCounters.dimKey,
      count: sql<number>`sum(${insightCounters.count})`.mapWith(Number),
      total: sql<number>`sum(${insightCounters.total})`.mapWith(Number),
    })
    .from(insightCounters)
    .where(
      and(
        eq(insightCounters.merchantId, merchantId),
        gte(insightCounters.day, iso(from)),
        lt(insightCounters.day, iso(to)),
        inArray(insightCounters.metric, metrics),
      ),
    )
    .groupBy(insightCounters.metric, insightCounters.dimKey);
  return rows;
}

/** "button/add to cart" → the "add to cart" button; "text/x" → "x" (plain text, not a link). */
export function targetLabel(key: string): string {
  const [role = '', ...rest] = key.split(/[/|]/);
  const name = rest.join(' ').trim();
  if (!name || key === '-') return 'an unidentified spot on the page';
  if (role === 'text') return `"${name}" (plain text, not a link or button)`;
  return `the "${name}" ${role === 'link' ? 'link' : role === 'button' ? 'button' : 'control'}`;
}

function tally(list: string[], top = 8): Array<{ text: string; count: number }> {
  const m = new Map<string, number>();
  for (const raw of list) {
    const t = raw.trim().toLowerCase();
    if (t) m.set(t, (m.get(t) ?? 0) + 1);
  }
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([text, count]) => ({ text, count }));
}

export async function buildInsightFacts(
  db: Db,
  merchantId: string,
  opts: { days?: number; now?: Date; qa?: boolean } = {},
): Promise<InsightFacts> {
  const days = opts.days ?? 7;
  const now = opts.now ?? new Date();
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + DAY); // include today
  const from = new Date(to.getTime() - days * DAY);
  const prevFrom = new Date(from.getTime() - 4 * days * DAY);
  const p = opts.qa ? 'qa:' : '';
  const M = (m: string) => `${p}${m}`;

  const [cur, prev] = await Promise.all([
    counters(
      db,
      merchantId,
      from,
      to,
      [
        'funnel',
        'pv',
        'scroll',
        'friction',
        'field_abandon',
        'product',
        'vitals',
        'bot',
        'heat',
        'attn',
      ].map(M),
    ),
    counters(db, merchantId, prevFrom, from, [M('funnel')]),
  ]);
  const byMetric = (rows: CounterRow[], m: string) => rows.filter((r) => r.metric === M(m));

  // Funnel (sessions reaching each step).
  const steps = Object.fromEntries(FUNNEL_STEPS.map((s) => [s, 0])) as Record<FunnelStep, number>;
  const devices = new Map<string, { sessions: number; purchases: number }>();
  const sources = new Map<string, { sessions: number; purchases: number }>();
  for (const r of byMetric(cur, 'funnel')) {
    const [step, device = 'desktop', source = 'direct'] = r.dimKey.split('|');
    if ((FUNNEL_STEPS as readonly string[]).includes(step as string))
      steps[step as FunnelStep] += r.count;
    if (step === 'visit' || step === 'purchase') {
      const d = devices.get(device) ?? { sessions: 0, purchases: 0 };
      const s = sources.get(source) ?? { sessions: 0, purchases: 0 };
      if (step === 'visit') {
        d.sessions += r.count;
        s.sessions += r.count;
      } else {
        d.purchases += r.count;
        s.purchases += r.count;
      }
      devices.set(device, d);
      sources.set(source, s);
    }
  }
  const prevSteps = { visit: 0, purchase: 0 };
  for (const r of byMetric(prev, 'funnel')) {
    const step = r.dimKey.split('|')[0];
    if (step === 'visit') prevSteps.visit += r.count;
    if (step === 'purchase') prevSteps.purchase += r.count;
  }

  // Average order value: real orders if we have them, else the catalog's typical price.
  const [orders] = await db
    .select({
      avg: sql<number>`avg(${conversionEvents.totalCents})`.mapWith(Number),
      currency: sql<string | null>`max(${conversionEvents.currency})`,
    })
    .from(conversionEvents)
    .where(
      and(
        eq(conversionEvents.merchantId, merchantId),
        gte(conversionEvents.createdAt, new Date(now.getTime() - 90 * DAY)),
      ),
    );
  const [cat] = await db
    .select({
      avg: sql<number>`avg(${products.priceCents})`.mapWith(Number),
      currency: sql<string | null>`max(${products.currency})`,
    })
    .from(products)
    .where(eq(products.merchantId, merchantId));
  const currency = orders?.currency ?? cat?.currency ?? 'INR';
  let aov = orders?.avg ? orders.avg / 100 : 0;
  let aovSource: InsightFacts['aovSource'] = aov > 0 ? 'orders' : 'none';
  if (!aov && cat?.avg) {
    aov = cat.avg / 100;
    aovSource = 'catalog';
  }

  // Leaks between consecutive reached steps, valued at the downstream conversion.
  const conversionRate = steps.visit > 0 ? steps.purchase / steps.visit : 0;
  const leaks: Leak[] = [];
  const order: FunnelStep[] = ['visit', 'product', 'add_to_cart', 'checkout', 'purchase'];
  for (let i = 0; i < order.length - 1; i++) {
    const a = order[i] as FunnelStep;
    const b = order[i + 1] as FunnelStep;
    const reached = steps[a];
    const continued = Math.min(steps[b], reached);
    const lost = Math.max(0, reached - continued);
    const downstream = continued > 0 ? steps.purchase / continued : conversionRate;
    leaks.push({
      from: a,
      to: b,
      reached,
      continued,
      lost,
      // Realistic, not best-case: what 1 in 10 of the people who stopped would
      // be worth if they carried on and bought like those who did. The old
      // best case (everyone carries on) showed Calmosis ₹2.6 lakh/week "left on
      // the table" against ~6 real orders — not credible to an owner.
      valueAtRisk: Math.round(lost * RECOVERY_SHARE * downstream * aov),
    });
  }
  leaks.sort((x, y) => y.valueAtRisk - x.valueAtRisk || y.lost - x.lost);

  // Pages.
  const pages = new Map<
    string,
    {
      views: number;
      seconds: number;
      scroll: number;
      scrollN: number;
      quick: number;
      lcp: number;
      lcpN: number;
    }
  >();
  const pg = (t: string) => {
    const v = pages.get(t) ?? {
      views: 0,
      seconds: 0,
      scroll: 0,
      scrollN: 0,
      quick: 0,
      lcp: 0,
      lcpN: 0,
    };
    pages.set(t, v);
    return v;
  };
  for (const r of byMetric(cur, 'pv')) {
    const v = pg(r.dimKey.split('|')[0] as string);
    v.views += r.count;
    v.seconds += r.total / 1000;
  }
  for (const r of byMetric(cur, 'scroll')) {
    const v = pg(r.dimKey.split('|')[0] as string);
    v.scroll += r.total;
    v.scrollN += r.count;
  }
  for (const r of byMetric(cur, 'vitals')) {
    const [t, , kind] = r.dimKey.split('|');
    if (kind === 'lcp') {
      const v = pg(t as string);
      v.lcp += r.total;
      v.lcpN += r.count;
    }
  }
  const friction: InsightFacts['friction'] = [];
  for (const r of byMetric(cur, 'friction')) {
    const [pageType = '', device = '', kind = '', ...rest] = r.dimKey.split('|');
    if (kind === 'uturn') pg(pageType).quick += r.count;
    const target = rest.join('|');
    friction.push({ pageType, device, kind, target, label: targetLabel(target), count: r.count });
  }
  friction.sort((a, b) => b.count - a.count);

  const productsMap = new Map<string, { views: number; atc: number }>();
  for (const r of byMetric(cur, 'product')) {
    const idx = r.dimKey.lastIndexOf('|');
    const path = productPathKey(r.dimKey.slice(0, idx));
    const kind = r.dimKey.slice(idx + 1);
    const v = productsMap.get(path) ?? { views: 0, atc: 0 };
    if (kind === 'view') v.views += r.count;
    if (kind === 'atc') v.atc += r.count;
    productsMap.set(path, v);
  }

  const bot = { engagedSessions: 0, engagedPurchases: 0, otherPurchases: 0 };
  for (const r of byMetric(cur, 'bot')) {
    if (r.dimKey === 'engaged_session') bot.engagedSessions += r.count;
    if (r.dimKey === 'engaged_purchase') bot.engagedPurchases += r.count;
    if (r.dimKey === 'other_purchase') bot.otherPurchases += r.count;
  }

  // Voice of the customer: the session-end intent records + support cases.
  const convos = await db
    .select({ tags: metricEvents.tags })
    .from(metricEvents)
    .where(
      and(
        eq(metricEvents.merchantId, merchantId),
        eq(metricEvents.metricName, 'conversationCompleted'),
        gte(metricEvents.ts, from),
      ),
    )
    .orderBy(desc(metricEvents.ts))
    .limit(500);
  const objections: string[] = [];
  const needs: string[] = [];
  for (const c of convos) {
    const intent = ((c.tags ?? {}) as { intent?: { objections?: unknown; needs?: unknown } })
      .intent;
    if (Array.isArray(intent?.objections))
      objections.push(...intent.objections.filter((x): x is string => typeof x === 'string'));
    if (Array.isArray(intent?.needs))
      needs.push(...intent.needs.filter((x): x is string => typeof x === 'string'));
  }
  const caseRows = await db
    .select({ type: supportCases.type, summary: supportCases.summary })
    .from(supportCases)
    .where(and(eq(supportCases.merchantId, merchantId), gte(supportCases.createdAt, from)));
  const [first] = await db
    .select({ day: sql<string | null>`min(${insightCounters.day})` })
    .from(insightCounters)
    .where(and(eq(insightCounters.merchantId, merchantId), inArray(insightCounters.metric, [M('funnel'), M('pv')])));
  const caseCounts = new Map<string, number>();
  for (const r of caseRows) caseCounts.set(r.type, (caseCounts.get(r.type) ?? 0) + 1);

  return {
    merchantId,
    currency,
    aov: Math.round(aov),
    aovSource,
    days,
    from: iso(from),
    to: iso(new Date(to.getTime() - DAY)),
    trackingSince: first?.day ? String(first.day).slice(0, 10) : null,
    sessions: steps.visit,
    sessionsPrev: Math.round(prevSteps.visit / 4),
    steps,
    conversionRate,
    conversionRatePrev: prevSteps.visit > 0 ? prevSteps.purchase / prevSteps.visit : 0,
    leaks,
    byDevice: [...devices.entries()]
      .map(([device, v]) => ({ device, ...v }))
      .sort((a, b) => b.sessions - a.sessions),
    bySource: [...sources.entries()]
      .map(([source, v]) => ({ source, ...v }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10),
    pages: [...pages.entries()]
      .map(([pageType, v]) => ({
        pageType,
        views: v.views,
        avgSeconds: v.views ? Math.round(v.seconds / v.views) : 0,
        avgScroll: v.scrollN ? Math.round(v.scroll / v.scrollN) : 0,
        quickExits: v.quick,
        avgLcpMs: v.lcpN ? Math.round(v.lcp / v.lcpN) : null,
      }))
      .sort((a, b) => b.views - a.views),
    friction: friction.slice(0, 25),
    abandonedFields: byMetric(cur, 'field_abandon')
      .map((r) => {
        const [pageType = '', field = ''] = r.dimKey.split('|');
        return { pageType, field, count: r.count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    products: [...productsMap.entries()]
      .map(([path, v]) => ({
        path,
        views: v.views,
        addToCart: v.atc,
        rate: v.views ? v.atc / v.views : 0,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 20),
    heat: byMetric(cur, 'heat').map((r) => {
      const [pageType = '', device = '', cell = ''] = r.dimKey.split('|');
      return { pageType, device, cell, clicks: r.count };
    }),
    attention: byMetric(cur, 'attn').map((r) => {
      const [pageType = '', device = '', band = 'b0'] = r.dimKey.split('|');
      return { pageType, device, band: Number(band.slice(1)), seconds: Math.round(r.total) };
    }),
    bot,
    voice: {
      conversations: convos.length,
      objections: tally(objections),
      needs: tally(needs),
      unanswered: caseRows
        .filter((r) => r.type === 'product_question')
        .map((r) => r.summary)
        .slice(0, 8),
      cases: [...caseCounts.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
    },
    qa: opts.qa === true,
  };
}

/** Delete QA/synthetic counters + detail rows (after an acceptance run). */
export async function purgeQaInsights(db: Db, merchantId: string): Promise<void> {
  await db
    .delete(insightCounters)
    .where(and(eq(insightCounters.merchantId, merchantId), like(insightCounters.metric, 'qa:%')));
}
