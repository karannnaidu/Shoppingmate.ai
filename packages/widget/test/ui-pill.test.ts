import { describe, expect, it, vi } from 'vitest';
import { renderPill } from '../src/ui/pill.js';

const baseProps = {
  callable: true,
  connection: 'connected' as const,
  personaName: 'Sage',
  personaInitial: 'S',
  personaAvatarUrl: 'https://cdn.example/personas/calm-clinician.png',
  onCall: () => {},
  onMute: () => {},
  onEnd: () => {},
  onChat: () => {},
  onClose: () => {},
};

describe('renderPill', () => {
  it('renders persona name in tray', () => {
    const root = document.createElement('div');
    renderPill(root, { ...baseProps, mode: 'pill', voiceState: 'idle' });
    expect(root.textContent).toContain('Sage');
  });

  it('shows CONNECTED status when WS is up even if voice is idle', () => {
    const root = document.createElement('div');
    renderPill(root, { ...baseProps, mode: 'pill', voiceState: 'idle' });
    expect(root.textContent).toContain('CONNECTED');
  });

  it('shows OFFLINE only when WS connection is disconnected', () => {
    const root = document.createElement('div');
    renderPill(root, {
      ...baseProps,
      mode: 'pill',
      voiceState: 'idle',
      connection: 'disconnected',
    });
    expect(root.textContent).toContain('OFFLINE');
  });

  it('shows CONNECTING when WS is reconnecting', () => {
    const root = document.createElement('div');
    renderPill(root, {
      ...baseProps,
      mode: 'pill',
      voiceState: 'idle',
      connection: 'reconnecting',
    });
    expect(root.textContent).toContain('CONNECTING');
  });

  it('shows CONNECTED status when voice is active', () => {
    const root = document.createElement('div');
    renderPill(root, { ...baseProps, mode: 'call', voiceState: 'listening' });
    expect(root.textContent).toContain('CONNECTED');
  });

  it('stays CONNECTED when voice is muted (regression: mute should not show OFFLINE)', () => {
    const root = document.createElement('div');
    renderPill(root, { ...baseProps, mode: 'call', voiceState: 'muted' });
    expect(root.textContent).toContain('CONNECTED');
    expect(root.textContent).not.toContain('OFFLINE');
  });

  it('renders mic and end controls', () => {
    const root = document.createElement('div');
    renderPill(root, { ...baseProps, mode: 'call', voiceState: 'listening' });
    expect(root.querySelector('[data-action="mic"]')).toBeTruthy();
    expect(root.querySelector('[data-action="end"]')).toBeTruthy();
  });

  it('hides end button when idle', () => {
    const root = document.createElement('div');
    renderPill(root, { ...baseProps, mode: 'pill', voiceState: 'idle' });
    const end = root.querySelector('[data-action="end"]');
    expect(end?.classList.contains('hidden')).toBe(true);
  });

  it('mic click starts call when idle', () => {
    const root = document.createElement('div');
    const onCall = vi.fn();
    renderPill(root, { ...baseProps, mode: 'pill', voiceState: 'idle', onCall });
    const mic = root.querySelector('[data-action="mic"]');
    if (!(mic instanceof HTMLButtonElement)) throw new Error('expected mic button');
    mic.click();
    expect(onCall).toHaveBeenCalledOnce();
  });

  it('mic click toggles mute when in call', () => {
    const root = document.createElement('div');
    const onMute = vi.fn();
    renderPill(root, {
      ...baseProps,
      mode: 'call',
      voiceState: 'listening',
      onMute,
    });
    const mic = root.querySelector('[data-action="mic"]');
    if (!(mic instanceof HTMLButtonElement)) throw new Error('expected mic button');
    mic.click();
    expect(onMute).toHaveBeenCalledWith(true);
  });

  it('end button invokes onEnd', () => {
    const root = document.createElement('div');
    const onEnd = vi.fn();
    renderPill(root, {
      ...baseProps,
      mode: 'call',
      voiceState: 'listening',
      onEnd,
    });
    const end = root.querySelector('[data-action="end"]');
    if (!(end instanceof HTMLButtonElement)) throw new Error('expected end button');
    end.click();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('avatar click opens chat from pill mode', () => {
    const root = document.createElement('div');
    const onChat = vi.fn();
    renderPill(root, { ...baseProps, mode: 'pill', voiceState: 'idle', onChat });
    const toggle = root.querySelector('[data-action="toggle"]');
    if (!(toggle instanceof HTMLButtonElement)) throw new Error('expected toggle');
    toggle.click();
    expect(onChat).toHaveBeenCalledOnce();
  });

  it('avatar click closes panel when expanded', () => {
    const root = document.createElement('div');
    const onClose = vi.fn();
    renderPill(root, { ...baseProps, mode: 'chat', voiceState: 'idle', onClose });
    const toggle = root.querySelector('[data-action="toggle"]');
    if (!(toggle instanceof HTMLButtonElement)) throw new Error('expected toggle');
    toggle.click();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
