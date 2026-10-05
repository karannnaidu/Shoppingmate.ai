#!/usr/bin/env node
// Nav PRD Phase 8 acceptance — synthetic shoppers on a live store. Headless
// browsers are tagged as QA by the tracker (stored under qa: metrics, never
// mixed with real numbers). Each persona browses differently: bouncers, deep
// readers, product lookers, add-to-cart, frustrated tappers, form abandoners.
//   node apps/api/scripts/nav-insights-traffic.mjs [sessions=24] [origin=https://calmosis.com]
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../../packages/dom-harness/package.json', import.meta.url));
const { chromium, devices } = require('playwright');

const N = Number(process.argv[2] ?? 24);
const ORIGIN = process.argv[3] ?? 'https://calmosis.com';
const PDPS = ['/shop/sleep-mantra', '/shop/peace-mantra', '/shop/green-mantra'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const wait = (p, ms) => p.waitForTimeout(ms);

const PERSONAS = ['bouncer', 'reader', 'looker', 'buyer', 'frustrated', 'abandoner'];
let beacons = 0;

async function session(browser, i) {
  const mobile = i % 2 === 0;
  const ctx = await browser.newContext(mobile ? { ...devices['iPhone 13'] } : { viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  page.on('request', (r) => {
    if (r.url().includes('/v1/insights/pageview')) beacons += 1;
  });
  const persona = PERSONAS[i % PERSONAS.length];
  const src = pick(['?sm_qa=1', '?sm_qa=1&utm_source=instagram', '?sm_qa=1&utm_source=google', '?sm_qa=1&utm_source=newsletter']);
  try {
    await page.goto(`${ORIGIN}/${src}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await wait(page, 6000); // widget bootstraps + tracker starts
    if (persona === 'bouncer') {
      await wait(page, 1500);
    } else {
      for (let s = 0; s < 4; s++) {
        await page.mouse.wheel(0, 700);
        await wait(page, 900);
      }
      // go to a product (SPA click on a product link, else direct)
      const link = page.locator(`a[href*="/shop/"]`).first();
      if (await link.count()) await link.click({ timeout: 5000 }).catch(() => page.goto(`${ORIGIN}${pick(PDPS)}`));
      else await page.goto(`${ORIGIN}${pick(PDPS)}`);
      await wait(page, 3000);
      if (persona !== 'looker') {
        for (let s = 0; s < 3; s++) {
          await page.mouse.wheel(0, 600);
          await wait(page, 800);
        }
      }
      if (persona === 'frustrated') {
        // tap a non-interactive heading repeatedly (rage + dead taps)
        const h = page.locator('h1:visible').first();
        for (let k = 0; k < 4; k++) await h.click({ timeout: 3000, force: true }).catch(() => {});
        await wait(page, 1200);
      }
      if (persona === 'buyer' || persona === 'abandoner') {
        const atc = page.getByRole('button', { name: /add to cart/i }).first();
        await atc.click({ timeout: 6000 }).catch(() => {});
        await wait(page, 2500);
        if (persona === 'abandoner') {
          await page.goto(`${ORIGIN}/checkout`, { waitUntil: 'domcontentloaded' }).catch(() => {});
          await wait(page, 3000);
          const field = page.locator('input[name*="pin" i], input[placeholder*="pin" i], input[type="text"]').first();
          await field.focus({ timeout: 4000 }).catch(() => {});
          await wait(page, 1000);
        }
      }
    }
    // end the pageview the way a shopper does: leave
    await page.goto('about:blank').catch(() => {});
    await wait(page, 800);
  } catch (err) {
    console.log(`session ${i} (${persona}) error: ${err.message.split('\n')[0]}`);
  } finally {
    await ctx.close();
  }
  console.log(`session ${i + 1}/${N} ${persona} ${mobile ? 'mobile' : 'desktop'} ${src || 'direct'} · beacons so far ${beacons}`);
}

const browser = await chromium.launch();
for (let i = 0; i < N; i++) await session(browser, i);
await browser.close();
console.log(`DONE sessions=${N} beacons=${beacons}`);
