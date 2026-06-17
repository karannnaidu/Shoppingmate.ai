/** @vitest-environment happy-dom */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderChat } from './chat.js';
import { STRINGS } from '../strings.js';

function baseProps(over = {}) {
  return {
    transcript: [],
    checkoutUrl: null,
    personaName: 'Calmio',
    personaInitial: 'C',
    personaAvatarUrl: '',
    onSend: vi.fn(),
    onCall: vi.fn(),
    onClose: vi.fn(),
    onCardTap: vi.fn(),
    closed: false,
    ...over,
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('renderChat welcome quick-start chips', () => {
  it('renders the bullets as clickable buttons (not static list items)', () => {
    const host = document.createElement('div');
    renderChat(host, baseProps());
    const chips = host.querySelectorAll('.welcome-bullet');
    expect(chips.length).toBe(STRINGS.panelBullets.length);
    chips.forEach((c) => expect(c.tagName).toBe('BUTTON'));
    expect(host.querySelector('.welcome-bullets li')).toBeNull();
  });

  it('sends the matching starter prompt when a chip is tapped', () => {
    const host = document.createElement('div');
    const props = baseProps();
    renderChat(host, props);
    const chips = host.querySelectorAll<HTMLButtonElement>('.welcome-bullet');
    chips[0].click();
    expect(props.onSend).toHaveBeenCalledWith(STRINGS.panelPrompts[0]);
    chips[1].click();
    expect(props.onSend).toHaveBeenCalledWith(STRINGS.panelPrompts[1]);
  });

  it('does not send when the session is closed', () => {
    const host = document.createElement('div');
    const props = baseProps({ closed: true });
    renderChat(host, props);
    const chip = host.querySelector<HTMLButtonElement>('.welcome-bullet');
    chip?.click();
    expect(props.onSend).not.toHaveBeenCalled();
  });
});
