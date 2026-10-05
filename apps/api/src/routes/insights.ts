import { db, hasFeature, insightsSessionCap, schema } from '@shoppingmate/db';
import { logger } from '@shoppingmate/shared';
import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Redis } from 'ioredis';

// Nav PRD Phase 8 — Store Insights ingest. ONE summary per pageview comes in;
// it is fanned out into fixed-size counters (insight_counters). Detail rows are
// kept only for qualifying pageviews. Synthetic/QA traffic is stored under a
// "qa:" metric prefix so it never mixes with the owner's real numbers.

export type Counter = { metric: string; dimKey: string; count: number; total: number };

type Summary = {
  merchantId: string;
  sessionId: string;
  path: string;
  pageType: string;
  device: string;
  source: string;
  newVisitor: boolean;
  dwellMs: number;
  maxScroll: number;
  attention: number[];
  cells: Record<string, number>;
  elements: Record<string, number>;
  rage: number;
  dead: number;
  errorClicks: number;
  deadTargets: string[];
  rageTargets: string[];
  abandonedFields: string[];
  lcp: number | null;
  cls: number;
  inp: number | null;
  jsErrors: number;
  botEngaged: boolean;
  cartIncreased: boolean;
  qa: boolean;
};

const STEP_OF: Record<string, string> = {
  home: 'home',
  plp: 'collection',
  collection: 'collection',
  pdp: 'product',
  cart: 'cart',
  checkout: 'checkout',
  purchase: 'purchase',
};

const s = (v: unknown, max = 80) => (typeof v === 'string' ? v.slice(0, max) : '');
const n = (v: unknown, lo = 0, hi = 1e9) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : 0;
};
const clean = (v: string) => v.replace(/\|/g, '/');

/** Validate + clamp an untrusted beacon body. null = reject. */
export function parseSummary(raw: unknown): Summary | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const merchantId = s(o.merchantId, 40);
  const sessionId = s(o.sessionId, 80);
  if (!merchantId || !sessionId) return null;
  const rec = (v: unknown, maxKeys: number) => {
    const out: Record<string, number> = {};
    if (v && typeof v === 'object') {
      for (const [k, c] of Object.entries(v as Record<string, unknown>).slice(0, maxKeys)) {
        const kk = clean(k.slice(0, 60));
        if (kk) out[kk] = n(c, 0, 1000);
      }
    }
    return out;
  };
  const list = (v: unknown, max: number) =>
    Array.isArray(v)
      ? v
          .filter((x) => typeof x === 'string')
          .slice(0, max)
          .map((x) => clean(String(x).slice(0, 60)))
      : [];
  return {
    merchantId,
    sessionId,
    path: s(o.path, 200) || '/',
    pageType: clean(s(o.pageType, 20)) || 'other',
    device: ['mobile', 'tablet', 'desktop'].includes(String(o.device))
      ? String(o.device)
      : 'desktop',
    source: clean(s(o.source, 40)) || 'direct',
    newVisitor: o.newVisitor === true,
    dwellMs: n(o.dwellMs, 0, 3_600_000),
    maxScroll: n(o.maxScroll, 0, 100),
    attention: Array.isArray(o.attention) ? o.attention.slice(0, 10).map((x) => n(x, 0, 3600)) : [],
    cells: rec(o.cells, 100),
    elements: rec(o.elements, 20),
    rage: n(o.rage, 0, 100),
    dead: n(o.dead, 0, 100),
    errorClicks: n(o.errorClicks, 0, 100),
    deadTargets: list(o.deadTargets, 5),
    rageTargets: list(o.rageTargets, 5),
    abandonedFields: list(o.abandonedFields, 10),
    lcp: o.lcp == null ? null : n(o.lcp, 0, 120_000),
    cls: n(o.cls, 0, 10),
    inp: o.inp == null ? null : n(o.inp, 0, 60_000),
    jsErrors: n(o.jsErrors, 0, 1000),
    botEngaged: o.botEngaged === true,
    cartIncreased: o.cartIncreased === true,
    qa: o.qa === true,
  };
}

