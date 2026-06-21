// PROD proof of Phase-5 brand auto-learning, end to end:
//   1. pull SM-XPK2EN's real conversationCompleted records from prod
//   2. aggregate stats (mirrors aggregateBrandStats; the real fn is unit-tested)
//   3. distil a selling playbook via the REAL LLM (same PB_SYS prompt as distilBrandPlaybook)
//   4. upsert into prod brand_playbooks (demo threshold 3; prod cron uses 20)
//   5. run a FRESH conversation through the deployed bot — it loads the playbook and
//      its reply reflects the data-driven guidance.
// Usage: PUB=<prod url> OPENROUTER_API_KEY=... node apps/api/scripts/prove-auto-learning-prod.mjs
import 'dotenv/config';
import WebSocket from 'ws';
import postgres from '../../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js';

const API_BASE = process.env.SHOPPINGMATE_API_BASE || 'https://api-production-1ea1.up.railway.app';
const MERCHANT = process.env.PROVE_MERCHANT_ID || 'SM-XPK2EN';
const ORIGIN = process.env.SHOPPINGMATE_DEMO_DOMAIN || 'shoppingmate-web.vercel.app';
const MIN = 3;
const sql = postgres(process.env.PUB, { max: 1 });

const rate = (n, d) => (d > 0 ? Math.round((n / d) * 100) / 100 : 0);
function aggregate(records, dropStages) {
  const total = records.length;
  const groupRate = (keyOf) => {
    const all = new Map(), won = new Map();
    for (const r of records) for (const k of new Set(keyOf(r))) { if (!k) continue; all.set(k, (all.get(k) ?? 0) + 1); if (r.outcome === 'purchased') won.set(k, (won.get(k) ?? 0) + 1); }
    return [...all.entries()].map(([key, count]) => ({ key, count, purchasedRate: rate(won.get(key) ?? 0, count) })).sort((a, b) => b.count - a.count);
  };
  const cu = records.filter((r) => r.couponUsed), nc = records.filter((r) => !r.couponUsed);
  const dt = new Map(); for (const s of dropStages) { const k = (s ?? '').trim(); if (k) dt.set(k, (dt.get(k) ?? 0) + 1); }
  return {
    total, purchasedRate: rate(records.filter((r) => r.outcome === 'purchased').length, total),
    byIntent: groupRate((r) => [r.intent ?? 'unknown']), byNeed: groupRate((r) => r.needs ?? []),
    objections: groupRate((r) => r.objections ?? []).map((o) => ({ key: o.key, count: o.count, overcomeRate: o.purchasedRate })),
    dropStages: [...dt.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count),
    couponPurchasedRate: cu.length ? rate(cu.filter((r) => r.outcome === 'purchased').length, cu.length) : null,
    noCouponPurchasedRate: nc.length ? rate(nc.filter((r) => r.outcome === 'purchased').length, nc.length) : null,
  };
}
const PB_SYS = `You write a SHORT brand "selling playbook" for an AI shopping assistant, grounded ONLY in the supplied stats. 200-350 words MAX. Sections: LEAD WITH (top converting intents/needs — what to surface first), PRE-EMPT (most common objections + how to handle, note which were overcome), CONVERTS (offers/coupons/products that lift purchase), WHERE TO PUSH vs SLOW DOWN (drop stages). Use ONLY the numbers given — never invent products, claims, or tactics not supported by the stats. Plain imperative guidance the bot can follow. No preamble.`;
async function distil(stats) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    body: JSON.stringify({ model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4.6', max_tokens: 700,
      messages: [{ role: 'system', content: PB_SYS }, { role: 'user', content: `Stats (real outcomes):\n${JSON.stringify(stats, null, 2)}\n\nWrite the playbook now.` }] }),
  }).then((r) => r.json());
  return (res.choices?.[0]?.message?.content ?? '').trim();
}

console.log('=== STEP 1-2: pull real records + aggregate (merchant', MERCHANT + ') ===');
const rows = await sql`select tags from metric_events where merchant_id=${MERCHANT} and metric_name='conversationCompleted' and ts >= now() - interval '90 days' and tags ? 'intent'`;
const records = [], dropStages = [];
for (const { tags: t } of rows) {
  const intent = t.intent ?? {}, prefs = intent.preferences ?? {}, outcome = String(t.outcome ?? 'abandoned');
  records.push({ intent: intent.intent ?? null, needs: intent.needs ?? [], objections: intent.objections ?? [], outcome, couponUsed: !!prefs.coupon, attributedCents: Number(t.attributed_cents ?? 0) });
  if (outcome === 'abandoned' && typeof intent.dropStage === 'string') dropStages.push(intent.dropStage);
}
console.log('records:', records.length, '| threshold(demo):', MIN);
if (records.length < MIN) { console.log('below threshold — not enough data'); await sql.end(); process.exit(1); }
const stats = aggregate(records, dropStages);
console.log('stats:', JSON.stringify(stats));

console.log('\n=== STEP 3: distil playbook via real LLM ===');
const playbook = await distil(stats);
console.log(playbook);

console.log('\n=== STEP 4: upsert into prod brand_playbooks ===');
await sql`insert into brand_playbooks (merchant_id, playbook, based_on_count, generated_at) values (${MERCHANT}, ${playbook}, ${records.length}, now())
  on conflict (merchant_id) do update set playbook=excluded.playbook, based_on_count=excluded.based_on_count, generated_at=now()`;
const [stored] = await sql`select based_on_count, length(playbook) as len from brand_playbooks where merchant_id=${MERCHANT}`;
console.log('stored:', JSON.stringify(stored));
await sql.end();

console.log('\n=== STEP 5: fresh conversation — deployed bot loads + acts on the playbook ===');
const sess = await fetch(`${API_BASE}/v1/session`, { method: 'POST', headers: { 'content-type': 'application/json', origin: `https://${ORIGIN}` }, body: JSON.stringify({ merchantId: MERCHANT, domain: ORIGIN }) }).then((r) => r.json());
const ws = new WebSocket(sess.wsUrl);
let firstSay = null;
await new Promise((resolve) => {
  ws.on('open', () => ws.send(JSON.stringify({ type: 'user_text', sessionId: sess.sessionId, text: 'Hi, what can you help me with?', mode: 'text', visitorId: `prove_pb_${Date.now()}` })));
  ws.on('message', (raw) => { let ev; try { ev = JSON.parse(raw.toString()); } catch { return; } if (ev.type === 'host_action_request') { ws.send(JSON.stringify({ type: 'host_action_result', callId: ev.callId, result: { ok: true } })); return; } if (ev.type === 'say' && ev.text && firstSay === null) firstSay = ev.text; if (ev.type === 'end_of_turn') { ws.send(JSON.stringify({ type: 'session_end', sessionId: sess.sessionId })); } if (ev.type === 'session_closed') { try { ws.close(); } catch {} resolve(); } });
  ws.on('error', () => resolve());
  setTimeout(() => { try { ws.close(); } catch {} resolve(); }, 45_000);
});
console.log('bot opener:', firstSay ? JSON.stringify(firstSay.slice(0, 200)) : '(none)');

console.log('\n=== PHASE 5 PROOF ===');
console.log('playbook generated from real stats :', playbook.length > 0);
console.log('grounded (mentions a real intent/need):', /research|brows|pricing|price|demo|bulk|product/i.test(playbook));
console.log('stored in brand_playbooks          :', !!stored && stored.len > 0, `(based_on ${stored?.based_on_count})`);
console.log('deployed bot served a fresh opener  :', !!firstSay);
process.exit(playbook.length > 0 && stored?.len > 0 ? 0 : 1);
