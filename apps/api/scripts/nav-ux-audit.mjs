#!/usr/bin/env node
// Nav PRD — shopper-side UX audit on a live storefront. Captures screenshots of
// the widget at each step (desktop + mobile) for visual review, and prints
// layout facts (launcher visibility/position, panel overlap with key CTAs).
//
// Usage: node apps/api/scripts/nav-ux-audit.mjs [outDir] [url]
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(new URL('../../../packages/dom-harness/package.json', import.meta.url));
const { chromium, devices } = require('playwright');

const outDir = process.argv[2] || 'ux-audit';
const url = process.argv[3] || 'https://calmosis.com/shop/sleep-mantra';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

async function audit(label, contextOpts) {
  const ctx = await browser.newContext(contextOpts);
  const page = await ctx.newPage();
  if (process.env.LOCAL_WIDGET) {
    const { readFileSync } = await import('node:fs');
    const body = readFileSync(process.env.LOCAL_WIDGET);
    await page.route('**/widget/v1.js*', (r) =>
      r.fulfill({ status: 200, contentType: 'application/javascript', body }),
    );
  }
  let endResolve = null;
  page.on('websocket', (ws) =>
    ws.on('framereceived', (f) => {
      try {
        const ev = JSON.parse(String(f.payload));
        if (ev.type === 'end_of_turn') endResolve?.();
      } catch {}
    }),
  );
  const shot = async (name) => {
    const p = join(outDir, `${label}-${name}.png`);
    await page.screenshot({ path: p });
    console.log(`[${label}] shot ${p}`);
  };
  const facts = async (name) => {
    const f = await page.evaluate(() => {
      const w = document.querySelector('shoppingmate-widget');
      const sr = w?.shadowRoot;
      const root = sr?.querySelector('.root');
      const panel = sr?.querySelector('.panel, [class*="panel"]');
      const r = root?.getBoundingClientRect();
      const pr = panel?.getBoundingClientRect();
      const atc = [...document.querySelectorAll('button')].find((b) => /add to cart/i.test(b.textContent ?? ''));
      const ar = atc?.getBoundingClientRect();
      const overlap =
        pr && ar && pr.width > 0 && ar.width > 0
          ? !(pr.right < ar.left || pr.left > ar.right || pr.bottom < ar.top || pr.top > ar.bottom)
          : null;
      return {
        rootClass: root?.className,
        rootVisible: root ? getComputedStyle(root).visibility : null,
        launcher: r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null,
        panel: pr && pr.width ? [Math.round(pr.left), Math.round(pr.top), Math.round(pr.width), Math.round(pr.height)] : null,
        panelCoversAddToCart: overlap,
        viewport: [innerWidth, innerHeight],
      };
    });
    console.log(`[${label}] ${name}`, JSON.stringify(f));
  };
  const say = async (text) => {
    const input = page.locator('shoppingmate-widget input[type="text"]').first();
    if (!(await input.isVisible().catch(() => false))) {
      // Like a shopper: tap the avatar (wakes the collapsed pill), then chat.
      await page.locator('shoppingmate-widget [data-action="toggle"]').first().click();
      await page.waitForTimeout(600);
      if (!(await input.isVisible().catch(() => false))) {
        await page.locator('shoppingmate-widget [data-action="chat"]').first().click({ timeout: 8000 });
      }
      await input.waitFor({ state: 'visible', timeout: 15_000 });
      await shot('1b-open');
    }
    const done = new Promise((r) => {
      endResolve = r;
      setTimeout(r, 60_000);
    });
    await input.fill(text);
    await input.press('Enter');
    await done;
    await page.waitForTimeout(1200);
  };

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(7000);
  await facts('load');
  await shot('1-load');
  await say('which pack is the best value?');
  await facts('after-reply');
  await shot('2-reply');
  await say('add the best value pack to my cart');
  await facts('after-cart');
  await shot('3-cart');
  await ctx.close();
}

await audit('desktop', { viewport: { width: 1280, height: 900 } });
await audit('mobile', { ...devices['iPhone 13'] });
await browser.close();
