// Phase-3 proof: read the prod DB exactly as web/src/lib/intent-repo.ts and
// audience-repo.ts do, and aggregate with the SAME logic as
// web/src/lib/intent-insights.ts aggregateIntents (which is unit-tested separately).
// Proves the dashboard data exists in prod and renders a real view.
// Usage: PUB=<prod public url> node web/scripts/prove-intent-dashboard.mjs
import postgres from '../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js';

const MERCHANT = process.env.PROVE_MERCHANT_ID ?? 'SM-XPK2EN';
const sql = postgres(process.env.PUB, { max: 1 });

// identical to intent-insights.ts `tally`
const tally = (items) => {
  const m = new Map();
  for (const raw of items) { const k = (raw ?? '').trim(); if (!k) continue; m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
};

const rows = await sql`
  select tags->'intent'->>'intent' as intent, tags->>'outcome' as outcome,
         coalesce(tags->'intent'->'needs', '[]'::jsonb) as needs,
         coalesce(tags->'intent'->'objections', '[]'::jsonb) as objections,
         tags->'intent'->>'dropStage' as "dropStage"
  from metric_events
  where merchant_id = ${MERCHANT} and metric_name = 'conversationCompleted'
    and ts >= now() - interval '30 days' and tags ? 'intent'`;

const insights = {
  total: rows.length,
  distribution: tally(rows.map((r) => r.intent ?? 'unknown')),
  topNeeds: tally(rows.flatMap((r) => r.needs ?? [])),
  topObjections: tally(rows.flatMap((r) => r.objections ?? [])),
  dropStages: tally(rows.filter((r) => r.outcome === 'abandoned').map((r) => r.dropStage ?? '').filter(Boolean)),
};
console.log(`=== /app/intents (merchant=${MERCHANT}, 30d) ===`);
console.log('total conversations analyzed:', insights.total);
console.log('intent distribution :', JSON.stringify(insights.distribution));
console.log('top needs           :', JSON.stringify(insights.topNeeds.slice(0, 6)));
console.log('top objections      :', JSON.stringify(insights.topObjections.slice(0, 6)));
console.log('drop-off stages     :', JSON.stringify(insights.dropStages.slice(0, 6)));

const aud = await sql`
  select visitor_id, identity, top_intents, session_count, lifetime_value_cents, last_outcome, last_seen
  from visitor_profiles where merchant_id = ${MERCHANT} order by last_seen desc limit 10`;
console.log(`\n=== /app/audience (merchant=${MERCHANT}) ===`);
console.log('returning visitors  :', aud.length);
for (const a of aud.slice(0, 8)) {
  const id = a.identity ?? {}; const ti = a.top_intents ?? [];
  console.log(`  - ${id.name ?? String(a.visitor_id).slice(0, 12)} | ${id.city ?? '—'} | visits ${a.session_count} | intents [${ti.slice(0, 3).join(', ')}] | LTV ${a.lifetime_value_cents ? '₹' + Math.round(a.lifetime_value_cents / 100) : '—'} | last ${a.last_outcome ?? '—'}`);
}
await sql.end();

console.log('\n=== PHASE 3 PROOF ===');
console.log('intents page has data   :', insights.total > 0 && insights.distribution.length > 0);
console.log('audience page has rows  :', aud.length > 0);
process.exit(0);
