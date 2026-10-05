import { isOwnNode } from './snapshot.js';

// Verify-after-action (nav PRD Phase 1): after the bot clicks something, watch
// the page briefly and report whether anything actually changed, so the model
// never claims an effect that didn't happen ("dead click").

export type Verification = { verified: boolean; observed: string };

const CART_COUNT_SELECTOR = [
  '[data-cart-count]',
  '#cart-icon-bubble',
  '.cart-count',
  '.cart-count-bubble',
  '[class*="cart-count"]',
  '[class*="CartCount"]',
].join(',');

function cartCountText(): string {
  const el = document.querySelector(CART_COUNT_SELECTOR);
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function openDialogs(): number {
  return Array.from(
    document.querySelectorAll<HTMLElement>('dialog[open],[role="dialog"],[aria-modal="true"]'),
  ).filter((d) => !isOwnNode(d) && d.getAttribute('aria-hidden') !== 'true').length;
}

function elementState(el: HTMLElement): string {
  const input = el as HTMLInputElement;
  return [
    el.getAttribute('aria-expanded'),
    el.getAttribute('aria-checked'),
    el.getAttribute('aria-selected'),
    el.getAttribute('aria-pressed'),
    typeof input.checked === 'boolean' ? String(input.checked) : '',
    el.className,
  ].join('|');
}

/**
 * Run `act` and watch for a visible effect for up to `timeoutMs`. Effects, in
 * order of strength: URL change, cart count change, dialog opened/closed, the
 * clicked control's own state change, any other DOM update outside our widget.
 */
export async function verifyEffect(
  target: HTMLElement | null,
  act: () => void | Promise<void>,
  timeoutMs = 1500,
): Promise<Verification> {
  const beforeUrl = location.href;
  const beforeCart = cartCountText();
  const beforeDialogs = openDialogs();
  const beforeState = target ? elementState(target) : '';
  let domChanges = 0;
  const mo = new MutationObserver((records) => {
    for (const r of records) {
      if (isOwnNode(r.target)) continue;
      if (r.type === 'attributes' && r.attributeName === 'data-sm-ref') continue;
      domChanges += 1;
    }
  });
  mo.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });

  const summarize = (): Verification | null => {
    if (location.href !== beforeUrl)
      return { verified: true, observed: `navigated to ${location.pathname}` };
    const cart = cartCountText();
    if (cart !== beforeCart)
      return { verified: true, observed: `cart count ${beforeCart || '0'} → ${cart || '0'}` };
    const dialogs = openDialogs();
    if (dialogs > beforeDialogs) return { verified: true, observed: 'a dialog/drawer opened' };
    if (dialogs < beforeDialogs) return { verified: true, observed: 'a dialog/drawer closed' };
    if (target?.isConnected && elementState(target) !== beforeState) {
      return { verified: true, observed: 'the control changed state' };
    }
    if (domChanges > 0) return { verified: true, observed: 'the page updated' };
    return null;
  };

  try {
    await act();
    const deadline = Date.now() + timeoutMs;
    // Let synchronous handlers flush, then poll until something changes.
    await new Promise<void>((r) => setTimeout(r, 50));
    let result = summarize();
    while (!result && Date.now() < deadline) {
      await new Promise<void>((r) => setTimeout(r, 100));
      result = summarize();
    }
    return result ?? { verified: false, observed: 'nothing changed on the page' };
  } finally {
    mo.disconnect();
  }
}
