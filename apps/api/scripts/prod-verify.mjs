#!/usr/bin/env node
// Production check on the live custom domain: site + pricing copy, magic-link
// login (sender, link host), dashboard pages, and the demo assistant.
//   DBURL=… RESEND_KEY=… node apps/api/scripts/prod-verify.mjs
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../../packages/dom-harness/package.json', import.meta.url));
const { chromium } = require('playwright');
const postgres = createRequire(new URL('../../../packages/db/package.json', import.meta.url))('postgres');

const SITE = process.env.SITE ?? 'https://www.shoppingmate.shop';
const OWNER = process.env.OWNER ?? 'karan4@calmosis.com';
const sql = postgres(process.env.DBURL, { ssl: 'require', max: 2 });
const t0 = Date.now();
const log = (...a) => console.log(`[${String(Date.now() - t0).padStart(6)}ms]`, ...a);
const results = [];
const check = (name, pass, info = '') => {
  results.push([name, pass]);
  log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? `  — ${info}` : ''}`);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const page = await ctx.newPage();
try {
  // 1. Site + widget + pricing copy
  await page.goto(`${SITE}/`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForSelector('shoppingmate-widget', { state: 'attached', timeout: 45_000 });
  await page.waitForTimeout(4000);
  const launcher = await page.evaluate(() => !!document.querySelector('shoppingmate-widget')?.shadowRoot?.querySelector('[data-action="call"]'));
  check('widget loads on the custom domain', launcher);
  const body = await page.locator('body').innerText();
  check('footer shows hello@shoppingmate.shop', body.includes('hello@shoppingmate.shop'));
  check('no shoppingmate.ai left on the home page', !/shoppingmate\.ai/i.test(await page.content()));
  await page.goto(`${SITE}/pricing`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  const pricing = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  for (const s of ['$30', '$99', '$299', '100 conversations', '350 conversations', '1,000 conversations', 'Customer requests sent to your inbox', 'Heatmaps by page type', 'Export Insights for your team']) {
    check(`pricing shows "${s}"`, pricing.includes(s));
  }
  await page.screenshot({ path: 'prod-pricing.png', fullPage: false });

  // 2. Magic-link login on the custom domain
  const since = new Date();
  const r = await ctx.request.post(`${SITE}/api/auth/sign-in/magic-link`, {
    data: { email: OWNER, callbackURL: '/app' },
    headers: { origin: SITE },
  });
  check('magic-link request accepted on custom domain', r.status() === 200, `HTTP ${r.status()}`);
  let token = null;
  for (let i = 0; i < 15 && !token; i++) {
    const [v] = await sql`select identifier, value from verifications where created_at >= ${since} order by created_at desc limit 1`;
    if (v && String(v.value).includes(OWNER)) token = v.identifier;
    else await new Promise((res) => setTimeout(res, 1000));
  }
  if (process.env.RESEND_KEY) {
    await new Promise((res) => setTimeout(res, 4000));
    const list = await fetch('https://api.resend.com/emails?limit=5', { headers: { Authorization: `Bearer ${process.env.RESEND_KEY}` } }).then((x) => x.json());
    const mail = (list.data ?? []).find((e) => /sign in/i.test(e.subject ?? '') && new Date(e.created_at) >= new Date(since.getTime() - 5000));
    check('login email sent from login@shoppingmate.shop', !!mail && /login@shoppingmate\.shop/.test(mail.from), mail ? `${mail.from} · ${mail.last_event}` : 'not found');
    if (mail) {
      const full = await fetch(`https://api.resend.com/emails/${mail.id}`, { headers: { Authorization: `Bearer ${process.env.RESEND_KEY}` } }).then((x) => x.json());
      const href = /href="([^"]+)"/.exec(full.html ?? '')?.[1] ?? '';
      check('login link points to www.shoppingmate.shop', href.startsWith('https://www.shoppingmate.shop/'), new URL(href || 'http://none').host);
    }
  }
  if (!token) throw new Error('no magic-link token found');
  await page.goto(`${SITE}/api/auth/magic-link/verify?token=${encodeURIComponent(token)}&callbackURL=${encodeURIComponent('/app')}`);
  await page.waitForURL(/\/app/, { timeout: 30_000 });
  check('signed in on the custom domain', new URL(page.url()).host === new URL(SITE).host, page.url());

  // 3. Dashboard pages that back the plan bullets
  for (const [path, must] of [
    ['/app', /conversation/i],
    ['/app/conversations', /conversation/i],
    ['/app/cases', /Customer requests/i],
    ['/app/insights', /insight|stuck|fix/i],
    ['/app/billing', /credit|conversation|plan/i],
    ['/app/settings', /Customer care/i],
  ]) {
    const res = await page.goto(`${SITE}${path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(1500);
    const txt = await page.locator('main, body').first().innerText().catch(() => '');
    check(`dashboard ${path} loads`, (res?.status() ?? 0) < 400 && must.test(txt), `HTTP ${res?.status()}`);
    await page.screenshot({ path: `prod-dash${path.replace(/\//g, '-')}.png` });
  }
  const ins = await page.goto(`${SITE}/api/insights/export?days=7`, { timeout: 60_000 }).catch(() => null);
  log('insights export (Calmosis plan) HTTP', ins?.status());

  // 4. Demo assistant quotes the real plan
  const demo = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  let said = '';
  let done = null;
  demo.on('websocket', (ws) =>
    ws.on('framereceived', (f) => {
      try {
        const ev = JSON.parse(typeof f.payload === 'string' ? f.payload : f.payload.toString());
        if (ev.type === 'say') said += ` ${ev.text}`;
        if (ev.type === 'end_of_turn') done?.();
      } catch {}
    }),
  );
  await demo.goto(`${SITE}/`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await demo.waitForSelector('shoppingmate-widget', { state: 'attached', timeout: 45_000 });
  await demo.waitForTimeout(3000);
  await demo.locator('shoppingmate-widget [data-action="chat"]').first().click();
  const input = demo.locator('shoppingmate-widget input[type="text"]').first();
  await input.waitFor({ state: 'visible', timeout: 20_000 });
  const turn = new Promise((res) => {
    done = res;
    setTimeout(res, 60_000);
  });
  await input.fill('How much is the Growth plan and how many conversations do I get?');
  await input.press('Enter');
  await turn;
  log('demo said:', said.trim().slice(0, 300));
  check('demo quotes Growth correctly ($99 / 350)', /99|ninety-nine/i.test(said) && /350|three hundred fifty/i.test(said) && !/\$60|sixty dollars|500 conversations|five hundred/i.test(said));
  check('demo has no outdated plan claims', !/text-only|four tiers|10K|Pro tier|white-label/i.test(said), said.slice(0, 120));
} finally {
  const failed = results.filter(([, p]) => !p);
  log(`TOTAL ${results.length - failed.length}/${results.length} passed`);
  for (const [n] of failed) log('  FAILED:', n);
  await browser.close();
  await sql.end();
}
