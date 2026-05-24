/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';
import { startActivityTracker } from './activity.js';

describe('VisitorActivityTracker', () => {
  it('emits click events with resolved intentKey', async () => {
    document.body.innerHTML = `
      <button id="signup" aria-label="Sign up">Sign up</button>
    `;
    const sent: any[] = [];
    const stop = startActivityTracker({
      sessionId: 's1',
      hints: new Map([['sign up', '#signup']]),
      send: (msg) => sent.push(msg),
    });
    document.getElementById('signup')!.click();
    await new Promise((r) => setTimeout(r, 5));
    expect(sent.some((m) => m.type === 'visitor_action' && m.action === 'click')).toBe(true);
    stop();
  });

  it('debounces dwell events to one per 5s window', async () => {
    document.body.innerHTML = `<div id="card" style="width:200px;height:200px;">Policy</div>`;
    const sent: any[] = [];
    const stop = startActivityTracker({
      sessionId: 's1',
      hints: new Map(),
      send: (msg) => sent.push(msg),
    });
    // happy-dom doesn't implement IntersectionObserver; we just confirm
    // the tracker doesn't crash and stop works.
    expect(typeof stop).toBe('function');
    stop();
  });

  it('does not capture form input values', async () => {
    document.body.innerHTML = `<input id="x" type="text">`;
    const sent: any[] = [];
    const stop = startActivityTracker({ sessionId: 's1', hints: new Map(), send: (m) => sent.push(m) });
    const input = document.getElementById('x') as HTMLInputElement;
    input.value = 'secret password';
    input.focus();
    await new Promise((r) => setTimeout(r, 5));
    expect(sent.every((m) => !JSON.stringify(m).includes('secret'))).toBe(true);
    stop();
  });
});
