import type { ChatFn } from './checkout-extract.js';

export type BrandRecord = {
  intent: string | null;
  needs: string[];
  objections: string[];
  outcome: string;
  couponUsed: boolean;
  attributedCents: number;
};
export type RateRow = { key: string; count: number; purchasedRate: number };
export type ObjectionRow = { key: string; count: number; overcomeRate: number };
export type BrandStats = {
  total: number;
  purchasedRate: number;
  byIntent: RateRow[];
  byNeed: RateRow[];
  objections: ObjectionRow[];
  dropStages: { key: string; count: number }[];
  couponPurchasedRate: number | null;
  noCouponPurchasedRate: number | null;
};

const rate = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) / 100 : 0);

export function aggregateBrandStats(records: BrandRecord[], dropStages: string[] = []): BrandStats {
  const total = records.length;
  const purchased = records.filter((r) => r.outcome === 'purchased');
  const groupRate = (keyOf: (r: BrandRecord) => string[]): RateRow[] => {
    const all = new Map<string, number>();
    const won = new Map<string, number>();
    for (const r of records) for (const k of new Set(keyOf(r))) { if (!k) continue; all.set(k, (all.get(k) ?? 0) + 1); if (r.outcome === 'purchased') won.set(k, (won.get(k) ?? 0) + 1); }
    return [...all.entries()].map(([key, count]) => ({ key, count, purchasedRate: rate(won.get(key) ?? 0, count) })).sort((a, b) => b.count - a.count);
  };
  const couponUsed = records.filter((r) => r.couponUsed);
  const noCoupon = records.filter((r) => !r.couponUsed);
  const dropTally = new Map<string, number>();
  for (const s of dropStages) { const k = (s ?? '').trim(); if (k) dropTally.set(k, (dropTally.get(k) ?? 0) + 1); }
  return {
    total,
    purchasedRate: rate(purchased.length, total),
    byIntent: groupRate((r) => [r.intent ?? 'unknown']),
    byNeed: groupRate((r) => r.needs ?? []),
    objections: groupRate((r) => r.objections ?? []).map((o) => ({ key: o.key, count: o.count, overcomeRate: o.purchasedRate })),
    dropStages: [...dropTally.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count),
    couponPurchasedRate: couponUsed.length ? rate(couponUsed.filter((r) => r.outcome === 'purchased').length, couponUsed.length) : null,
    noCouponPurchasedRate: noCoupon.length ? rate(noCoupon.filter((r) => r.outcome === 'purchased').length, noCoupon.length) : null,
  };
}

const PB_SYS = `You write a SHORT brand "selling playbook" for an AI shopping assistant, grounded ONLY in the supplied stats. 200-350 words MAX. Sections: LEAD WITH (top converting intents/needs — what to surface first), PRE-EMPT (most common objections + how to handle, note which were overcome), CONVERTS (offers/coupons/products that lift purchase), WHERE TO PUSH vs SLOW DOWN (drop stages). Use ONLY the numbers given — never invent products, claims, or tactics not supported by the stats. Plain imperative guidance the bot can follow. No preamble.`;

export async function distilBrandPlaybook(stats: BrandStats, chat: ChatFn): Promise<string> {
  try {
    const { text } = await chat([
      { role: 'system', content: PB_SYS },
      { role: 'user', content: `Stats (real outcomes):\n${JSON.stringify(stats, null, 2)}\n\nWrite the playbook now.` },
    ]);
    return (text ?? '').trim();
  } catch {
    return '';
  }
}
