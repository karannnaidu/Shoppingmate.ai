/** @vitest-environment happy-dom */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { mountSoftPrompt } from './soft-prompt.js';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});

describe('mountSoftPrompt()', () => {
  it('renders nothing for the first 5 seconds', () => {
    const onAccept = vi.fn();
    const onDismiss = vi.fn();
    mountSoftPrompt(document.body, { onAccept, onDismiss });
    expect(document.querySelector('[data-shoppingmate-soft-prompt]')).toBeNull();
    vi.advanceTimersByTime(4900);
    expect(document.querySelector('[data-shoppingmate-soft-prompt]')).toBeNull();
  });

  it('appears at 5s of silence', () => {
    mountSoftPrompt(document.body, { onAccept: vi.fn(), onDismiss: vi.fn() });
    vi.advanceTimersByTime(5100);
    expect(document.querySelector('[data-shoppingmate-soft-prompt]')).not.toBeNull();
  });

  it('emits onAccept and removes itself when accept is clicked', () => {
    const onAccept = vi.fn();
    mountSoftPrompt(document.body, { onAccept, onDismiss: vi.fn() });
    vi.advanceTimersByTime(5100);
    const acceptBtn = document.querySelector(
      '[data-shoppingmate-soft-prompt] [data-action="accept"]',
    ) as HTMLButtonElement;
    acceptBtn.click();
    expect(onAccept).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-shoppingmate-soft-prompt]')).toBeNull();
  });

  it('never reappears once dismissed in a session', () => {
    const { cancel } = mountSoftPrompt(document.body, { onAccept: vi.fn(), onDismiss: vi.fn() });
    vi.advanceTimersByTime(5100);
    const dismissBtn = document.querySelector(
      '[data-shoppingmate-soft-prompt] [data-action="dismiss"]',
    ) as HTMLButtonElement;
    dismissBtn.click();
    expect(document.querySelector('[data-shoppingmate-soft-prompt]')).toBeNull();
    vi.advanceTimersByTime(30000);
    expect(document.querySelector('[data-shoppingmate-soft-prompt]')).toBeNull();
    cancel();
  });
});
