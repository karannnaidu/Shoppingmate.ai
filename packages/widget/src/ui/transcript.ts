import type { CardItem } from '../transport/codec.js';
import { STRINGS } from '../strings.js';
import type { TranscriptItem } from '../state/store.js';

function escape(s: string): string {
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
  el.dataset['sku'] = c.sku;
  el.innerHTML = `
    ${c.image ? `<img src="${escape(c.image)}" alt="${escape(c.title)}" />` : `<div class="card-img-fallback"></div>`}
    <div class="title">${escape(c.title)}</div>
    <div class="price">${escape(c.priceFormatted)}</div>
  `;
  el.addEventListener('click', () => onTap({ sku: c.sku, variantId: c.variantId }));
  return el;
}

export function renderTranscript(
  host: HTMLElement,
  items: TranscriptItem[],
  onCardTap: (p: { sku: string; variantId: string | null }) => void,
): void {
  host.innerHTML = '';
  for (const item of items) {
    if (item.kind === 'text') {
      const div = document.createElement('div');
      div.className = `bubble ${item.role}`;
      div.textContent = item.text;
      host.appendChild(div);
    } else if (item.kind === 'cards') {
      const row = document.createElement('div');
      row.className = 'cards-row';
      for (const c of item.items) row.appendChild(cardEl(c, onCardTap));
      host.appendChild(row);
    } else if (item.kind === 'cap_warning') {
      const div = document.createElement('div');
      div.className = 'bubble system';
      div.textContent = STRINGS.capWarning;
      host.appendChild(div);
    } else if (item.kind === 'closed') {
      const div = document.createElement('div');
      div.className = 'bubble system';
      div.textContent = STRINGS.closed[item.reason];
      host.appendChild(div);
    }
  }
  host.scrollTop = host.scrollHeight;
}
