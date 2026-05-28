/** @vitest-environment happy-dom */
import type { Merchant } from '@shoppingmate/db';
import type { ChatToolsResult } from '@shoppingmate/shared';
import { describe, expect, it, vi } from 'vitest';
// The agent package does not list @shoppingmate/widget as a workspace dep, so
// we reach across the monorepo via a relative path. Vitest's resolver follows
// the on-disk path at runtime; the tsc build excludes *.test.ts so this does
// not affect the published agent build.
import { executeHostAction } from '../../widget/src/host/actions.js';
import { type RunTurnDeps, runTurn } from './runtime.js';
import type { SessionState } from './types.js';

describe('Bucket B integration — pricing tour end-to-end', () => {
  it('navigates, scrolls, highlights, quotes Starter, voices the exact speech, and records allowedSpeechTokens', async () => {
    // 1. Stand up the fake host page with ARIA labels the AX-tree resolver can find.
    document.body.innerHTML = `
      <section aria-label="Plan grid" data-tour-stop="pricing"></section>
      <div aria-label="Starter plan card" data-tour-stop="starter-plan-card"></div>
      <button aria-label="Sign up" data-tour-stop="signup">Sign up</button>
    `;

    // 2. Stub window.location so navigate doesn't blow up under happy-dom.
    //    happy-dom forbids replacing window.location wholesale, so we spy on
    //    .assign in place and let the URL constructor see the existing href.
    const assign = vi.fn();
    // happy-dom's location object is read-only for some props, but `assign`
    // can be replaced directly.
    (window.location as unknown as { assign: typeof assign }).assign = assign;

    // 3. Queue the chat-model responses.
    //    Turn 1: emit four tool calls (navigate, scroll, highlight, pricing.quote).
    //    Turn 2: text + no tool calls — runtime exits the loop and emits the say.
    const result1: ChatToolsResult = {
      text: '',
      toolCalls: [
        {
          id: 't1',
          name: 'site.navigate',
          argumentsJson: JSON.stringify({ path: '/pricing' }),
        },
        {
          id: 't2',
          name: 'site.scroll_to',
          argumentsJson: JSON.stringify({ intent: 'plan grid' }),
        },
        {
          id: 't3',
          name: 'site.highlight',
          argumentsJson: JSON.stringify({ intent: 'starter plan card' }),
        },
        {
          id: 't4',
          name: 'pricing.quote',
          argumentsJson: JSON.stringify({ plan_id: 'starter' }),
        },
      ],
      stopReason: 'tool_calls',
      inputTokens: 100,
      outputTokens: 50,
    };
    const result2: ChatToolsResult = {
      text:
        'Starter is thirty dollars per month for one hundred conversations. Want me to sign you up?',
      toolCalls: [],
      stopReason: 'stop',
      inputTokens: 120,
      outputTokens: 30,
    };
    const fakeChatTools = vi
      .fn()
      .mockResolvedValueOnce(result1)
      .mockResolvedValueOnce(result2);

    // 4. Fixtures for runTurn.
    const session: SessionState = {
      sessionId: 's1',
      merchantId: 'SM-XPK2EN',
      cartToken: null,
      history: [],
      turnCount: 0,
      voiceMs: 0,
      totalMs: 0,
      startedAt: Date.now(),
      lastTurnAt: Date.now(),
      mode: 'voice',
      allowedSpeechTokens: [],
    };
    const merchant = {
      id: 'SM-XPK2EN',
      name: 'shoppingmate',
      domain: 'shoppingmate.ai',
      personaId: 'concierge',
      adapterType: 'shopify',
    } as unknown as Merchant;

    const sayTexts: string[] = [];
    let lastSaved: SessionState | null = null;
    const metricCalls: Array<{ name: string; tags: Record<string, unknown> }> = [];

    const deps: RunTurnDeps = {
      loadAdapter: () => ({}) as never,
      saveSession: async (s: SessionState) => {
        lastSaved = s;
      },
      recordMetric: async (name, tags) => {
        metricCalls.push({ name, tags });
      },
      chatToolsImpl: fakeChatTools as unknown as RunTurnDeps['chatToolsImpl'],
      dispatchHostAction: (action) => executeHostAction(action),
    };

    // 5. Drive the runtime, threading dispatchHostAction into the widget's executor.
    for await (const ev of runTurn(deps, merchant, session, {
      type: 'user_text',
      sessionId: 's1',
      text: 'show me pricing',
      mode: 'voice',
    })) {
      if (ev.type === 'say') sayTexts.push(ev.text);
    }

    // 6. Assertions
    const sayJoined = sayTexts.join(' ');
    expect(sayJoined).toContain(
      'Starter is thirty dollars per month for one hundred conversations.',
    );
    expect(lastSaved?.allowedSpeechTokens).toContain(
      'Starter is thirty dollars per month for one hundred conversations.',
    );
    // pricing.quote.called metric fired
    expect(metricCalls.some((m) => m.name === 'pricing.quote.called')).toBe(true);
    // Pulse ring was mounted by executeHostAction site.highlight (durationMs = 2000,
    // still alive at the time of assertion because no real time has elapsed).
    expect(document.querySelector('[data-shoppingmate-pulse-ring]')).not.toBeNull();
    // Navigate was attempted with the resolved /pricing path. The fallback path
    // wraps the call in setTimeout(0) so the host_action_result can return over
    // LiveKit before the browser tears down; wait one macrotask for it.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(assign).toHaveBeenCalledWith('/pricing');
  });
});
