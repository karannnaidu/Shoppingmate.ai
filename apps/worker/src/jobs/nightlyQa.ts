import { db as defaultDb, schema } from '@shoppingmate/db';
import { siteTemplateScanQueue } from '@shoppingmate/jobs';
import { logger } from '@shoppingmate/shared';
import { and, eq } from 'drizzle-orm';
import { type Browser, type BrowserContextOptions, chromium, devices, webkit } from 'playwright';

// Nav PRD Phase 6 — nightly synthetic QA per merchant, across browsers and
// devices. Cheap structural checks on every combo (no LLM): the widget loads
// and its launcher is visible, the page still matches its learned template,
// the template's key controls are present + enabled, and our widget logs no
// errors. One combo also runs a real chat turn (LLM) to prove the bot answers.
// Failures → `alerts` row (internal ops), template marked stale (re-scan), and
// an optional Slack webhook (OPS_SLACK_WEBHOOK_URL).

export type QaCombo = {
  name: string;
  engine: 'chromium' | 'webkit';
  context: BrowserContextOptions;
};

export const COMBOS: QaCombo[] = [
  {
    name: 'chrome-desktop',
    engine: 'chromium',
    context: { viewport: { width: 1366, height: 900 } },
  },
  { name: 'chrome-android', engine: 'chromium', context: { ...devices['Pixel 7'] } },
  { name: 'safari-desktop', engine: 'webkit', context: { viewport: { width: 1366, height: 900 } } },
  { name: 'safari-iphone', engine: 'webkit', context: { ...devices['iPhone 13'] } },
];

export type QaCheck = { check: string; pass: boolean; detail?: string };
export type QaResult = { merchantId: string; combo: string; url: string; checks: QaCheck[] };

type Template = {
  id: string;
  pageType: string;
  skeleton: string[];
  recipes: Array<{ action: string; role: string; name: string }>;
  sampleUrls: string[];
};

/** Pure: evaluate the structural checks from what the page reported. */
export function evaluatePage(input: {
  widgetPresent: boolean;
  launcherVisible: boolean;
  keys: string[] | null;
  snapshot: string | null;
  widgetErrors: string[];
  template: Pick<Template, 'skeleton' | 'recipes'> | null;
}): QaCheck[] {
  const checks: QaCheck[] = [
    { check: 'widget loads', pass: input.widgetPresent },
    { check: 'launcher visible', pass: input.launcherVisible },
    {
      check: 'no widget errors',
      pass: input.widgetErrors.length === 0,
      detail: input.widgetErrors.slice(0, 2).join(' | ') || undefined,
    },
  ];
  if (input.template && input.keys && input.template.skeleton.length >= 4) {
    const live = new Set(input.keys);
    const hit = input.template.skeleton.filter((k) => live.has(k)).length;
    const coverage = hit / input.template.skeleton.length;
    checks.push({
      check: 'matches learned layout',
      pass: coverage >= 0.7,
      detail: coverage.toFixed(2),
    });
  }
  if (input.template && input.snapshot) {
    for (const r of input.template.recipes.filter((x) => x.action !== 'variant')) {
      const line = input.snapshot.split('\n').find((l) => l.includes(`${r.role} "${r.name}"`));
      checks.push({
        check: `${r.action.replace(/_/g, ' ')} control usable`,
        pass: Boolean(line) && !/\(.*disabled.*\)/.test(line ?? ''),
        detail: line ? undefined : 'not found',
      });
    }
  }
  return checks;
}

async function checkPage(
  browser: Browser,
  combo: QaCombo,
  url: string,
  template: Template | null,
  chatProbe: boolean,
) {
  const ctx = await browser.newContext(combo.context);
  const page = await ctx.newPage();
  const widgetErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && /shoppingmate/i.test(m.text()))
      widgetErrors.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => {
    if (/shoppingmate|widget\/v1/i.test(`${e.message} ${e.stack ?? ''}`))
      widgetErrors.push(e.message.slice(0, 200));
  });
  // Listen from the start: the agent socket opens at page load, long before
  // the probe types, so a late listener would never see the reply.
  let replied = false;
  page.on('websocket', (ws) =>
    ws.on('framereceived', (f) => {
      if (/"type":"say"/.test(String(f.payload))) replied = true;
    }),
  );
  const checks: QaCheck[] = [];
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(8000);
    // Runs in the page (string form: the worker's TS config has no DOM types).
    const facts = (await page.evaluate(`(() => {
      const w = document.querySelector('shoppingmate-widget');
      const root = w && w.shadowRoot ? w.shadowRoot.querySelector('.root') : null;
      const visible = !!root && getComputedStyle(root).visibility !== 'hidden' && root.getBoundingClientRect().width > 0;
      const nav = window.__shoppingmateNav__;
      return { widgetPresent: !!w, launcherVisible: visible, snapshot: nav ? nav.snapshot() : null, keys: nav ? nav.keys() : null };
    })()`)) as {
      widgetPresent: boolean;
      launcherVisible: boolean;
      snapshot: string | null;
      keys: string[] | null;
    };
    checks.push(...evaluatePage({ ...facts, widgetErrors, template }));

    if (chatProbe && facts.launcherVisible) {
      // One real turn: the bot must answer (proves api + LLM + widget wiring).
      replied = false;
      const input = page.locator('shoppingmate-widget input[type="text"]').first();
      // Like a shopper: tap the avatar (wakes the collapsed pill), then chat.
      // The pill animates, so fall back to a forced click if it never settles.
      const toggle = page.locator('shoppingmate-widget [data-action="toggle"]').first();
      const chat = page.locator('shoppingmate-widget [data-action="chat"]').first();
      for (
        let attempt = 0;
        attempt < 3 && !(await input.isVisible().catch(() => false));
        attempt++
      ) {
        await toggle.hover({ timeout: 3000 }).catch(() => {});
        await toggle
          .click({ timeout: 4000 })
          .catch(() => toggle.click({ force: true }).catch(() => {}));
        await page.waitForTimeout(700);
        if (!(await input.isVisible().catch(() => false))) {
          await chat
            .click({ timeout: 4000 })
            .catch(() => chat.click({ force: true }).catch(() => {}));
          await page.waitForTimeout(700);
        }
      }
      let step = 'open chat';
      try {
        await input.waitFor({ state: 'visible', timeout: 15_000 });
        step = 'type';
        await input.fill('hi, what do you recommend?', { timeout: 10_000 });
        await input.press('Enter');
        step = 'wait for reply';
        const deadline = Date.now() + 45_000;
        while (!replied && Date.now() < deadline) await page.waitForTimeout(500);
      } catch {
        /* reported via step */
      }
      checks.push({
        check: 'bot answers a message',
        pass: replied,
        detail: replied ? undefined : `stuck at: ${step}`,
      });
    }
  } catch (err) {
    checks.push({ check: 'page loads', pass: false, detail: (err as Error).message.slice(0, 200) });
  } finally {
    await ctx.close();
  }
  return checks;
}

