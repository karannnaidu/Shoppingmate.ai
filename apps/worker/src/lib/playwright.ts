import { chromium, type Browser, type BrowserContext } from 'playwright';

let cachedBrowser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!cachedBrowser) {
    cachedBrowser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  }
  return cachedBrowser;
}

export async function withContext<T>(fn: (ctx: BrowserContext) => Promise<T>): Promise<T> {
  const browser = await getBrowser();
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (compatible; ShoppingmateBot/0.1; +https://shoppingmate.ai/bot)',
    viewport: { width: 1280, height: 800 },
  });
  try {
    return await fn(ctx);
  } finally {
    await ctx.close();
  }
}

export async function shutdownBrowser(): Promise<void> {
  if (cachedBrowser) {
    await cachedBrowser.close();
    cachedBrowser = null;
  }
}
