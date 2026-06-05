// Discriminator repro for the "moves 1px, no drag" report. Run from apps/worker
// (playwright resolves here). Synthetic mouse does NOT start native HTML5 DnD,
// so a smooth drag here => JS logic OK and the real bug is native image/text
// drag hijacking the gesture.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const bundle = readFileSync(
  resolve(import.meta.dirname, '../../packages/widget/dist/v1.js'),
  'utf8',
);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
await page.route('**/v1/**', (r) => r.abort());
await page.setContent(
  `<!doctype html><html><body style="height:2000px">
   <script data-id="SM-TEST" data-api="https://example.invalid">${bundle}</script>
   </body></html>`,
  { waitUntil: 'domcontentloaded' },
);

await page.waitForFunction(
  () => !!document.querySelector('shoppingmate-widget')?.shadowRoot?.querySelector('.tray'),
  { timeout: 5000 },
);

const rectsOf = () =>
  page.evaluate(() => {
    const sr = document.querySelector('shoppingmate-widget').shadowRoot;
    const root = sr.querySelector('.root').getBoundingClientRect();
    const meta = sr.querySelector('.tray-meta').getBoundingClientRect();
    return {
      root: { x: Math.round(root.x), y: Math.round(root.y) },
      meta: { cx: meta.x + meta.width / 2, cy: meta.y + meta.height / 2 },
    };
  });

// Assert the native-gesture-prevention fixes are actually applied in the
// rendered widget (these are what stop the real-browser "1px then stop").
const guards = await page.evaluate(() => {
  const sr = document.querySelector('shoppingmate-widget').shadowRoot;
  const tray = sr.querySelector('.tray');
  const img = sr.querySelector('.tray-avatar-img');
  const cs = getComputedStyle(tray);
  return {
    imgDraggable: img ? img.draggable : null,
    userSelect: cs.userSelect || cs.webkitUserSelect,
    touchAction: cs.touchAction,
  };
});
console.log('guards:', guards);
const guardsOk =
  guards.imgDraggable === false &&
  guards.userSelect === 'none' &&
  guards.touchAction === 'none';
console.log(guardsOk ? 'GUARDS: native-drag prevention present ✓' : 'GUARDS: MISSING ✗');

const before = await rectsOf();
const sx = before.meta.cx;
const sy = before.meta.cy;
const tx = sx - 350;
const ty = sy - 250;
await page.mouse.move(sx, sy);
await page.mouse.down();
for (let i = 1; i <= 10; i++) {
  await page.mouse.move(sx + ((tx - sx) * i) / 10, sy + ((ty - sy) * i) / 10);
}
await page.mouse.up();
await page.waitForTimeout(50);

const after = await rectsOf();
const dx = after.root.x - before.root.x;
const dy = after.root.y - before.root.y;
console.log('root before:', before.root, '-> after:', after.root, `| delta dx=${dx} dy=${dy}`);
console.log(
  Math.abs(dx) > 50 && Math.abs(dy) > 50
    ? 'RESULT: launcher MOVED under synthetic drag -> JS logic OK (real bug = native drag).'
    : 'RESULT: launcher did NOT move -> JS drag logic is broken.',
);
await browser.close();
