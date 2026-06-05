import { describe, expect, it, vi } from 'vitest';
import { renderPill } from '../src/ui/pill.js';

const baseProps = {
  callable: true,
  connection: 'connected' as const,
  voiceError: null,
  invited: false,
  personaName: 'Sage',
  personaInitial: 'S',
  personaAvatarUrl: 'https://cdn.example/personas/calm-clinician.png',
  onCall: () => {},
  onMute: () => {},
  onEnd: () => {},
  onChat: () => {},
  onClose: () => {},
};

describe('renderPill — resting (idle launcher)', () => {
  it('shows "Talk to {persona}" and the AI ASSISTANT caption', () => {
    const root = document.createElement('div');
    renderPill(root, { ...baseProps, mode: 'pill', voiceState: 'idle' });
    expect(root.textContent).toContain('Talk to Sage');
    expect(root.textContent).toContain('AI ASSISTANT');
  });

  it('shows a Call button and NO mic/end controls at rest', () => {
    const root = document.createElement('div');
    renderPill(root, { ...baseProps, mode: 'pill', voiceState: 'idle' });
    expect(root.querySelector('[data-action="call"]')).toBeTruthy();
    expect(root.querySelector('[data-action="mic"]')).toBeNull();
    expect(root.querySelector('[data-action="end"]')).toBeNull();
  });

  it('Call button starts the call', () => {
    const root = document.createElement('div');
    const onCall = vi.fn();
    renderPill(root, { ...baseProps, mode: 'pill', voiceState: 'idle', onCall });
    const call = root.querySelector('[data-action="call"]');
    if (!(call instanceof HTMLButtonElement)) throw new Error('expected call button');
    call.click();
    expect(onCall).toHaveBeenCalledOnce();
  });

  it('shows OFFLINE caption only when WS is disconnected', () => {
    const root = document.createElement('div');
    renderPill(root, { ...baseProps, mode: 'pill', voiceState: 'idle', connection: 'disconnected' });
    expect(root.textContent).toContain('OFFLINE');
  });
});

describe('renderPill — incoming call (proactive invite)', () => {
  it('shows INCOMING CALL caption with an Accept + chat button', () => {
    const root = document.createElement('div');
    renderPill(root, { ...baseProps, mode: 'pill', voiceState: 'idle', invited: true });
    expect(root.textContent).toContain('INCOMING CALL');
    expect(root.querySelector('[data-action="call"]')).toBeTruthy();
    expect(root.querySelector('[data-action="chat"]')).toBeTruthy();
  });

  it('Accept button starts the call', () => {
    const root = document.createElement('div');
    const onCall = vi.fn();
    renderPill(root, { ...baseProps, mode: 'pill', voiceState: 'idle', invited: true, onCall });
    const accept = root.querySelector('[data-action="call"]');
    if (!(accept instanceof HTMLButtonElement)) throw new Error('expected accept button');
    accept.click();
    expect(onCall).toHaveBeenCalledOnce();
  });
});

describe('renderPill — connecting (requesting mic)', () => {
  it('shows THINKING caption, a spinner, and a disabled mic + end', () => {
    const root = document.createElement('div');
    renderPill(root, { ...baseProps, mode: 'call', voiceState: 'connecting' });
    expect(root.textContent).toContain('THINKING');
    expect(root.querySelector('.tray-spinner')).toBeTruthy();
    const mic = root.querySelector('[data-action="mic"]');
    expect(mic).toBeTruthy();
    expect((mic as HTMLButtonElement).disabled).toBe(true);
    expect(root.querySelector('[data-action="end"]')).toBeTruthy();
  });
});

describe('renderPill — connected (live call)', () => {
  it('shows CONNECTED caption, a waveform, mic and end', () => {
    const root = document.createElement('div');
    renderPill(root, { ...baseProps, mode: 'call', voiceState: 'listening' });
    expect(root.textContent).toContain('CONNECTED');
    expect(root.querySelector('.tray-waveform')).toBeTruthy();
    expect(root.querySelector('[data-action="mic"]')).toBeTruthy();
    expect(root.querySelector('[data-action="end"]')).toBeTruthy();
  });

  it('stays CONNECTED when muted (never shows OFFLINE)', () => {
    const root = document.createElement('div');
    renderPill(root, { ...baseProps, mode: 'call', voiceState: 'muted' });
    expect(root.textContent).toContain('CONNECTED');
    expect(root.textContent).not.toContain('OFFLINE');
  });

  it('mic toggles mute — it never starts a call', () => {
    const root = document.createElement('div');
    const onMute = vi.fn();
    const onCall = vi.fn();
    renderPill(root, { ...baseProps, mode: 'call', voiceState: 'listening', onMute, onCall });
    const mic = root.querySelector('[data-action="mic"]');
    if (!(mic instanceof HTMLButtonElement)) throw new Error('expected mic button');
    mic.click();
    expect(onMute).toHaveBeenCalledWith(true);
    expect(onCall).not.toHaveBeenCalled();
  });

  it('end button invokes onEnd', () => {
    const root = document.createElement('div');
    const onEnd = vi.fn();
    renderPill(root, { ...baseProps, mode: 'call', voiceState: 'listening', onEnd });
    const end = root.querySelector('[data-action="end"]');
    if (!(end instanceof HTMLButtonElement)) throw new Error('expected end button');
    end.click();
    expect(onEnd).toHaveBeenCalledOnce();
  });
});

describe('renderPill — error (call failed)', () => {
  it('shows TAP TO RETRY with a Call (retry) button that restarts the call', () => {
    const root = document.createElement('div');
    const onCall = vi.fn();
    renderPill(root, {
      ...baseProps,
      mode: 'call',
      voiceState: 'idle',
      voiceError: { code: 'connect_failed', message: 'x' },
      onCall,
    });
    expect(root.textContent).toContain('TAP TO RETRY');
    const call = root.querySelector('[data-action="call"]');
    if (!(call instanceof HTMLButtonElement)) throw new Error('expected retry call button');
    call.click();
    expect(onCall).toHaveBeenCalledOnce();
    // There is no mic-starts-call path anymore.
    expect(root.querySelector('[data-action="mic"]')).toBeNull();
  });
});

describe('renderPill — toggle', () => {
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
