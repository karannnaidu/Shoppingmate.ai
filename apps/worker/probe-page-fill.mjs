import { chromium } from 'playwright';

// Loads the live Calmosis checkout, then simulates what the form_fill host action
// does (resolveField + setReactValue) to prove React-controlled inputs update and
// read back. Validates the DOM technique against the REAL form before relying on it.
const browser = await chromium.launch({ headless: true });
const page = await browser.newContext().then((c) => c.newPage());
await page.goto('https://calmosis.com/peace-mantra', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3000);
const add = page.getByRole('button', { name: /add to cart/i }).first();
await add.click();
await page.waitForTimeout(1500);
const proceed = page.getByRole('button', { name: /proceed to checkout/i }).first();
await proceed.click().catch(() => {});
await page.waitForTimeout(4000);

const result = await page.evaluate(() => {
  function setReactValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const fields = [];
  for (const el of document.querySelectorAll('input, textarea')) {
    fields.push({
      key: el.getAttribute('placeholder') || el.getAttribute('name') || el.id || '(none)',
      type: el.getAttribute('type') || el.tagName.toLowerCase(),
    });
  }
  const email = Array.from(document.querySelectorAll('input')).find((i) =>
    /email/i.test((i.getAttribute('placeholder') || '') + (i.getAttribute('name') || '') + i.id));
  let emailAfter = null;
  if (email) { setReactValue(email, 'probe@example.com'); emailAfter = email.value; }
  return { url: location.href, fieldCount: fields.length, fields, emailAfter };
});
console.log('final URL:', result.url);
console.log('checkout form fields:', JSON.stringify(result.fields, null, 2));
console.log('emailAfter (React-safe fill result):', result.emailAfter);
await browser.close();