async function alertOps(
  merchantId: string,
  failures: QaResult[],
  db: typeof defaultDb,
): Promise<void> {
  const payload = {
    failures: failures.map((f) => ({
      combo: f.combo,
      url: f.url,
      failed: f.checks.filter((c) => !c.pass),
    })),
  };
  await db
    .insert(schema.alerts)
    .values({ merchantId, kind: 'qa.journey_failed', severity: 'warning', payload });
  const hook = process.env.OPS_SLACK_WEBHOOK_URL;
  if (hook) {
    const lines = payload.failures
      .map(
        (f) =>
          `• ${f.combo} ${f.url}: ${f.failed.map((c) => `${c.check}${c.detail ? ` (${c.detail})` : ''}`).join(', ')}`,
      )
      .join('\n');
    await fetch(hook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: `:rotating_light: Nightly QA failed for ${merchantId}\n${lines}`,
      }),
    }).catch(() => {});
  }
}

export async function runNightlyQa(args: {
  merchantId: string;
  combos?: string[];
  db?: typeof defaultDb;
}): Promise<{ results: QaResult[]; passed: number; total: number }> {
  const db = args.db ?? defaultDb;
  const merchant = await db.query.merchants.findFirst({
    where: eq(schema.merchants.id, args.merchantId),
  });
  if (!merchant) return { results: [], passed: 0, total: 0 };
  const templates = (await db
    .select({
      id: schema.siteTemplates.id,
      pageType: schema.siteTemplates.pageType,
      skeleton: schema.siteTemplates.skeleton,
      recipes: schema.siteTemplates.recipes,
      sampleUrls: schema.siteTemplates.sampleUrls,
    })
    .from(schema.siteTemplates)
    .where(eq(schema.siteTemplates.merchantId, merchant.id))) as Template[];
  const pdp = templates.find((t) => t.pageType === 'pdp') ?? null;
  const home = templates.find((t) => t.pageType === 'home') ?? null;
  const targets: Array<{ url: string; template: Template | null }> = [
    { url: home?.sampleUrls[0] ?? `https://${merchant.domain}/`, template: home },
  ];
  if (pdp?.sampleUrls[0]) targets.push({ url: pdp.sampleUrls[0], template: pdp });

  const combos = COMBOS.filter((c) => !args.combos || args.combos.includes(c.name));
  const browsers: Partial<Record<'chromium' | 'webkit', Browser>> = {};
  const results: QaResult[] = [];
  try {
    for (const combo of combos) {
      browsers[combo.engine] ??= await (combo.engine === 'webkit' ? webkit : chromium).launch({
        headless: true,
        ...(combo.engine === 'chromium' ? { args: ['--no-sandbox'] } : {}),
      });
      const browser = browsers[combo.engine] as Browser;
      for (const [i, t] of targets.entries()) {
        const chatProbe = combo.name === 'chrome-desktop' && i === 0;
        const checks = await checkPage(browser, combo, t.url, t.template, chatProbe);
        results.push({ merchantId: merchant.id, combo: combo.name, url: t.url, checks });
      }
    }
  } finally {
    for (const b of Object.values(browsers)) await b?.close().catch(() => {});
  }

  let passed = 0;
  let total = 0;
  for (const r of results) {
    for (const c of r.checks) {
      total += 1;
      if (c.pass) passed += 1;
    }
    await db.insert(schema.metricEvents).values({
      merchantId: merchant.id,
      metricName: 'qa.journey',
      tags: { combo: r.combo, url: r.url, ok: r.checks.every((c) => c.pass), checks: r.checks },
    });
  }
  const failures = results.filter((r) => r.checks.some((c) => !c.pass));
  if (failures.length > 0) {
    await alertOps(merchant.id, failures, db);
    // A layout mismatch means the learned template is out of date → re-scan.
    const drifted = failures.some((f) =>
      f.checks.some((c) => c.check === 'matches learned layout' && !c.pass),
    );
    if (drifted && pdp) {
      await db
        .update(schema.siteTemplates)
        .set({ status: 'stale', scanTrigger: 'qa', updatedAt: new Date() })
        .where(
          and(
            eq(schema.siteTemplates.id, pdp.id),
            eq(schema.siteTemplates.merchantId, merchant.id),
          ),
        );
      await siteTemplateScanQueue.add('scan', { merchantId: merchant.id, trigger: 'qa' });
    }
  }
  logger.info(
    { merchantId: merchant.id, passed, total, failures: failures.length },
    'nightly qa done',
  );
  return { results, passed, total };
}
