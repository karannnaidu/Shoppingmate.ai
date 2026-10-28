#!/usr/bin/env node
// Customer Care PRD live E2E — real widget on a live storefront (Playwright),
// then the production DB, then the brand dashboard as the store owner.
//
//   DBURL=<postgres public url> node apps/api/scripts/care-live-e2e.mjs [scenario]
//   scenario: complaint (default) | feedback | cancel | dashboard
//   DASH_CASE=<id> with "dashboard" re-runs only the dashboard half.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const require = createRequire(new URL('../../../packages/dom-harness/package.json', import.meta.url));
const { chromium } = require('playwright');
const postgres = createRequire(new URL('../../../packages/db/package.json', import.meta.url))('postgres');

const SITE = process.env.SITE ?? 'https://calmosis.com/';
const DASH = process.env.DASH ?? 'https://shoppingmate-web.vercel.app';
const OWNER = process.env.OWNER ?? 'karan4@calmosis.com';
const scenario = process.argv[2] ?? 'complaint';
const sql = postgres(process.env.DBURL, { ssl: 'require', max: 2 });
const t0 = Date.now();
const log = (...a) => console.log(`[${String(Date.now() - t0).padStart(6)}ms]`, ...a);
const SHOT = (n) => `care-e2e-${scenario}-${n}.png`;

const SCRIPTS = {
  complaint: [
    'Hi, my order 48213 arrived damaged. The Sleep Mantra bottle was broken when I opened the box. I want a replacement.',
    '@photo',
    'My name is Test Shopper, email delivered@resend.dev, phone 9876543210. Yes, the team can contact me.',
  ],
  feedback: ['Just wanted to share some feedback: the Sleep Mantra really helped me sleep better, and delivery was quick. Thank you!'],
  cancel: [
    'I want to cancel my order 48214, I ordered by mistake.',
    'Name Test Shopper, email delivered@resend.dev, phone 9876543210. Yes you can contact me.',
  ],
};
const CONFIRMS = ['Yes, that is all correct, please go ahead.', 'Yes, please log it.', 'Yes.'];

async function shopper() {
  const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  let sessionId = null;
  let onEnd = null;
  const cases = [];
  page.on('websocket', (ws) => {
    const handle = (dir) => (frame) => {
      let ev;
      try {
        ev = JSON.parse(typeof frame.payload === 'string' ? frame.payload : frame.payload.toString());
      } catch {
        return;
      }
      if (ev.sessionId && !sessionId) sessionId = ev.sessionId;
      if (ev.type === 'say') log(`${dir} OLIVIA: ${ev.text}`);
      else if (ev.type === 'user_text') log(`${dir} SHOPPER: ${ev.text}`);
      else if (ev.type === 'tool_result') {
        log(`${dir} tool_result ${ev.toolName} ok=${ev.ok}`);
        if (ev.toolName === 'case.open' && ev.ok) cases.push(ev);
      } else if (ev.type === 'end_of_turn') onEnd?.();
    };
    ws.on('framereceived', handle('⇐'));
    ws.on('framesent', handle('⇒'));
  });
  page.on('response', async (r) => {
    if (r.url().includes('/v1/care/upload')) log('UPLOAD', r.status(), await r.text().catch(() => ''));
  });

  await page.goto(SITE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('shoppingmate-widget', { state: 'attached', timeout: 30_000 });
  await page.waitForTimeout(3000);
  const input = page.locator('shoppingmate-widget input[type="text"]').first();
  if (!(await input.isVisible().catch(() => false))) {
    const chatBtn = page.locator('shoppingmate-widget [data-action="chat"]').first();
    if (await chatBtn.isVisible().catch(() => false)) await chatBtn.click();
    else await page.locator('shoppingmate-widget [data-action="toggle"]').first().click();
    await input.waitFor({ state: 'visible', timeout: 20_000 });
  }
  const photo = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 900, height: 700 } });

  async function say(text) {
    const done = new Promise((resolve) => {
      onEnd = resolve;
      setTimeout(resolve, 60_000);
    });
    await input.fill(text);
    await input.press('Enter');
    await done;
    onEnd = null;
    await page.waitForTimeout(1200);
  }

  for (const step of SCRIPTS[scenario]) {
    if (step === '@photo') {
      const attach = page.locator('shoppingmate-widget [data-action="attach"]').first();
      log('camera button visible:', await attach.isVisible());
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), attach.click()]);
      const done = new Promise((resolve) => {
        onEnd = resolve;
        setTimeout(resolve, 60_000);
      });
      await chooser.setFiles({ name: 'broken-bottle.png', mimeType: 'image/png', buffer: photo });
      await done;
      onEnd = null;
      await page.waitForTimeout(1200);
      await page.screenshot({ path: SHOT('photo') });
      continue;
    }
    await say(step);
  }
  for (const c of scenario === 'feedback' ? [] : CONFIRMS) {
    if (cases.length) break;
    await say(c);
  }
  await page.screenshot({ path: SHOT('chat') });
  await browser.close();
  return { sessionId, logged: cases.length > 0 };
}

