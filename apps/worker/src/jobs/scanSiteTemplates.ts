import { randomUUID } from 'node:crypto';
import { db as defaultDb, schema } from '@shoppingmate/db';
import type { TemplateRecipe } from '@shoppingmate/db';
import { logger } from '@shoppingmate/shared';
import { and, eq, sql } from 'drizzle-orm';
import type { Browser } from 'playwright';
import { getBrowser } from '../lib/playwright.js';
import { uploadObject as defaultUpload } from '../r2-upload.js';

// Nav PRD Phase 2 — scan a merchant's page TEMPLATES in a real browser.
//
// For each page type we load up to 3 sample pages, inject the live widget
// bundle (without a data-id, so no widget/session starts) and read page keys
// via window.__shoppingmateNav__ — the exact code the live widget uses. The
// skeleton is the intersection of the samples' keys (product-specific text drops
// out); recipes describe how the page works; full-page desktop + mobile
// screenshots are stored for the dashboard / Phase 8 heatmaps.

const WIDGET_BUNDLE_URL =
  process.env.WIDGET_BUNDLE_URL ?? 'https://shoppingmate-web.vercel.app/widget/v1.js';
const SAMPLES_PER_TYPE = 3;
const SCAN_TYPES = ['home', 'pdp', 'plp', 'collection', 'faq', 'policy'] as const;

export type ScanArgs = {
  merchantId: string;
  pageType?: string;
  trigger?: string;
  db?: typeof defaultDb;
  uploadObject?: typeof defaultUpload;
  browser?: Browser;
  fetchFn?: typeof fetch;
};

export type ScanResult = {
  templates: Array<{
    pageType: string;
    samples: number;
    skeleton: number;
    recipes: number;
    status: string;
  }>;
};

/** Intersection of sample key sets. */
export function intersect(samples: string[][]): string[] {
  if (samples.length === 0) return [];
  let acc = new Set(samples[0]);
  for (const s of samples.slice(1)) {
    const next = new Set(s);
    acc = new Set([...acc].filter((k) => next.has(k)));
  }
  return [...acc].sort();
}

/** URL regex covering the sample paths ("/shop/a", "/shop/b" → ^/shop/[^/]+/?$). */
export function urlPatternFor(paths: string[]): string {
  const clean = paths.map((p) => p.replace(/\/+$/, '') || '/');
  if (clean.every((p) => p === '/')) return '^/?$';
  const split = clean.map((p) => p.split('/').filter(Boolean));
  const depth = Math.max(...split.map((s) => s.length));
  const parts: string[] = [];
  for (let i = 0; i < depth; i++) {
    const vals = new Set(split.map((s) => s[i] ?? ''));
    parts.push(vals.size === 1 ? escapeRe([...vals][0] as string) : '[^/]+');
  }
  return `^/${parts.join('/')}/?$`;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Derive "how this page works" recipes from snapshot lines present on every sample. */
export function recipesFrom(snapshots: string[], skeleton: string[]): TemplateRecipe[] {
  const shared = new Set(skeleton);
  const first = snapshots[0] ?? '';
  const out: TemplateRecipe[] = [];
  const seen = new Set<string>();
  const rules: Array<{ action: string; role: RegExp; name: RegExp }> = [
    { action: 'add_to_cart', role: /^button$/, name: /add to (cart|bag|basket)/i },
    { action: 'buy_now', role: /^button$/, name: /buy (it )?now/i },
    { action: 'checkout', role: /^(button|link)$/, name: /check ?out/i },
    { action: 'quantity', role: /^(spinbutton|textbox|select)$/, name: /qty|quantity/i },
    { action: 'variant', role: /^(radio|select|option|tab)$/, name: /./ },
    { action: 'subscribe', role: /^(button|radio)$/, name: /subscri/i },
    { action: 'search', role: /^(textbox|combobox)$/, name: /search/i },
  ];
  for (const line of first.split('\n')) {
    const m = /^\[e\d+\] ([a-z]+) "([^"]*)"/.exec(line);
    if (!m) continue;
    const role = m[1] as string;
    const name = m[2] as string;
    for (const r of rules) {
      if (seen.has(r.action) || !r.role.test(role) || !r.name.test(name)) continue;
      // Only recipes whose control exists on every sample (except variants,
      // whose labels are product-specific by nature).
      const key = keyOf(role, name);
      if (r.action !== 'variant' && key && !shared.has(key)) continue;
      out.push({ action: r.action, role, name });
      seen.add(r.action);
    }
  }
  return out;
}

