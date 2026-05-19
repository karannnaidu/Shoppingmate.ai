/** @vitest-environment happy-dom */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { showPulseRing } from './overlay.js';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});

describe('showPulseRing()', () => {
  it('attaches an overlay positioned over the target element', () => {
    const target = document.createElement('div');
    target.getBoundingClientRect = () =>
      ({ x: 10, y: 20, width: 100, height: 50, top: 20, left: 10, right: 110, bottom: 70 }) as DOMRect;
    document.body.appendChild(target);
    showPulseRing(target, 2000);
    const ring = document.querySelector('[data-shoppingmate-pulse-ring]') as HTMLElement;
    expect(ring).not.toBeNull();
    expect(ring.style.position).toBe('fixed');
  });

  it('auto-removes the overlay after duration_ms', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    showPulseRing(target, 1500);
    expect(document.querySelector('[data-shoppingmate-pulse-ring]')).not.toBeNull();
    vi.advanceTimersByTime(1600);
    expect(document.querySelector('[data-shoppingmate-pulse-ring]')).toBeNull();
  });
});
