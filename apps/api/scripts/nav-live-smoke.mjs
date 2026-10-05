#!/usr/bin/env node
// Nav PRD live smoke — drives the REAL widget on a live storefront in a real
// browser (Playwright/Chromium), types chat turns, and logs every agent⇄widget
// frame on the wire: host_action_request / host_action_result (with snapshot
// size and verified/observed), tool results, and the bot's replies.
//
// Usage: node apps/api/scripts/nav-live-smoke.mjs [url] ["turn 1" "turn 2" ...]
//   default url: https://calmosis.com/
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../../packages/dom-harness/package.json', import.meta.url));
const { chromium } = require('playwright');

const url = process.argv[2] || 'https://calmosis.com/';
const turns =
  process.argv.length > 3
    ? process.argv.slice(3)
    : [
        'take me to the Sleep Mantra page',
        'look at this page and tell me exactly which buttons and options you can see',
        'open the first expandable section or tab on this page for me',
      ];
const headless = process.env.HEADED !== '1';

const browser = await chromium.launch({ headless });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const t0 = Date.now();
const log = (...a) => console.log(`[${String(Date.now() - t0).padStart(6)}ms]`, ...a);

let onEnd = null;
page.on('websocket', (ws) => {
  if (!/agent|ws|session/i.test(ws.url())) return;
  log('WS open', ws.url().replace(/token=[^&]+/, 'token=…'));
  const handle = (dir) => (frame) => {
    let ev;
    try {
      ev = JSON.parse(typeof frame.payload === 'string' ? frame.payload : frame.payload.toString());
    } catch {
      return;
    }
    if (ev.type === 'host_action_request') {
      log(`${dir} host_action_request`, JSON.stringify(ev.action).slice(0, 200));
    } else if (ev.type === 'host_action_result') {
      const r = ev.result ?? {};
      const snap = r.values?.snapshot;
      if (snap) {
        log(
          `${dir} host_action_result ok=${r.ok} snapshot chars=${snap.length} refs=${r.values.refs} buildMs=${r.values.buildMs}`,
        );
        console.log(snap.split('\n').slice(0, 25).map((l) => `           | ${l}`).join('\n'));
      } else {
        log(`${dir} host_action_result`, JSON.stringify(r).slice(0, 300));
      }
    } else if (ev.type === 'tool_result') {
      log(`${dir} tool_result ${ev.toolName} ok=${ev.ok}`);
    } else if (ev.type === 'say') {
      log(`${dir} say: ${ev.text}`);
    } else if (ev.type === 'end_of_turn') {
      log(`${dir} end_of_turn`);
      onEnd?.();
    } else if (ev.type === 'user_text') {
      log(`${dir} user_text: ${ev.text}`);
    }
  };
  ws.on('framereceived', handle('⇐'));
  ws.on('framesent', handle('⇒'));
});

// LOCAL_WIDGET=path/to/v1.js serves a local widget build in place of the
// deployed bundle, so an unreleased widget can be proven on the live site.
if (process.env.LOCAL_WIDGET) {
  const { readFileSync } = await import('node:fs');
  const body = readFileSync(process.env.LOCAL_WIDGET);
  await page.route('**/widget/v1.js*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body }),
  );
  log('serving local widget', process.env.LOCAL_WIDGET);
}

await page.goto(url, { waitUntil: 'domcontentloaded' });
log('loaded', url);
await page.waitForSelector('shoppingmate-widget', { state: 'attached', timeout: 30_000 });
await page.waitForTimeout(3000);
const input = page.locator('shoppingmate-widget input[type="text"]').first();
async function openChat() {
  if (await input.isVisible().catch(() => false)) return;
  // A storefront cart drawer (opened by an add-to-cart) hides the widget by
  // design; close it like a shopper would before continuing the chat.
  await page.keyboard.press('Escape').catch(() => {});
  const closeBtn = page.locator('[aria-label*="close" i]:visible').first();
  if (!(await input.isVisible().catch(() => false)) && (await closeBtn.count())) {
    await closeBtn.click({ timeout: 3000 }).catch(() => {});
  }
  await page.waitForTimeout(800);
  if (await input.isVisible().catch(() => false)) return;
  const chatBtn = page.locator('shoppingmate-widget [data-action="chat"]').first();
  if (await chatBtn.isVisible().catch(() => false)) await chatBtn.click();
  else await page.locator('shoppingmate-widget [data-action="toggle"]').first().click();
  await input.waitFor({ state: 'visible', timeout: 20_000 });
}

// MUTATE=1 simulates a site redesign (drift): relabel the page's buttons and
// drop its nav links before the bot reads the page.
if (process.env.MUTATE === '1') {
  const n = await page.evaluate(() => {
    let c = 0;
    for (const b of Array.from(document.querySelectorAll('main button, main a, header a, footer a'))) {
      if (b.closest('shoppingmate-widget')) continue;
      b.textContent = `Redesigned ${c++}`;
    }
    return c;
  });
  log('MUTATE relabelled', n, 'controls');
}

for (const text of turns) {
  await openChat();
  const done = new Promise((resolve) => {
    onEnd = resolve;
    setTimeout(resolve, 60_000);
  });
  log('TYPE', text);
  await input.fill(text);
  await input.press('Enter');
  await done;
  onEnd = null;
  await page.waitForTimeout(1500);
  log('page now', page.url());
}

await page.screenshot({ path: process.env.SHOT ?? 'nav-live-smoke.png' });
await browser.close();
