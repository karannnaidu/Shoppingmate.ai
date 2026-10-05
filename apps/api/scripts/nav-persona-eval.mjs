#!/usr/bin/env node
// Nav PRD Phase 5 — persona eval over the live agent WebSocket (text). Each
// persona is a short scripted conversation with human-paced turns; checks
// assert BEHAVIOUR per mode (no upsell when unhappy, fast path when buying…).
//   node apps/api/scripts/nav-persona-eval.mjs
import { createRequire } from 'node:module';

const require = createRequire(new URL('../package.json', import.meta.url));
const WebSocket = require('ws');
const API = process.env.SHOPPINGMATE_API_BASE || 'https://api-production-1ea1.up.railway.app';
const MERCHANT = process.env.BENCH_MERCHANT_ID || 'SM-2SCCLZ';
const ORIGIN = process.env.BENCH_ORIGIN || 'calmosis.com';
const PAUSE_MS = 2500; // human-ish pause so the live signal lands between turns

const UPSELL =
  /bliss club|membership|10% off|discount|coupon|special offer|an offer on|add (it|one|that|this) to (your )?cart|shall we (head|go) to checkout|ready to check ?out|another product|pair (it )?with/i;

const PERSONAS = [
  {
    name: 'angry-refund',
    mode: 'complaint',
    turns: [
      'this is a scam, the drops did nothing and I want my money back',
      'order 10512, TEST Dev 9000011111, yes you can contact me',
      'ok thanks',
    ],
    noUpsell: true,
  },
  {
    name: 'broken-item',
    mode: 'complaint',
    turns: ['my peace mantra bottle came cracked', 'what happens now?', 'alright, thanks'],
    noUpsell: true,
  },
  {
    name: 'late-delivery',
    mode: 'support',
    turns: ["it's been 2 weeks, where is my order 10777?"],
    noUpsell: true,
  },
  {
    name: 'rushed-buyer',
    mode: 'buy',
    turns: ['add one sleep mantra to my cart'],
    expectTool: 'cart.add',
    maxWords: 30,
  },
  {
    name: 'browser',
    mode: 'browse',
    turns: ['what do you have for stress?'],
    expectTool: 'products.search',
  },
  {
    name: 'comparer',
    mode: 'compare',
    turns: ['peace mantra vs green mantra — which one for evening anxiety?'],
  },
  {
    name: 'dosage',
    mode: 'consult',
    turns: ['how many drops of sleep mantra should I take? I am 70 and on blood pressure meds'],
    noUpsell: true,
  },
  {
    name: 'happy-repeat',
    mode: 'buy',
    turns: ['loved green mantra last time, I want 2 more'],
    expectTool: 'cart.add',
  },
];

async function runPersona(p) {
  const sess = await fetch(`${API}/v1/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: `https://${ORIGIN}` },
    body: JSON.stringify({ merchantId: MERCHANT, domain: ORIGIN }),
  }).then((r) => r.json());
  const ws = new WebSocket(sess.wsUrl);
  await new Promise((r) => ws.once('open', r));
  const replies = [];
  const tools = [];
  for (const text of p.turns) {
    const turnReplies = [];
    await new Promise((resolve) => {
      const t = setTimeout(resolve, 60_000);
      const on = (raw) => {
        const ev = JSON.parse(String(raw));
        if (ev.type === 'host_action_request') {
          ws.send(
            JSON.stringify({ type: 'host_action_result', callId: ev.callId, result: { ok: true } }),
          );
        } else if (ev.type === 'say') turnReplies.push(ev.text);
        else if (ev.type === 'tool_result') tools.push(ev.toolName);
        else if (ev.type === 'end_of_turn') {
          clearTimeout(t);
          ws.off('message', on);
          resolve();
        }
      };
      ws.on('message', on);
      ws.send(JSON.stringify({ type: 'user_text', sessionId: sess.sessionId, text, mode: 'text' }));
    });
    replies.push(turnReplies.join(' '));
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  ws.close();
  const all = replies.join(' ');
  const checks = [];
  if (p.noUpsell)
    checks.push({ check: 'no upsell', pass: !UPSELL.test(all), detail: all.match(UPSELL)?.[0] });
  if (p.expectTool)
    checks.push({ check: `uses ${p.expectTool}`, pass: tools.includes(p.expectTool) });
  if (p.maxWords) {
    const words = (replies[0] ?? '').split(/\s+/).filter(Boolean).length;
    checks.push({ check: `reply ≤ ${p.maxWords} words`, pass: words <= p.maxWords, detail: words });
  }
  if (p.mode === 'complaint') {
    checks.push({
      check: 'acknowledges first',
      pass: /sorry|apolog|understand|frustrat/i.test(replies[0] ?? ''),
    });
  }
  return {
    name: p.name,
    mode: p.mode,
    tools,
    checks,
    firstReply: (replies[0] ?? '').slice(0, 160),
  };
}

let pass = 0;
let total = 0;
for (const p of PERSONAS) {
  const r = await runPersona(p);
  for (const c of r.checks) {
    total += 1;
    if (c.pass) pass += 1;
  }
  const status = r.checks.every((c) => c.pass) ? 'PASS' : 'FAIL';
  console.log(`${status} ${r.name} [${r.mode}] tools=${r.tools.join(',') || '-'}`);
  for (const c of r.checks)
    console.log(
      `   ${c.pass ? '✓' : '✗'} ${c.check}${c.detail !== undefined ? ` (${c.detail})` : ''}`,
    );
  console.log(`   “${r.firstReply}”`);
}
console.log(`\nSUMMARY ${pass}/${total} checks passed (${Math.round((100 * pass) / total)}%)`);
