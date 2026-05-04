import { describe, expect, it, vi } from 'vitest';
import { renderChat } from '../src/ui/chat.js';

describe('renderChat', () => {
  it('renders header, transcript, input row', () => {
    const root = document.createElement('div');
    renderChat(root, {
      transcript: [],
      checkoutUrl: null,
      onSend: () => {},
      onCall: () => {},
      onCardTap: () => {},
      closed: false,
    });
    expect(root.querySelector('.panel-header')).toBeTruthy();
    expect(root.querySelector('.transcript')).toBeTruthy();
    expect(root.querySelector('.input-row input')).toBeTruthy();
  });

  it('submits via Enter and clears input', () => {
    const root = document.createElement('div');
    const onSend = vi.fn();
    renderChat(root, {
      transcript: [],
      checkoutUrl: null,
      onSend,
      onCall: () => {},
      onCardTap: () => {},
      closed: false,
    });
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
    renderChat(root, {
      transcript: [],
      checkoutUrl: null,
      onSend: () => {},
      onCall: () => {},
      onCardTap: () => {},
      closed: true,
    });
    const input = root.querySelector('input');
    if (!(input instanceof HTMLInputElement)) throw new Error('expected input');
    expect(input.disabled).toBe(true);
  });
});
