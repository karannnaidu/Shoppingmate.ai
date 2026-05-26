// Bot cursor — a visible "driver" arrow that animates to a target before the
// agent clicks or scrolls. Without it host actions feel invisible: the page
// just changes and the visitor wonders who did what. The cursor gives the
// visible agency of a human user actually driving the browser.

const CURSOR_ATTR = 'data-shoppingmate-bot-cursor';
const ANIM_KEYFRAMES_INJECTED = 'data-shoppingmate-cursor-keyframes';

let cursorEl: HTMLElement | null = null;
let lastX = window.innerWidth - 80; // near widget tray (bottom-right)
let lastY = window.innerHeight - 80;

function ensureCursor(): HTMLElement {
  if (cursorEl && cursorEl.isConnected) return cursorEl;
  ensureKeyframes();
  const el = document.createElement('div');
  el.setAttribute(CURSOR_ATTR, '');
  el.innerHTML = `
    <svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 2 L3 17 L7 13 L9.5 19 L12 18 L9.5 12 L15 12 Z"
            fill="#111827" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>
  `;
  Object.assign(el.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    transform: `translate(${lastX}px, ${lastY}px)`,
    transition: 'transform 480ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms',
    pointerEvents: 'none',
    zIndex: '2147483647',
    opacity: '0',
    willChange: 'transform, opacity',
    filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(el);
  cursorEl = el;
  return el;
}

function ensureKeyframes(): void {
  if (document.head.querySelector(`style[${ANIM_KEYFRAMES_INJECTED}]`)) return;
  const style = document.createElement('style');
  style.setAttribute(ANIM_KEYFRAMES_INJECTED, '');
  style.textContent = `
    @keyframes shoppingmate-cursor-click {
      0%   { transform: var(--sm-cursor-pos) scale(1); }
      40%  { transform: var(--sm-cursor-pos) scale(0.72); }
      100% { transform: var(--sm-cursor-pos) scale(1); }
    }
  `;
  document.head.appendChild(style);
}

function targetPoint(target: HTMLElement): { x: number; y: number } {
  const rect = target.getBoundingClientRect();
  return { x: rect.left + rect.width / 2 - 6, y: rect.top + rect.height / 2 - 6 };
}

/** Animate the cursor toward an element and resolve when it arrives. */
export function moveCursorTo(target: HTMLElement, durationMs = 480): Promise<void> {
  const el = ensureCursor();
  const { x, y } = targetPoint(target);
  el.style.transitionDuration = `${durationMs}ms, 200ms`;
  el.style.opacity = '1';
  el.style.transform = `translate(${x}px, ${y}px)`;
  lastX = x;
  lastY = y;
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

/** Quick squish animation at the current cursor position to signal a click. */
export function pulseCursorClick(): Promise<void> {
  const el = ensureCursor();
  el.style.setProperty('--sm-cursor-pos', `translate(${lastX}px, ${lastY}px)`);
  el.style.animation = 'shoppingmate-cursor-click 280ms ease-out';
  return new Promise((resolve) => {
    const done = () => {
      el.style.animation = '';
      el.removeEventListener('animationend', done);
      resolve();
    };
    el.addEventListener('animationend', done);
    setTimeout(done, 360); // safety fallback
  });
}

/** Fade the cursor out (used after navigation or when idle). */
export function hideCursor(delayMs = 600): void {
  const el = cursorEl;
  if (!el) return;
  setTimeout(() => {
    el.style.opacity = '0';
  }, delayMs);
}