// Mirror of the widget's keyFor (packages/widget/src/host/fingerprint.ts).
function keyOf(role: string, name: string): string | null {
  const n = name
    .toLowerCase()
    .replace(/[₹$£€]|rs\.?|inr|usd/g, ' ')
    .replace(/\d+([.,]\d+)?/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  if (n.length < 2 || role === 'text') return null;
  return `${role}|${n}`;
}

async function pickSamples(
  db: typeof defaultDb,
  merchantId: string,
  domain: string,
  only?: string,
) {
  const pages = await db.query.sitePages.findMany({
    where: eq(schema.sitePages.merchantId, merchantId),
  });
  const byType = new Map<string, string[]>();
  for (const p of pages) {
    const type = p.pageType === 'collection' ? 'plp' : p.pageType;
    if (only && type !== only) continue;
    const list = byType.get(type) ?? [];
    if (list.length < SAMPLES_PER_TYPE) list.push(p.url);
    byType.set(type, list);
  }
  if ((!only || only === 'home') && !byType.has('home')) byType.set('home', [`https://${domain}/`]);
  return [...byType.entries()].filter(([t]) => (SCAN_TYPES as readonly string[]).includes(t));
}

export async function runScanSiteTemplates(args: ScanArgs): Promise<ScanResult> {
  const db = args.db ?? defaultDb;
  const upload = args.uploadObject ?? defaultUpload;
  const fetchFn = args.fetchFn ?? fetch;
  const merchant = await db.query.merchants.findFirst({
    where: eq(schema.merchants.id, args.merchantId),
  });
  if (!merchant) return { templates: [] };

  const bundle = await fetchFn(WIDGET_BUNDLE_URL).then((r) => r.text());
  const browser = args.browser ?? (await getBrowser());
  const groups = await pickSamples(db, merchant.id, merchant.domain, args.pageType);
  const result: ScanResult = { templates: [] };

  for (const [pageType, urls] of groups) {
    await db
      .update(schema.siteTemplates)
      .set({ status: 'scanning', updatedAt: new Date() })
      .where(
        and(
          eq(schema.siteTemplates.merchantId, merchant.id),
          eq(schema.siteTemplates.pageType, pageType),
        ),
      );

    const keySets: string[][] = [];
    const snapshots: string[] = [];
    const paths: string[] = [];
    const screenshots: Record<string, string> = {};
    for (const [i, url] of urls.entries()) {
      for (const device of i === 0 ? (['desktop', 'mobile'] as const) : (['desktop'] as const)) {
        const ctx = await browser.newContext({
          userAgent: 'Mozilla/5.0 (compatible; ShoppingmateBot/0.1; +https://shoppingmate.ai/bot)',
          viewport:
            device === 'desktop' ? { width: 1280, height: 900 } : { width: 390, height: 844 },
          isMobile: device === 'mobile',
        });
        try {
          // Block the merchant's own widget so scanning never creates sessions.
          await ctx.route('**/widget/v1.js*', (r) => r.abort());
          const page = await ctx.newPage();
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
          await page.waitForTimeout(2500);
          if (device === 'desktop') {
            await page.addScriptTag({ content: bundle });
            const out = await page.evaluate(() => {
              const nav = (
                globalThis as unknown as {
                  __shoppingmateNav__?: { snapshot(): string; keys(): string[] };
                }
              ).__shoppingmateNav__;
              return nav ? { snapshot: nav.snapshot(), keys: nav.keys() } : null;
            });
            if (out) {
              keySets.push(out.keys);
              snapshots.push(out.snapshot);
              paths.push(new URL(page.url()).pathname);
            }
          }
          if (i === 0) {
            try {
              const shot = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 60 });
              const key = `${merchant.id}/templates/${pageType}-${device}-${Date.now()}.jpg`;
              await upload(key, shot, 'image/jpeg');
              screenshots[device] = key;
            } catch (err) {
              logger.warn(
                { merchantId: merchant.id, pageType, device, err: (err as Error).message },
                'template screenshot failed',
              );
            }
          }
        } catch (err) {
          logger.warn(
            { merchantId: merchant.id, url, err: (err as Error).message },
            'template sample failed',
          );
        } finally {
          await ctx.close();
        }
      }
    }
    if (keySets.length === 0) continue;

    // A single sample can't separate shared from product-specific keys, so
    // keep only interactive structure for it (no headings).
    const skeleton =
      keySets.length > 1
        ? intersect(keySets)
        : (keySets[0] as string[]).filter((k) => !k.startsWith('heading|'));
    const recipes = recipesFrom(snapshots, skeleton);
    const now = new Date();
    await db
      .insert(schema.siteTemplates)
      .values({
        id: randomUUID(),
        merchantId: merchant.id,
        pageType,
        urlPattern: urlPatternFor(paths),
        skeleton,
        recipes,
        sampleUrls: urls,
        screenshots,
        status: 'fresh',
        scanTrigger: args.trigger ?? 'manual',
        scannedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [schema.siteTemplates.merchantId, schema.siteTemplates.pageType],
        set: {
          urlPattern: urlPatternFor(paths),
          skeleton,
          recipes,
          sampleUrls: urls,
          screenshots: sql`${schema.siteTemplates.screenshots} || ${JSON.stringify(screenshots)}::jsonb`,
          status: 'fresh',
          scanTrigger: args.trigger ?? 'manual',
          scannedAt: now,
          updatedAt: now,
        },
      });
    result.templates.push({
      pageType,
      samples: keySets.length,
      skeleton: skeleton.length,
      recipes: recipes.length,
      status: 'fresh',
    });
    logger.info(
      {
        merchantId: merchant.id,
        pageType,
        samples: keySets.length,
        skeleton: skeleton.length,
        recipes,
        trigger: args.trigger,
      },
      'site template scanned',
    );
  }
  return result;
}