/** Pure fan-out of one pageview into counters (session-level steps added by the caller). */
export function countersFor(x: Summary): Counter[] {
  const p = x.qa ? 'qa:' : '';
  const base = `${x.pageType}|${x.device}`;
  const out: Counter[] = [
    { metric: `${p}pv`, dimKey: `${base}|${x.source}`, count: 1, total: x.dwellMs },
    { metric: `${p}scroll`, dimKey: base, count: 1, total: x.maxScroll },
  ];
  x.attention.forEach((sec, i) => {
    if (sec > 0) out.push({ metric: `${p}attn`, dimKey: `${base}|b${i}`, count: 1, total: sec });
  });
  for (const [cell, c] of Object.entries(x.cells))
    out.push({ metric: `${p}heat`, dimKey: `${base}|${cell}`, count: c, total: 0 });
  for (const [k, c] of Object.entries(x.elements))
    out.push({ metric: `${p}el`, dimKey: `${base}|${k}`, count: c, total: 0 });
  if (x.rage)
    out.push({
      metric: `${p}friction`,
      dimKey: `${base}|rage|${x.rageTargets[0] ?? '-'}`,
      count: x.rage,
      total: 0,
    });
  if (x.dead) {
    const targets = x.deadTargets.length > 0 ? x.deadTargets : ['-'];
    for (const t of targets)
      out.push({ metric: `${p}friction`, dimKey: `${base}|dead|${t}`, count: 1, total: 0 });
  }
  if (x.errorClicks)
    out.push({ metric: `${p}friction`, dimKey: `${base}|error|-`, count: x.errorClicks, total: 0 });
  if (x.dwellMs < 5000 && x.maxScroll < 40)
    out.push({ metric: `${p}friction`, dimKey: `${base}|uturn|-`, count: 1, total: 0 });
  for (const f of x.abandonedFields)
    out.push({ metric: `${p}field_abandon`, dimKey: `${x.pageType}|${f}`, count: 1, total: 0 });
  if (x.lcp != null)
    out.push({ metric: `${p}vitals`, dimKey: `${base}|lcp`, count: 1, total: x.lcp });
  if (x.inp != null)
    out.push({ metric: `${p}vitals`, dimKey: `${base}|inp`, count: 1, total: x.inp });
  out.push({ metric: `${p}vitals`, dimKey: `${base}|cls`, count: 1, total: x.cls });
  if (x.jsErrors)
    out.push({ metric: `${p}jserr`, dimKey: x.pageType, count: x.jsErrors, total: 0 });
  if (x.pageType === 'pdp') {
    out.push({ metric: `${p}product`, dimKey: `${clean(x.path)}|view`, count: 1, total: 0 });
    if (x.cartIncreased)
      out.push({ metric: `${p}product`, dimKey: `${clean(x.path)}|atc`, count: 1, total: 0 });
  }
  return out;
}

/** Funnel / session-level steps reached by this pageview (deduped per session by the caller). */
export function stepsFor(x: Summary): string[] {
  const steps = ['visit'];
  const step = STEP_OF[x.pageType];
  if (step) steps.push(step);
  if (x.cartIncreased) steps.push('add_to_cart');
  return steps;
}

/** One row per (metric, dimKey) — an upsert can't touch the same row twice. */
export function mergeCounters(list: Counter[]): Counter[] {
  const byKey = new Map<string, Counter>();
  for (const k of list) {
    const dimKey = k.dimKey.slice(0, 240);
    const id = `${k.metric}\u0000${dimKey}`;
    const prev = byKey.get(id);
    if (prev) {
      prev.count += k.count;
      prev.total += k.total;
    } else byKey.set(id, { ...k, dimKey });
  }
  return [...byKey.values()];
}

export function detailReason(x: Summary): string | null {
  if (x.botEngaged) return 'bot';
  if (x.pageType === 'purchase') return 'converted';
  if (x.rage > 0 || x.dead > 1 || x.errorClicks > 0) return 'friction';
  return null;
}

const merchantCache = new Map<
  string,
  {
    at: number;
    m: { id: string; plan: string | null; domain: string; allowedDomains: string[] | null } | null;
  }
>();
async function merchantFor(id: string) {
  const hit = merchantCache.get(id);
  if (hit && Date.now() - hit.at < 60_000) return hit.m;
  const [m] = await db
    .select({
      id: schema.merchants.id,
      plan: schema.merchants.plan,
      domain: schema.merchants.domain,
      allowedDomains: schema.merchants.allowedDomains,
    })
    .from(schema.merchants)
    .where(eq(schema.merchants.id, id))
    .limit(1);
  merchantCache.set(id, { at: Date.now(), m: m ?? null });
  return m ?? null;
}

