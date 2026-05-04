import { describe, expect, it, vi } from 'vitest';
import type { TranscriptItem } from '../src/state/store.js';
import { renderTranscript } from '../src/ui/transcript.js';

describe('renderTranscript', () => {
  it('renders text bubbles and inline cards in order', () => {
    const items: TranscriptItem[] = [
      { id: '1', role: 'agent', kind: 'text', text: 'Hi', ts: 0 },
      {
        id: '2',
        role: 'agent',
        kind: 'cards',
        ts: 1,
        items: [
          {
            image: null,
            title: 'A',
            priceFormatted: 'USD 10',
            variantId: null,
            sku: 'A-1',
            productUrl: 'https://x',
          },
        ],
      },
      { id: '3', role: 'user', kind: 'text', text: 'cool', ts: 2 },
    ];
    const root = document.createElement('div');
    renderTranscript(root, items, () => {});
    const children = Array.from(root.children);
    expect(children).toHaveLength(3);
    expect(children[0]?.classList.contains('bubble')).toBe(true);
    expect(children[1]?.classList.contains('cards-row')).toBe(true);
    expect(children[2]?.classList.contains('bubble')).toBe(true);
  });

  it('clicking a card invokes onCardTap with sku/variantId', () => {
    const tap = vi.fn();
    const items: TranscriptItem[] = [
      {
        id: '2',
        role: 'agent',
        kind: 'cards',
        ts: 1,
        items: [
          {
            image: null,
            title: 'A',
            priceFormatted: 'USD 10',
            variantId: 'V1',
            sku: 'A-1',
            productUrl: 'https://x',
          },
        ],
      },
    ];
    const root = document.createElement('div');
    renderTranscript(root, items, tap);
    const card = root.querySelector('.card');
    if (!(card instanceof HTMLElement)) throw new Error('expected card element');
    card.click();
    expect(tap).toHaveBeenCalledWith({ sku: 'A-1', variantId: 'V1' });
  });
});
