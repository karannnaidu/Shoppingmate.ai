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
