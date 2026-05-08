import type { TranscriptItem } from '../state/store.js';
import { STRINGS } from '../strings.js';
import type { CardItem } from '../transport/codec.js';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

function cardEl(
  c: CardItem,
  onTap: (p: { sku: string; variantId: string | null }) => void,
): HTMLElement {
  const el = document.createElement('button');
  el.className = 'card';
  el.type = 'button';
  el.dataset.sku = c.sku;
  el.innerHTML = `
    ${c.image ? `<img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.title)}" />` : `<div class="card-img-fallback"></div>`}
    <div class="title">${escapeHtml(c.title)}</div>
    <div class="price">${escapeHtml(c.priceFormatted)}</div>
  `;
  el.addEventListener('click', () => onTap({ sku: c.sku, variantId: c.variantId }));
  return el;
}

function createNode(
  item: TranscriptItem,
  onCardTap: (p: { sku: string; variantId: string | null }) => void,
): HTMLElement {
  if (item.kind === 'text') {
    const div = document.createElement('div');
    div.className = `bubble ${item.role}`;
    div.textContent = item.text;
    return div;
  }
  if (item.kind === 'cards') {
    const row = document.createElement('div');
    row.className = 'cards-row';
    for (const c of item.items) row.appendChild(cardEl(c, onCardTap));
    return row;
  }
  if (item.kind === 'cap_warning') {
    const div = document.createElement('div');
    div.className = 'bubble system';
    div.textContent = STRINGS.capWarning;
    return div;
  }
  const div = document.createElement('div');
  div.className = 'bubble system';
  div.textContent = STRINGS.closed[item.reason];
  return div;
}

type Rendered = { id: string; el: HTMLElement; text?: string };
const renderedCache = new WeakMap<HTMLElement, Rendered[]>();

// Incremental DOM update: keyed by item.id, only mutates text on bubbles whose
// text changed. Avoids tearing down card images during streaming say_partial
// updates (which would otherwise flicker every chunk).
export function renderTranscript(
  host: HTMLElement,
  items: TranscriptItem[],
  onCardTap: (p: { sku: string; variantId: string | null }) => void,
): void {
  const prev = renderedCache.get(host) ?? [];
  const prevById = new Map(prev.map((r) => [r.id, r]));
  const nextIds = new Set(items.map((i) => i.id));

  // Drop nodes that are no longer in the transcript (rare — usually only on reset).
  for (const r of prev) {
    if (!nextIds.has(r.id)) r.el.remove();
  }

  const next: Rendered[] = [];
  let grew = false;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    const cached = prevById.get(item.id);
    if (cached) {
      if (item.kind === 'text' && cached.text !== item.text) {
        cached.el.textContent = item.text;
        cached.text = item.text;
        grew = true;
      }
      next.push(cached);
    } else {
      const el = createNode(item, onCardTap);
      host.appendChild(el);
      next.push({ id: item.id, el, text: item.kind === 'text' ? item.text : undefined });
      grew = true;
    }
  }

  renderedCache.set(host, next);

  // Only auto-scroll when content actually changed (avoids fighting user scroll on idle re-renders).
  if (grew) host.scrollTop = host.scrollHeight;
}
