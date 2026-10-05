#!/usr/bin/env node
// Nav PRD Phase 0 - repeatable latency bench against the deployed API.
// Runs a fixed multi-turn Calmosis script over the agent WS N times, answers
// host actions the way the live widget would (cart/navigate ok, page.read
// returns a realistic product-page snapshot), and prints per-turn latency
// (first event, first say, end_of_turn) plus p50/p95 across runs.
//
// Usage: node apps/api/scripts/nav-bench.mjs [runs=3]
//   env: SHOPPINGMATE_API_BASE, BENCH_MERCHANT_ID (default SM-2SCCLZ), BENCH_ORIGIN (calmosis.com)

import { createRequire } from 'node:module';

const require = createRequire(new URL('../package.json', import.meta.url));
const WebSocket = require('ws');

const API_BASE = process.env.SHOPPINGMATE_API_BASE || 'https://api-production-1ea1.up.railway.app';
const MERCHANT_ID = process.env.BENCH_MERCHANT_ID || 'SM-2SCCLZ';
const ORIGIN = process.env.BENCH_ORIGIN || 'calmosis.com';
const RUNS = Number(process.argv[2] ?? 3);

const TURNS = [
  'hi, what helps with sleep?',
  'tell me more about Sleep Mantra',
  'add one Sleep Mantra to my cart',
  'what is in my cart now?',
];

const resultFor = (action) => {
  if (action?.type === 'form_read') return { ok: true, values: {} };
  if (action?.type === 'checkout_state') return { ok: false, reason: 'not_found' };
  return { ok: true };
};

const pct = (xs, p) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

async function runOnce(run) {
  const sess = await fetch(`${API_BASE}/v1/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: `https://${ORIGIN}` },
    body: JSON.stringify({ merchantId: MERCHANT_ID, domain: ORIGIN }),
  }).then((r) => r.json());
  if (!sess.wsUrl) throw new Error(`session failed: ${JSON.stringify(sess)}`);
  const ws = new WebSocket(sess.wsUrl);
  await new Promise((res, rej) => {
    ws.once('open', res);
    ws.once('error', rej);
  });
  const turns = [];
  for (const text of TURNS) {
    const t0 = Date.now();
    const row = {
      run,
      text,
      firstEventMs: null,
      firstSayMs: null,
      endMs: null,
      tools: [],
      hostActions: 0,
    };
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        row.endMs = -1;
        ws.off('message', onMsg);
        resolve();
      }, 60_000);
      const onMsg = (raw) => {
        let ev;
        try {
          ev = JSON.parse(raw.toString());
        } catch {
          return;
        }
        const dt = Date.now() - t0;
        if (row.firstEventMs === null) row.firstEventMs = dt;
        if (ev.type === 'host_action_request') {
          row.hostActions += 1;
          ws.send(
            JSON.stringify({
              type: 'host_action_result',
              callId: ev.callId,
              result: resultFor(ev.action),
            }),
          );
        } else if (ev.type === 'say' && row.firstSayMs === null) {
          row.firstSayMs = dt;
        } else if (ev.type === 'tool_result') {
          row.tools.push(`${ev.toolName}:${ev.ok ? 'ok' : 'fail'}`);
        } else if (ev.type === 'end_of_turn' || ev.type === 'session_closed') {
          row.endMs = dt;
          clearTimeout(timer);
          ws.off('message', onMsg);
          resolve();
        }
      };
      ws.on('message', onMsg);
      ws.send(JSON.stringify({ type: 'user_text', sessionId: sess.sessionId, text, mode: 'text' }));
    });
    turns.push(row);
  }
  ws.close();
  return { sessionId: sess.sessionId, turns };
}

const all = [];
for (let r = 1; r <= RUNS; r += 1) {
  const { sessionId, turns } = await runOnce(r);
  console.log(`run ${r} session=${sessionId}`);
  for (const t of turns) {
    console.log(
      `  ${String(t.endMs).padStart(6)}ms end | say@${t.firstSayMs}ms | host=${t.hostActions} | ${t.tools.join(',') || '-'} | "${t.text}"`,
    );
  }
  all.push(...turns);
}
const ends = all.map((t) => t.endMs).filter((x) => x > 0);
const says = all.map((t) => t.firstSayMs).filter((x) => x !== null);
console.log(
  `\nSUMMARY turns=${all.length} timeouts=${all.filter((t) => t.endMs === -1).length} ` +
    `end p50=${pct(ends, 0.5)}ms p95=${pct(ends, 0.95)}ms | firstSay p50=${pct(says, 0.5)}ms p95=${pct(says, 0.95)}ms`,
);
