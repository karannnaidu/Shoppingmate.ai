import { describe, expect, it, vi } from 'vitest';
import { renderPill } from '../src/ui/pill.js';

describe('renderPill', () => {
  it('renders Talk to Sage when callable', () => {
    const root = document.createElement('div');
    const onCall = vi.fn();
    const onChat = vi.fn();
    renderPill(root, { mode: 'pill', callable: true, onCall, onChat, onClose: () => {} });
    expect(root.textContent).toContain('Talk to Sage');
  });

  it('renders Chat with Sage when not callable', () => {
    const root = document.createElement('div');
    renderPill(root, {
      mode: 'pill',
      callable: false,
      onCall: () => {},
      onChat: () => {},
      onClose: () => {},
    });
    expect(root.textContent).toContain('Chat with Sage');
  });

  it('shows CALL / chat / close actions when expanded', () => {
    const root = document.createElement('div');
    renderPill(root, {
      mode: 'expanded',
      callable: true,
      onCall: () => {},
      onChat: () => {},
      onClose: () => {},
    });
    expect(root.querySelector('[data-action="call"]')).toBeTruthy();
    expect(root.querySelector('[data-action="chat"]')).toBeTruthy();
    expect(root.querySelector('[data-action="close"]')).toBeTruthy();
  });

  it('clicking call invokes onCall', () => {
    const root = document.createElement('div');
    const onCall = vi.fn();
    renderPill(root, {
      mode: 'expanded',
      callable: true,
      onCall,
      onChat: () => {},
      onClose: () => {},
    });
    const callBtn = root.querySelector('[data-action="call"]');
    if (!(callBtn instanceof HTMLButtonElement)) throw new Error('expected call button');
    callBtn.click();
    expect(onCall).toHaveBeenCalledOnce();
  });
});
