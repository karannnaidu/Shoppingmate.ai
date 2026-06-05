// Visitor-movable launcher. Any visitor on any brand site can grab the pill and
// drag it anywhere so it never blocks the content they're trying to use. The
// position is anchored by quadrant (so an opening chat/call panel always grows
// INTO the screen, never off-edge) and persisted per-merchant in localStorage.

export type Anchor = {
  hSide: 'left' | 'right';
  hVal: number;
  vSide: 'top' | 'bottom';
  vVal: number;
};

export type Rect = { top: number; left: number; right: number; bottom: number };

const MARGIN = 8;
const DRAG_THRESHOLD = 6;

// Keep a top-left-positioned box fully inside the viewport (minus a margin).
export function clampTopLeft(
  x: number,
  y: number,
  w: number,
  h: number,
  vw: number,
  vh: number,
  margin = MARGIN,
): { x: number; y: number } {
  const maxX = Math.max(margin, vw - w - margin);
  const maxY = Math.max(margin, vh - h - margin);
  return {
    x: Math.min(Math.max(margin, x), maxX),
    y: Math.min(Math.max(margin, y), maxY),
  };
}

// Decide which corner to anchor to from where the launcher ended up. Anchoring
// to the nearest sides means the panel (which stacks toward screen-centre)
// stays on-screen and the launcher doesn't drift on viewport resize.
export function quadrantAnchor(rect: Rect, vw: number, vh: number, margin = MARGIN): Anchor {
  const cx = (rect.left + rect.right) / 2;
  const cy = (rect.top + rect.bottom) / 2;
  const hSide: 'left' | 'right' = cx > vw / 2 ? 'right' : 'left';
  const vSide: 'top' | 'bottom' = cy > vh / 2 ? 'bottom' : 'top';
  const hVal = Math.max(margin, hSide === 'right' ? vw - rect.right : rect.left);
  const vVal = Math.max(margin, vSide === 'bottom' ? vh - rect.bottom : rect.top);
  return { hSide, hVal, vSide, vVal };
}

function applyAnchor(root: HTMLElement, a: Anchor): void {
  root.classList.add('dragged');
  root.style.transform = 'none';
  if (a.hSide === 'right') {
    root.style.right = `${a.hVal}px`;
    root.style.left = 'auto';
  } else {
    root.style.left = `${a.hVal}px`;
    root.style.right = 'auto';
  }
  if (a.vSide === 'bottom') {
    root.style.bottom = `${a.vVal}px`;
    root.style.top = 'auto';
  } else {
    root.style.top = `${a.vVal}px`;
    root.style.bottom = 'auto';
  }
  // Panel grows away from the anchored edge so it never leaves the viewport.
  root.classList.toggle('dock-top', a.vSide === 'top');
  root.classList.toggle('dock-bottom', a.vSide === 'bottom');
  root.classList.toggle('dock-left', a.hSide === 'left');
  root.classList.toggle('dock-right', a.hSide === 'right');
}

function readSaved(storageKey: string): Anchor | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Anchor>;
    if (
      (p.hSide === 'left' || p.hSide === 'right') &&
      (p.vSide === 'top' || p.vSide === 'bottom') &&
      typeof p.hVal === 'number' &&
      typeof p.vVal === 'number'
    ) {
      return p as Anchor;
    }
  } catch {
    /* private mode / blocked storage — ignore */
  }
  return null;
}

function save(storageKey: string, a: Anchor): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(a));
  } catch {
    /* ignore */
  }
}

// Clamp a saved/derived anchor so the launcher is always reachable even if the
// viewport shrank since it was placed.
function clampAnchor(a: Anchor, handle: HTMLElement): Anchor {
  const w = handle.offsetWidth || 0;
  const h = handle.offsetHeight || 0;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    ...a,
    hVal: Math.min(Math.max(MARGIN, a.hVal), Math.max(MARGIN, vw - w - MARGIN)),
    vVal: Math.min(Math.max(MARGIN, a.vVal), Math.max(MARGIN, vh - h - MARGIN)),
  };
}

export function makeDraggable(opts: {
  root: HTMLElement;
  /** container that holds the launcher tray (the drag handle) */
  surface: HTMLElement;
  storageKey: string;
}): () => void {
  const { root, surface, storageKey } = opts;

  const trayEl = () => (surface.querySelector('.tray') as HTMLElement | null) ?? surface;

  // Restore a previous placement.
  const saved = readSaved(storageKey);
  if (saved) applyAnchor(root, clampAnchor(saved, trayEl()));

  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originTop = 0;
  let dragging = false;
  let activeId: number | null = null;

  const onMove = (e: PointerEvent) => {
    if (activeId !== null && e.pointerId !== activeId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!dragging) {
      // Engage drag: capture the pointer so we keep receiving moves even when
      // the cursor outruns the small launcher. Done here (not on pointerdown)
      // so taps on the Call/mic/end buttons never get captured.
      try {
        if (activeId != null) surface.setPointerCapture(activeId);
      } catch {
        /* capture unsupported / pointer already released — ignore */
      }
    }
    dragging = true;
    root.classList.add('dragging', 'dragged');
    root.style.transform = 'none';
    const w = root.offsetWidth;
    const h = root.offsetHeight;
    const { x, y } = clampTopLeft(
      originLeft + dx,
      originTop + dy,
      w,
      h,
      window.innerWidth,
      window.innerHeight,
    );
    // Free-position by top/left while dragging; finalise to a side-anchor on drop.
    root.style.left = `${x}px`;
    root.style.top = `${y}px`;
    root.style.right = 'auto';
    root.style.bottom = 'auto';
    root.classList.remove('dock-top', 'dock-bottom', 'dock-left', 'dock-right');
    e.preventDefault();
  };

  const onUp = (e: PointerEvent) => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    activeId = null;
    if (!dragging) return;
    dragging = false;
    root.classList.remove('dragging');
    // Suppress the click that the browser fires after a drag so the launcher
    // doesn't also toggle the panel / fire a control.
    const swallow = (ev: Event) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    surface.addEventListener('click', swallow, { capture: true, once: true });
    // If no click materialises, remove the one-shot guard shortly after.
    window.setTimeout(() => surface.removeEventListener('click', swallow, { capture: true } as never), 350);

    const r = trayEl().getBoundingClientRect();
    const anchor = quadrantAnchor(
      { top: r.top, left: r.left, right: r.right, bottom: r.bottom },
      window.innerWidth,
      window.innerHeight,
    );
    applyAnchor(root, anchor);
    save(storageKey, anchor);
    e.preventDefault();
  };

  const onDown = (e: PointerEvent) => {
    // Primary button / touch / pen only.
    if (e.button != null && e.button !== 0) return;
    const r = trayEl().getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    originLeft = r.left;
    originTop = r.top;
    dragging = false;
    activeId = e.pointerId ?? null;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onResize = () => {
    const a = readSaved(storageKey);
    if (a) applyAnchor(root, clampAnchor(a, trayEl()));
  };

  surface.addEventListener('pointerdown', onDown);
  window.addEventListener('resize', onResize);

  return () => {
    surface.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('resize', onResize);
  };
}
