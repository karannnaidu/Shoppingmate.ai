// End-to-end proof of the SHIPPED widget bundle: mount the real dist/v1.js on a
// synthetic page whose nav drawer is a fixed full-height left panel (like
// Calmosis's, and it never touches <body> class), then assert the launcher gets
// `host-overlay-hidden` only while the drawer is open.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const bundle = readFileSync(resolve(here, '../widget/dist/v1.js'), 'utf8');

const PAGE = `<!doctype html><html><head><meta charset="utf8"><style>
  body { margin:0; height:2000px; }
  /* toggle lives top-right so the left drawer never intercepts its clicks */
  #toggle { position:fixed; right:12px; top:12px; z-index:10000; }
  #drawer { position:fixed; left:0; top:0; width:280px; height:100vh; background:#123; z-index:9999;
            transform:translateX(-100%); transition:transform .15s; }
  #drawer.open { transform:none; }
</style></head><body>
  <button id="toggle">menu</button>
  <nav id="drawer">nav links</nav>
  <!-- Pre-rendered element pins the launcher center-left (where the drawer opens),
       reproducing Calmosis's placement. init() upgrades it in place. -->
  <shoppingmate-widget data-id="SM-XPK2EN" data-api="http://127.0.0.1:9" data-position="center-left"></shoppingmate-widget>
  <script>
    // Realistic custom drawer: toggles a class on the DRAWER element only — it
    // never touches <html>/<body>, exactly like Calmosis's React sidebar.
    document.getElementById('toggle').addEventListener('click', () => {
      document.getElementById('drawer').classList.toggle('open');
    });
  </script>
</body></html>`;

const rootHidden = () => {
  const w = document.querySelector('shoppingmate-widget');
  const root = w && w.shadowRoot && w.shadowRoot.querySelector('.root');
  return root ? root.classList.contains('host-overlay-hidden') : 'no-root';
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
let exit = 0;
try {
  await page.setContent(PAGE, { waitUntil: 'domcontentloaded' });
  // Load the bundle exactly like production: an inline <script data-id data-api>.
  // document.currentScript.dataset.id drives init() → defineWidget() → auto-mount.
  await page.evaluate((code) => {
    const s = document.createElement('script');
    s.dataset.id = 'SM-XPK2EN'; // Calmosis id → center-left placement
    s.dataset.api = 'http://127.0.0.1:9'; // unreachable; the pill renders pre-bootstrap
    s.textContent = code;
    document.head.appendChild(s);
  }, bundle);

  // Pill renders synchronously (placeholder persona), so the launcher has size.
  await page.waitForFunction(
    () => {
      const w = document.querySelector('shoppingmate-widget');
      const root = w && w.shadowRoot && w.shadowRoot.querySelector('.root');
      return root && root.getBoundingClientRect().height > 10;
    },
    { timeout: 8000 },
  );

  const rect = await page.evaluate(() => {
    const w = document.querySelector('shoppingmate-widget');
    const r = w.shadowRoot.querySelector('.root').getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
  const atRest = await page.evaluate(rootHidden);

  await page.click('#toggle'); // open drawer
  await page.waitForTimeout(800);
  const drawerOpen = await page.evaluate(rootHidden);

  await page.click('#toggle'); // close drawer
  await page.waitForTimeout(800);
  const drawerClosed = await page.evaluate(rootHidden);

  console.log('launcher rect      :', JSON.stringify(rect));
  console.log('hidden AT REST     :', atRest);
  console.log('hidden DRAWER OPEN :', drawerOpen);
  console.log('hidden AFTER CLOSE :', drawerClosed);

  const pass = atRest === false && drawerOpen === true && drawerClosed === false;
  console.log(pass ? '\nPASS ✅  shipped widget hides only while the drawer is open' : '\nFAIL ❌');
  if (!pass) exit = 1;
} catch (e) {
  console.log('ERROR:', e.message);
  exit = 2;
} finally {
  await browser.close();
}
process.exit(exit);