function originAllowed(
  origin: string | undefined,
  m: { domain: string; allowedDomains: string[] | null },
): boolean {
  if (!origin) return false;
  try {
    const host = new URL(origin).hostname.replace(/^www\./, '');
    const allowed = [m.domain, ...(m.allowedDomains ?? [])].map((d) => d.replace(/^www\./, ''));
    return allowed.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

export function createInsightsRoute(redis: Redis): Hono {
  const route = new Hono();
  route.post('/pageview', async (c) => {
    if ((process.env.INSIGHTS_TRACKING ?? '') !== '1') return c.body(null, 204);
    let raw: unknown;
    try {
      raw = JSON.parse(await c.req.text());
    } catch {
      return c.json({ ok: false }, 400);
    }
    const x = parseSummary(raw);
    if (!x) return c.json({ ok: false }, 400);
    const m = await merchantFor(x.merchantId);
    if (!m || !hasFeature(m, 'insights')) return c.body(null, 204);
    if (!originAllowed(c.req.header('origin'), m)) return c.json({ ok: false }, 403);

    // Per-merchant rate limit + monthly session cap (HyperLogLog = tiny + exact enough).
    const minute = Math.floor(Date.now() / 60_000);
    const rl = await redis.incr(`ins:rl:${m.id}:${minute}`);
    if (rl === 1) await redis.expire(`ins:rl:${m.id}:${minute}`, 120);
    if (rl > 1200) return c.json({ ok: false, reason: 'rate' }, 429);
    const month = new Date().toISOString().slice(0, 7);
    const hll = `ins:hll:${m.id}:${month}`;
    await redis.pfadd(hll, x.sessionId);
    await redis.expire(hll, 40 * 86400);
    if ((await redis.pfcount(hll)) > insightsSessionCap(m))
      return c.json({ ok: false, reason: 'cap' }, 429);

    const counters = countersFor(x);
    const p = x.qa ? 'qa:' : '';
    for (const step of stepsFor(x)) {
      const first = await redis.set(`ins:f:${x.sessionId}:${step}`, '1', 'EX', 86400, 'NX');
      if (first === 'OK') {
        counters.push({
          metric: `${p}funnel`,
          dimKey: `${step}|${x.device}|${x.source}`,
          count: 1,
          total: 0,
        });
        if (step === 'visit') {
          counters.push({
            metric: `${p}seg`,
            dimKey: `${x.newVisitor ? 'new' : 'returning'}|${x.device}`,
            count: 1,
            total: 0,
          });
        }
        if (step === 'purchase') {
          const engaged = (await redis.get(`ins:bot:${x.sessionId}`)) === '1';
          counters.push({
            metric: `${p}bot`,
            dimKey: engaged ? 'engaged_purchase' : 'other_purchase',
            count: 1,
            total: 0,
          });
        }
      }
    }
    if (
      x.botEngaged &&
      (await redis.set(`ins:bot:${x.sessionId}`, '1', 'EX', 86400, 'NX')) === 'OK'
    ) {
      counters.push({ metric: `${p}bot`, dimKey: 'engaged_session', count: 1, total: 0 });
    }

    const day = new Date().toISOString().slice(0, 10);
    await db
      .insert(schema.insightCounters)
      .values(
        mergeCounters(counters).map((k) => ({
          merchantId: m.id,
          day,
          metric: k.metric,
          dimKey: k.dimKey,
          count: k.count,
          total: k.total,
        })),
      )
      .onConflictDoUpdate({
        target: [
          schema.insightCounters.merchantId,
          schema.insightCounters.day,
          schema.insightCounters.metric,
          schema.insightCounters.dimKey,
        ],
        set: {
          count: sql`${schema.insightCounters.count} + excluded.count`,
          total: sql`${schema.insightCounters.total} + excluded.total`,
        },
      });
    const reason = detailReason(x);
    if (reason) {
      await db.insert(schema.insightPageviews).values({
        merchantId: m.id,
        sessionId: x.sessionId,
        pageType: x.pageType,
        path: x.path,
        device: x.device,
        summary: { ...x, qa: x.qa } as unknown as Record<string, unknown>,
        reason: x.qa ? `qa:${reason}` : reason,
      });
    }
    logger.debug({ merchantId: m.id, counters: counters.length, reason }, 'insights pageview');
    return c.body(null, 204);
  });
  return route;
}
