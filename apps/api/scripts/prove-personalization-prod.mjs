// PROD proof of Phase-2 cross-session personalization, headless. Drives TWO text
// conversations as the SAME visitorId through the deployed api WS:
//   convo #1 — visitor states a need + their name; session_end -> text path writes
//             the visitor_profiles row (the upsert Phase 1 deferred).
//   convo #2 — same visitorId opens with a bare "hi"; if personalization works the
//             bot greets them BY NAME (it can only know the name from the loaded
//             profile injected into the system prompt) and sessionCount merges 1->2.
//
// Usage: PUB=<DATABASE_PUBLIC_URL> node apps/api/scripts/prove-personalization-prod.mjs
import WebSocket from 'ws';
import postgres from '../../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js';

const API_BASE = process.env.SHOPPINGMATE_API_BASE || 'https://api-production-1ea1.up.railway.app';
const MERCHANT_ID = process.env.SHOPPINGMATE_DEMO_MERCHANT_ID || 'SM-XPK2EN';
const ORIGIN = process.env.SHOPPINGMATE_DEMO_DOMAIN || 'shoppingmate-web.vercel.app';
const VISITOR = `prove_pers_${Date.now()}`;

async function runConversation(turns, { captureFirstSay = false } = {}) {
  const sess = await fetch(`${API_BASE}/v1/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: `https://${ORIGIN}` },
    body: JSON.stringify({ merchantId: MERCHANT_ID, domain: ORIGIN }),
  }).then((r) => r.json());
  const ws = new WebSocket(sess.wsUrl);
  let turn = 0;
  let firstSay = null;
  const sendTurn = () => {
    if (turn >= turns.length) { ws.send(JSON.stringify({ type: 'session_end', sessionId: sess.sessionId })); return; }
    const text = turns[turn++];
    ws.send(JSON.stringify({ type: 'user_text', sessionId: sess.sessionId, text, mode: 'text', visitorId: VISITOR }));
  };
  await new Promise((resolve) => {
    ws.on('open', sendTurn);
    ws.on('message', (raw) => {
      let ev; try { ev = JSON.parse(raw.toString()); } catch { return; }
      if (ev.type === 'host_action_request') { ws.send(JSON.stringify({ type: 'host_action_result', callId: ev.callId, result: { ok: true } })); return; }
      if (ev.type === 'say' && ev.text) { if (captureFirstSay && firstSay === null) firstSay = ev.text; console.log(`  ⇐ say: ${String(ev.text).slice(0, 110)}`); }
      if (ev.type === 'end_of_turn') sendTurn();
      if (ev.type === 'session_closed') { try { ws.close(); } catch {} resolve(); }
    });
    ws.on('error', () => resolve());
    setTimeout(() => { try { ws.close(); } catch {} resolve(); }, 60_000);
  });
  return { sessionId: sess.sessionId, firstSay };
}

const sql = postgres(process.env.PUB, { max: 1 });
const loadProfile = async () => (await sql`
  select session_count, identity, top_intents, needs, last_outcome, last_seen
  from visitor_profiles where merchant_id = ${MERCHANT_ID} and visitor_id = ${VISITOR} limit 1`)[0] ?? null;
const waitForProfile = async (minCount) => {
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    const p = await loadProfile();
    if (p && p.session_count >= minCount) return p;
  }
  return await loadProfile();
};

console.log(`\n=== CONVO #1 (visitorId=${VISITOR}) — establish identity + intent ===`);
await runConversation([
  'Hi, I run a small skincare store and I struggle to convert browsers into buyers. What does shoppingmate do?',
  'Interesting. By the way my name is Karan and I am based in Mumbai.',
  'Ok, sounds a bit pricey though. Let me think about it and come back later.',
]);
console.log('  waiting for text-path visitor_profiles upsert...');
const p1 = await waitForProfile(1);
console.log('  profile after convo #1:', p1 ? JSON.stringify({ sessionCount: p1.session_count, identity: p1.identity, lastOutcome: p1.last_outcome }) : 'NOT FOUND');

console.log(`\n=== CONVO #2 (SAME visitorId) — bare "hi", expect name-aware greeting ===`);
const { firstSay } = await runConversation(['hi there'], { captureFirstSay: true });
const p2 = await waitForProfile(2);

await sql.end();

console.log('\n=== PHASE 2 PROOF RESULT ===');
const wrote = !!p1;
const merged = !!p2 && p2.session_count >= 2;
const nameAware = !!firstSay && /karan/i.test(firstSay);
console.log('text path WROTE profile (convo #1)      :', wrote, p1 ? `(sessionCount=${p1.session_count})` : '');
console.log('profile MERGED across sessions (1->2)   :', merged, p2 ? `(sessionCount=${p2.session_count})` : '');
console.log('convo #2 first bot reply                :', firstSay ? JSON.stringify(firstSay.slice(0, 160)) : '(none)');
console.log('bot GREETED returning visitor by name   :', nameAware);
console.log('\nOVERALL:', wrote && merged ? 'PASS (write+merge proven)' : 'PARTIAL', nameAware ? '+ name-aware personalization' : '(name-greet not detected — check reply above)');
process.exit(wrote && merged ? 0 : 1);
