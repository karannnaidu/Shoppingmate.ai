import { describe, expect, it } from 'vitest';
import { renderCall } from '../src/ui/call.js';

const baseProps = {
  voiceState: 'listening' as const,
  muted: false,
  transcript: [],
  checkoutUrl: null,
  personaName: 'Sage',
  onClose: () => {},
  onCardTap: () => {},
  onCheckout: () => {},
};

describe('renderCall', () => {
  it('renders status-line and transcript', () => {
    const root = document.createElement('div');
    renderCall(root, baseProps);
    expect(root.querySelector('.status-line')).toBeTruthy();
    expect(root.querySelector('.transcript')).toBeTruthy();
  });

  it('shows persona name in status text when listening', () => {
    const root = document.createElement('div');
    renderCall(root, baseProps);
    expect(root.querySelector('.status-line')?.textContent).toContain('Sage is listening');
  });

  it('shows muted text when muted', () => {
    const root = document.createElement('div');
    renderCall(root, { ...baseProps, muted: true });
    expect(root.querySelector('.status-line')?.textContent).toContain("you're muted");
  });

  it('does not claim Sage is listening when voiceState is idle', () => {
    const root = document.createElement('div');
    renderCall(root, { ...baseProps, voiceState: 'idle' });
    const status = root.querySelector('.status-line')?.textContent ?? '';
    expect(status).not.toContain('is listening');
    expect(status).toContain('voice paused');
  });

  it('shows checkout CTA when checkoutUrl is set', () => {
    const root = document.createElement('div');
    renderCall(root, { ...baseProps, checkoutUrl: 'https://shop/checkout' });
    const cta = root.querySelector('.checkout-cta');
    if (!(cta instanceof HTMLAnchorElement)) throw new Error('expected checkout cta anchor');
    expect(cta.getAttribute('href')).toBe('https://shop/checkout');
  });

  it('shows mic-denied copy when voiceError.code is mic_denied', () => {
    const root = document.createElement('div');
    renderCall(root, {
      ...baseProps,
      voiceState: 'idle',
      voiceError: { code: 'mic_denied', message: 'Permission denied' },
    });
    const status = root.querySelector('.status-line')?.textContent ?? '';
    expect(status).toContain('mic blocked');
    expect(status).not.toContain('voice paused');
  });

  it('renders shoppingmate footer', () => {
    const root = document.createElement('div');
    renderCall(root, baseProps);
    expect(root.querySelector('.panel-footer')?.textContent).toContain('shoppingmate');
  });
});
