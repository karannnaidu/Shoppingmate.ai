const RING_ATTR = 'data-shoppingmate-pulse-ring';

export function showPulseRing(target: HTMLElement, durationMs: number): () => void {
  const rect = target.getBoundingClientRect();
  const ring = document.createElement('div');
  ring.setAttribute(RING_ATTR, '');
  Object.assign(ring.style, {
    position: 'fixed',
    left: `${rect.left - 6}px`,
    top: `${rect.top - 6}px`,
    width: `${rect.width + 12}px`,
    height: `${rect.height + 12}px`,
    borderRadius: '14px',
    boxShadow: '0 0 0 3px rgba(139,92,246,0.85), 0 0 24px rgba(139,92,246,0.55)',
    pointerEvents: 'none',
    zIndex: '2147483646',
    animation: 'shoppingmate-pulse 1.2s ease-in-out infinite',
  } satisfies Partial<CSSStyleDeclaration>);
  ensureKeyframes();
  document.body.appendChild(ring);
  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    ring.remove();
  };
  setTimeout(remove, durationMs);
  return remove;
}

let kfInjected = false;
function ensureKeyframes(): void {
  if (kfInjected) return;
  kfInjected = true;
  const style = document.createElement('style');
  style.textContent = `@keyframes shoppingmate-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.04); opacity: 0.85; }
  }`;
  document.head.appendChild(style);
}
