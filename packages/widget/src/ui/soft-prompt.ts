// First-load tour-offer bubble. Appears after 5 seconds of silent mount.
// One-shot per session — once accepted or dismissed, never re-shown.

const ATTR = 'data-shoppingmate-soft-prompt';
const DELAY_MS = 5000;

export type SoftPromptHandle = {
  cancel: () => void;
};

export function mountSoftPrompt(
  host: HTMLElement,
  cb: { onAccept: () => void; onDismiss: () => void },
): SoftPromptHandle {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;
  let shown = false;
  let bubble: HTMLElement | null = null;

  timer = setTimeout(() => {
    if (cancelled || shown) return;
    shown = true;
    bubble = renderBubble(host, () => {
      cb.onAccept();
      removeBubble();
    }, () => {
      cb.onDismiss();
      removeBubble();
    });
  }, DELAY_MS);

  function removeBubble(): void {
    if (bubble && bubble.parentNode) bubble.parentNode.removeChild(bubble);
    bubble = null;
  }

  return {
    cancel() {
      cancelled = true;
      if (timer) clearTimeout(timer);
      removeBubble();
    },
  };
}

function renderBubble(
  host: HTMLElement,
  onAccept: () => void,
  onDismiss: () => void,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.setAttribute(ATTR, '');
  Object.assign(wrap.style, {
    position: 'fixed',
    right: '24px',
    bottom: '96px',
    maxWidth: '320px',
    background: 'white',
    color: '#0b0b14',
    padding: '14px 16px',
    borderRadius: '16px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    lineHeight: '1.4',
    zIndex: '2147483645',
  } satisfies Partial<CSSStyleDeclaration>);
  wrap.innerHTML = `
    <div style="font-weight:600;margin-bottom:6px;">Want a quick tour?</div>
    <div style="opacity:.85;margin-bottom:10px;">Sage will walk you through what shoppingmate does in about a minute.</div>
    <div style="display:flex;gap:8px;">
      <button data-action="accept" style="flex:1;padding:8px 12px;border:0;border-radius:10px;background:#8b5cf6;color:white;font-weight:600;cursor:pointer;">Yes, show me</button>
      <button data-action="dismiss" style="padding:8px 12px;border:1px solid #e5e7eb;background:white;border-radius:10px;cursor:pointer;">Not now</button>
    </div>
  `;
  wrap.querySelector('[data-action="accept"]')?.addEventListener('click', onAccept);
  wrap.querySelector('[data-action="dismiss"]')?.addEventListener('click', onDismiss);
  host.appendChild(wrap);
  return wrap;
}
