import { describe, expect, it } from 'vitest';
import { defineWidget } from '../src/widget.js';

describe('defineWidget', () => {
  it('registers the custom element once', () => {
    defineWidget();
    expect(customElements.get('shoppingmate-widget')).toBeTruthy();
  });

  it('mounts a shadow root with a .root container', () => {
    defineWidget();
    const el = document.createElement('shoppingmate-widget');
    el.setAttribute('data-id', 'SM-TST001');
    document.body.appendChild(el);
    expect(el.shadowRoot).toBeTruthy();
    const root = el.shadowRoot?.querySelector('.root');
    expect(root).toBeTruthy();
  });
});

describe('leaving the page ends the call (mic released)', () => {
  it('stops voice and returns to the pill when the tab is hidden mid-call', () => {
    defineWidget();
    const el = document.createElement('shoppingmate-widget') as HTMLElement & {
      voiceMode: { getState: () => string; stop: () => void };
      store: { get: () => { mode: string }; dispatch: (a: unknown) => void };
    };
    el.setAttribute('data-id', 'SM-TST001');
    document.body.appendChild(el);
    let stopped = 0;
    el.voiceMode = { ...el.voiceMode, getState: () => 'listening', stop: () => void stopped++ };
    el.store.dispatch({ type: 'set_mode', mode: 'call' });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(stopped).toBe(1);
    expect(el.store.get().mode).toBe('pill');
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });
});
