// Prove the geometric overlay detector against a REAL storefront drawer, with
// real layout. Injects a fake launcher at center-left (like ours) and asserts
// the detector reports "not covered" at rest and "covered" once the drawer opens.
// Usage: node verify-drawer.mjs <url> [viewport]
import { chromium } from 'playwright';

const url = process.argv[2] || 'https://calmosis.com';
const width = Number(process.argv[3] || 390);

// This function is the exact algorithm we will port into the widget. It runs in
// the page. hostSel identifies our (emulated) launcher so we skip ourselves.
function launcherCovered(hostSel) {
  const host = document.querySelector(hostSel);
  if (!host) return { covered: false, reason: 'no host' };
  const r = host.getBoundingClientRect();
  if (!r.width || !r.height) return { covered: false, reason: 'no rect' };
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  for (const el of document.elementsFromPoint(cx, cy)) {
    // Skip ourselves: the probe/host, its subtree, its ancestors (html/body),
    // and ANY shoppingmate widget element (never treat our own UI as an overlay).
    if (el === host || host.contains(el) || el.contains(host)) continue;
    if (el.tagName === 'SHOPPINGMATE-WIDGET') continue;
    // Is el (or an ancestor) a large fixed/absolute overlay covering the launcher?
    let node = el;
    while (node && node !== document.body && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      if (cs.position === 'fixed' || cs.position === 'absolute') {
        const b = node.getBoundingClientRect();
        const covers = b.left <= cx && b.right >= cx && b.top <= cy && b.bottom >= cy;
        const large = b.width >= window.innerWidth * 0.4 || b.height >= window.innerHeight * 0.4;
        const visible =
          cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.01;
        if (covers && large && visible) {
          return {
            covered: true,
            by: { tag: node.tagName, cls: String(node.className).slice(0, 80), z: cs.zIndex, pos: cs.position },
          };
        }
      }
      node = node.parentElement;
    }
    // Not an overlay — keep scanning deeper elements in the stack (the drawer may
    // sit below our widget, which has a higher z-index than the host's drawer).
  }
  return { covered: false };
}

function injectLauncher() {
  const d = document.createElement('div');
  d.id = 'sm-fake-launcher';
  Object.assign(d.style, {
    position: 'fixed',
    top: '50%',
    left: '20px',
    transform: 'translateY(-50%)',
    width: '64px',
    height: '64px',
    zIndex: '2147483647',
    background: 'red',
  });
  document.body.appendChild(d);
}

function openMenu() {
  const selectors = [
    'button[aria-label*="menu" i]',
    'button[aria-label*="navigation" i]',
    'button[class*="hamburger" i]',
    'button[class*="burger" i]',
    '[class*="menu-toggle" i]',
    'header button',
    'nav button',
  ];
  for (const sel of selectors) {
    const btn = document.querySelector(sel);
    if (btn) {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return sel;
    }
  }
  return null;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 800 } });
let exitCode = 0;
try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);
  await page.evaluate(injectLauncher);

  const atRest = await page.evaluate(launcherCovered, '#sm-fake-launcher');
  const clicked = await page.evaluate(openMenu);
  await page.waitForTimeout(1200);
  const afterOpen = await page.evaluate(launcherCovered, '#sm-fake-launcher');

  console.log(`\n===== ${url} @ ${width}px =====`);
  console.log('menu toggle used     :', clicked);
  console.log('detector AT REST     :', JSON.stringify(atRest));
  console.log('detector DRAWER OPEN :', JSON.stringify(afterOpen));

  const pass = atRest.covered === false && afterOpen.covered === true;
  console.log(pass ? '\nPASS ✅  hides only when the drawer is open' : '\nFAIL ❌  detector wrong');
  if (!pass) exitCode = 1;
} catch (e) {
  console.log('ERROR:', e.message);
  exitCode = 2;
} finally {
  await browser.close();
}
process.exit(exitCode);
