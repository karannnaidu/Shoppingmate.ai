/** @vitest-environment happy-dom */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { executeHostAction } from './actions.js';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('executeHostAction()', () => {
  it('navigates to a same-origin path via window.location.href', async () => {
    const assignSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { href: 'https://shoppingmate.ai/', assign: assignSpy, origin: 'https://shoppingmate.ai', pathname: '/' },
      writable: true,
    });
    const r = await executeHostAction({ type: 'navigate', path: '/pricing' });
    expect(r).toEqual({ ok: true });
    expect(assignSpy).toHaveBeenCalledWith('/pricing');
  });

  it('returns not_found when AX-tree resolver finds no element', async () => {
    document.body.innerHTML = '<div></div>';
    const r = await executeHostAction({ type: 'scroll_to', intent: 'starter plan card' });
    expect(r).toEqual({ ok: false, reason: 'not_found' });
  });

  it('scrolls into view when intent resolves', async () => {
    const el = document.createElement('section');
    el.setAttribute('aria-label', 'Plan grid');
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);
    const r = await executeHostAction({ type: 'scroll_to', intent: 'plan grid' });
    expect(r).toEqual({ ok: true });
    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it('clicks the resolved element', async () => {
    const btn = document.createElement('button');
    btn.setAttribute('aria-label', 'Sign up');
    btn.setAttribute('data-tour-stop', 'signup');
    const clickSpy = vi.fn();
    btn.click = clickSpy;
    document.body.appendChild(btn);
    const r = await executeHostAction({ type: 'click', intent: 'signup button' });
    expect(r).toEqual({ ok: true });
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('rejects cross-origin navigation', async () => {
    const r = await executeHostAction({ type: 'navigate', path: 'https://evil.example.com' });
    expect(r).toEqual({ ok: false, reason: 'cross_origin' });
  });

  it('highlights the resolved element via pulse ring', async () => {
    const el = document.createElement('div');
    el.setAttribute('aria-label', 'Starter plan card');
    document.body.appendChild(el);
    const r = await executeHostAction({ type: 'highlight', intent: 'starter plan card', durationMs: 1500 });
    expect(r).toEqual({ ok: true });
    expect(document.querySelector('[data-shoppingmate-pulse-ring]')).not.toBeNull();
  });
});
