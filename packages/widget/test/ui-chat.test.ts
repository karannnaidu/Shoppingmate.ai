import { describe, expect, it, vi } from 'vitest';
import { renderChat } from '../src/ui/chat.js';

const baseProps = {
  transcript: [],
  checkoutUrl: null,
  personaName: 'Sage',
  personaInitial: 'S',
  personaAvatarUrl: 'https://cdn.example/personas/calm-clinician.png',
  onSend: () => {},
  onCall: () => {},
  onClose: () => {},
  onCardTap: () => {},
  closed: false,
};

describe('renderChat', () => {
  it('renders welcome card on empty transcript', () => {
    const root = document.createElement('div');
    renderChat(root, baseProps);
    expect(root.querySelector('.welcome')).toBeTruthy();
    expect(root.querySelector('.welcome-heading')?.textContent).toContain('Sage');
    expect(root.querySelector('.welcome-bullets')).toBeTruthy();
  });

  it('renders input row and footer', () => {
    const root = document.createElement('div');
    renderChat(root, baseProps);
    expect(root.querySelector('.input-row input')).toBeTruthy();
    expect(root.querySelector('.panel-footer')?.textContent).toContain('shoppingmate');
  });

  it('hides welcome once transcript has entries', () => {
    const root = document.createElement('div');
    renderChat(root, {
      ...baseProps,
      transcript: [{ id: 't1', role: 'user', kind: 'text', text: 'hi', ts: 0 }],
    });
    expect(root.querySelector('.welcome')).toBeFalsy();
  });

  it('submits via Enter and clears input', () => {
    const root = document.createElement('div');
    const onSend = vi.fn();
    renderChat(root, { ...baseProps, onSend });
    const input = root.querySelector('input');
    if (!(input instanceof HTMLInputElement)) throw new Error('expected input');
    input.value = 'hi';
    const form = root.querySelector('form');
    if (!(form instanceof HTMLFormElement)) throw new Error('expected form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(onSend).toHaveBeenCalledWith('hi');
    expect(input.value).toBe('');
  });

  it('disables input when closed', () => {
    const root = document.createElement('div');
    renderChat(root, { ...baseProps, closed: true });
    const input = root.querySelector('input');
    if (!(input instanceof HTMLInputElement)) throw new Error('expected input');
    expect(input.disabled).toBe(true);
  });

  it('close button invokes onClose', () => {
    const root = document.createElement('div');
    const onClose = vi.fn();
    renderChat(root, { ...baseProps, onClose });
    const close = root.querySelector('[data-action="close"]');
    if (!(close instanceof HTMLButtonElement)) throw new Error('expected close button');
    close.click();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
