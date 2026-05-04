import { describe, expect, it, vi } from 'vitest';
import { renderCall } from '../src/ui/call.js';

describe('renderCall', () => {
  it('renders header, waveform, transcript, controls', () => {
    const root = document.createElement('div');
    renderCall(root, {
      voiceState: 'listening',
      muted: false,
      transcript: [],
      checkoutUrl: null,
      onMute: () => {},
      onEnd: () => {},
      onChat: () => {},
      onCardTap: () => {},
      onCheckout: () => {},
    });
    expect(root.querySelector('.panel-header')).toBeTruthy();
    expect(root.querySelector('.waveform')).toBeTruthy();
    expect(root.querySelector('.transcript')).toBeTruthy();
    expect(root.querySelector('.controls')).toBeTruthy();
  });

  it('shows checkout CTA when checkoutUrl is set', () => {
    const root = document.createElement('div');
    renderCall(root, {
      voiceState: 'listening',
      muted: false,
      transcript: [],
      checkoutUrl: 'https://shop/checkout',
      onMute: () => {},
      onEnd: () => {},
      onChat: () => {},
      onCardTap: () => {},
      onCheckout: () => {},
    });
    const cta = root.querySelector('.checkout-cta');
    if (!(cta instanceof HTMLAnchorElement)) throw new Error('expected checkout cta anchor');
    expect(cta.getAttribute('href')).toBe('https://shop/checkout');
  });

  it('mute click invokes onMute with toggled value', () => {
    const root = document.createElement('div');
    const onMute = vi.fn();
    renderCall(root, {
      voiceState: 'listening',
      muted: false,
      transcript: [],
      checkoutUrl: null,
      onMute,
      onEnd: () => {},
      onChat: () => {},
      onCardTap: () => {},
      onCheckout: () => {},
    });
    const btn = root.querySelector('[data-action="mute"]');
    if (!(btn instanceof HTMLElement)) throw new Error('expected mute button');
    btn.click();
    expect(onMute).toHaveBeenCalledWith(true);
  });
});
