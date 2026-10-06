import type { TranscriptItem } from '../state/store.js';
import { STRINGS } from '../strings.js';
import type { CardItem } from '../transport/codec.js';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

// Assistant replies arrive as light markdown (**bold**, "- " / "1. " lists,
// line breaks). Shoppers were seeing raw asterisks and run-together lists, so
// render a SAFE subset: escape everything first, then add only <strong>/<br>.
export function renderLiteMarkdown(text: string): string {
  return escapeHtml(text.trim())
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
    .replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,!?])/g, '$1$2')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-•]\s+/gm, '• ')
    .replace(/\n{2,}/g, '\n')
    .replace(/\n/g, '<br>');
}

function setBubbleText(el: HTMLElement, role: string, text: string): void {
  if (role === 'user') el.textContent = text;
  else el.innerHTML = renderLiteMarkdown(text);
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
    setBubbleText(div, item.role, item.text);
    return div;
  }
  if (item.kind === 'cards') {
    const row = document.createElement('div');
    row.className = 'cards-row';
    for (const c of item.items) row.appendChild(cardEl(c, onCardTap));
    return row;
  }
  if (item.kind === 'receipt') {
    // "✓ Added Sleep Mantra to your cart" — what actually happened on the page.
    const div = document.createElement('div');
    div.className = `receipt ${item.ok ? 'ok' : 'warn'}`;
    div.setAttribute('role', 'status');
    const icon = document.createElement('span');
    icon.className = 'receipt-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = item.ok ? '✓' : '!';
    const label = document.createElement('span');
    label.textContent = item.text;
    div.append(icon, label);
    return div;
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
        setBubbleText(cached.el, item.role, item.text);
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