async function dbCheck(sessionId) {
  const rows = await sql`select id, type, status, order_id, summary, contact_email, urgency from support_cases where session_id = ${sessionId} order by id`;
  for (const c of rows) {
    const atts = await sql`select id, mime, bytes from case_attachments where case_id = ${c.id}`;
    const evs = await sql`select kind, actor from case_events where case_id = ${c.id} order by id`;
    log('CASE', JSON.stringify(c));
    log('  photos', JSON.stringify(atts));
    log('  events', JSON.stringify(evs));
  }
  const loose = await sql`select id, case_id, bytes from case_attachments where session_id = ${sessionId}`;
  log('session photos', JSON.stringify(loose));
  return rows;
}

async function dashboard(caseId) {
  const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await ctx.newPage();
  const since = new Date();
  const r = await ctx.request.post(`${DASH}/api/auth/sign-in/magic-link`, {
    data: { email: OWNER, callbackURL: '/app/cases' },
    headers: { origin: DASH },
  });
  log('magic-link request', r.status());
  let token = null;
  for (let i = 0; i < 10 && !token; i++) {
    const [v] = await sql`select identifier, value from verifications where created_at >= ${since} order by created_at desc limit 1`;
    if (v && String(v.value).includes(OWNER)) token = v.identifier;
    else await new Promise((res) => setTimeout(res, 1000));
  }
  if (!token) throw new Error('no magic-link token found');
  await page.goto(`${DASH}/api/auth/magic-link/verify?token=${encodeURIComponent(token)}&callbackURL=${encodeURIComponent('/app/cases')}`);
  await page.waitForURL(/\/app\/cases/, { timeout: 30_000 });
  log('dashboard at', page.url());
  const card = page.locator('li', { hasText: `#${caseId} ·` }).first();
  await card.waitFor({ timeout: 20_000 });
  log('card text:', (await card.innerText()).replace(/\s+/g, ' ').slice(0, 400));
  const img = card.locator('img[alt^="Customer photo"]').first();
  if (await img.count()) {
    await img.scrollIntoViewIfNeeded();
    await img.evaluate((el) => (el.complete ? null : new Promise((r) => { el.onload = el.onerror = r; setTimeout(r, 8000); })));
    log('photo naturalWidth:', await img.evaluate((el) => el.naturalWidth));
    const direct = await ctx.request.get(`${DASH}${await img.getAttribute('src')}`, { maxRedirects: 0 });
    log('photo route (owner) status:', direct.status(), 'location host:', new URL(direct.headers().location ?? 'http://none').host);
    const loc = direct.headers().location;
    if (loc) {
      const g = await fetch(loc);
      log('signed R2 GET:', g.status, g.headers.get('content-type'), g.status === 200 ? (await g.arrayBuffer()).byteLength : (await g.text()).slice(0, 300));
      log('signed path:', new URL(loc).pathname);
    }
    const anon = await (await browser.newContext()).request.get(`${DASH}${await img.getAttribute('src')}`, { maxRedirects: 0 });
    log('photo route (signed out) status:', anon.status());
  } else log('photo: none on card');
  await card.screenshot({ path: SHOT('dash-card') });
  const reply = card.getByRole('button', { name: /Reply to customer|Add a note/ });
  if (await reply.count()) {
    await reply.click();
    await card.locator('textarea').fill('Hi, so sorry about the broken bottle. A replacement is on its way today. (shoppingmate test)');
    await card.getByRole('button', { name: /Send reply|Save note/ }).click();
    await card.getByText(/Sent to the customer|Saved as a note|Couldn/).waitFor({ timeout: 20_000 });
    log('reply result:', await card.getByText(/Sent to the customer|Saved as a note|Couldn/).innerText());
    const evs = await sql`select kind, actor, left(body, 60) as body from case_events where case_id = ${caseId} order by id`;
    log('events after reply', JSON.stringify(evs));
    const [st] = await sql`select status from support_cases where id = ${caseId}`;
    log('status after reply', st?.status);
  }
  await page.reload();
  await page.locator('li', { hasText: `#${caseId} ·` }).first().screenshot({ path: SHOT('dash-after') });
  await page.goto(`${DASH}/app/settings#customer-care`);
  const careCard = page.locator('#customer-care');
  await careCard.waitFor({ timeout: 20_000 });
  await careCard.scrollIntoViewIfNeeded();
  log('settings card:', (await careCard.innerText()).replace(/\s+/g, ' ').slice(0, 300));
  await careCard.screenshot({ path: SHOT('settings') });
  await browser.close();
}

try {
  if (scenario === 'dashboard') {
    await dashboard(Number(process.env.DASH_CASE));
  } else {
    const { sessionId, logged } = await shopper();
    log('session', sessionId, 'case.open ok:', logged);
    const rows = await dbCheck(sessionId);
    writeFileSync(`care-e2e-${scenario}.json`, JSON.stringify({ sessionId, cases: rows.map((r) => r.id) }));
    if (scenario === 'complaint' && rows[0]) await dashboard(rows[0].id);
  }
} finally {
  await sql.end();
}
